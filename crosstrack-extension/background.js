// ══════════════════════════════════════════════════
// CrossTrack — Background Service Worker
// ══════════════════════════════════════════════════

// ─── Fuzzy Matching Engine ───

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenMatch(a, b) {
  const tokensA = a.split(/\s+/).filter(Boolean);
  const tokensB = b.split(/\s+/).filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length > tokensB.length ? tokensA : tokensB;
  const matched = shorter.filter(t => longer.some(l => l.includes(t) || t.includes(l)));
  return shorter.length > 0 ? matched.length / shorter.length : 0;
}

const COMPANY_ALIASES = {
  bytedance: "tiktok",
  alphabet: "google",
  meta: "facebook",
  "meta platforms": "facebook",
};

const COMPANY_SUFFIXES = /\b(inc|llc|corp|corporation|ltd|limited|co|company|group|holdings|plc|gmbh|sa|ag)\b\.?/gi;
const PARENTHETICAL = /\s*\(.*?\)\s*/g;

function normalizeCompany(name) {
  if (!name) return "";
  let n = name.replace(PARENTHETICAL, " ").replace(COMPANY_SUFFIXES, "")
    .replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return COMPANY_ALIASES[n] || n;
}

function normalizeRole(title) {
  if (!title) return "";
  const levelWords = /\b(senior|junior|sr|jr|lead|staff|principal|intern|i{1,3}|iv|v|entry[- ]?level|mid[- ]?level|associate)\b\.?/gi;
  return title.toLowerCase().replace(levelWords, "")
    .replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function checkDuplicate(company, role, applications) {
  const normCompany = normalizeCompany(company);
  const normRole = normalizeRole(role);
  let bestMatch = null;
  let bestScore = 0;
  const allMatches = [];

  for (const app of applications) {
    const appCompany = normalizeCompany(app.company);
    const appRole = normalizeRole(app.role);

    // Company score: max of string similarity and token match
    const compStringSim = similarity(normCompany, appCompany);
    const compTokenSim = tokenMatch(normCompany, appCompany);
    const companyScore = Math.max(compStringSim, compTokenSim);

    // Role score
    const roleStringSim = similarity(normRole, appRole);
    const roleTokenSim = tokenMatch(normRole, appRole);
    const roleScore = Math.max(roleStringSim, roleTokenSim);

    // Weighted final score: company 70%, role 30%
    const finalScore = companyScore * 0.7 + roleScore * 0.3;

    if (finalScore > 0.6) {
      allMatches.push({ ...app, score: finalScore });
    }
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = app;
    }
  }

  return {
    isDuplicate: bestScore > 0.8,
    bestMatch,
    score: bestScore,
    allMatches: allMatches.sort((a, b) => b.score - a.score),
  };
}

// ─── API Configuration ───

const API_BASE = "https://crosstrack-production.up.railway.app/api";

async function getApiToken() {
  const data = await chrome.storage.local.get("apiToken");
  return data.apiToken || null;
}

async function saveApiToken(token, email) {
  await chrome.storage.local.set({ apiToken: token, apiEmail: email });
}

async function clearApiToken() {
  await chrome.storage.local.remove(["apiToken", "apiEmail"]);
}

async function getApiConnectionStatus() {
  const data = await chrome.storage.local.get(["apiToken", "apiEmail"]);
  return { connected: !!data.apiToken, email: data.apiEmail || null };
}

async function apiLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      const data = await response.json();
      await saveApiToken(data.token, data.email);
      return { success: true, email: data.email, displayName: data.displayName };
    } else {
      return { success: false, error: "Invalid email or password" };
    }
  } catch (err) {
    return { success: false, error: "Cannot connect to API. Is the Spring Boot server running?" };
  }
}

async function syncToApi(app) {
  const token = await getApiToken();
  if (!token) return { synced: false, reason: "not_connected" };

  const apiPayload = {
    company: app.company,
    role: app.role,
    platform: (app.platform || "OTHER").toUpperCase(),
    status: (app.status || "applied").toUpperCase().replace("INTERVIEWING", "INTERVIEW").replace("OFFERED", "OFFER"),
    url: app.url || "",
    location: app.location || "",
    salary: app.salary || "",
    notes: "Auto-detected by CrossTrack extension",
    source: "EXTENSION",
    appliedAt: app.appliedAt || new Date().toISOString(),
  };

  try {
    const response = await fetch(`${API_BASE}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(apiPayload),
    });

    if (response.ok) {
      console.log("[CrossTrack] Synced to API successfully");
      return { synced: true };
    } else if (response.status === 401) {
      await clearApiToken();
      return { synced: false, reason: "token_expired" };
    } else {
      return { synced: false, reason: "api_error" };
    }
  } catch (err) {
    console.log("[CrossTrack] API unreachable:", err.message);
    return { synced: false, reason: "network_error" };
  }
}

// ─── Storage Helpers ───

async function getApplications() {
  const data = await chrome.storage.local.get("applications");
  return data.applications || [];
}

async function saveApplication(app) {
  const apps = await getApplications();
  // Check for exact duplicate (same jobId)
  const exists = apps.find(a => a.jobId === app.jobId && a.platform === app.platform);
  if (exists) return { saved: false, reason: "exact_duplicate" };
  apps.unshift(app);
  await chrome.storage.local.set({ applications: apps });
  await updateBadge();

  // Sync to Spring Boot API (blocking — we want to report status)
  let syncResult = { synced: false, reason: "unknown" };
  try {
    syncResult = await syncToApi(app);
    if (syncResult.synced) {
      console.log("[CrossTrack] Application synced to dashboard!");
    } else {
      console.log("[CrossTrack] Sync failed:", syncResult.reason);
    }
  } catch (e) {
    console.log("[CrossTrack] Sync error:", e.message);
    syncResult = { synced: false, reason: "exception" };
  }

  return { saved: true, synced: syncResult.synced, syncReason: syncResult.reason };
}

async function updateBadge() {
  const apps = await getApplications();
  const count = apps.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#6C5CE7" });
}

// ─── Message Handler ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case "APPLICATION_DETECTED": {
        // Check if user is logged in to API first
        const token = await getApiToken();
        if (!token) {
          return { saved: false, reason: "not_logged_in" };
        }
        const result = await saveApplication(message.data);
        return result;
      }

      case "CHECK_LOGIN": {
        const loginToken = await getApiToken();
        const loginData = await chrome.storage.local.get(["apiEmail"]);
        return {
          loggedIn: !!loginToken,
          email: loginData.apiEmail || null
        };
      }

      case "GET_APPLICATIONS": {
        const apps = await getApplications();
        return { applications: apps };
      }

      case "CHECK_DUPLICATE": {
        const apps = await getApplications();
        const result = checkDuplicate(message.data.company, message.data.role, apps);
        return result;
      }

      case "UPDATE_STATUS": {
        const apps = await getApplications();
        const idx = apps.findIndex(a => a.jobId === message.data.jobId);
        if (idx !== -1) {
          apps[idx].status = message.data.newStatus;
          apps[idx].updatedAt = new Date().toISOString();
          await chrome.storage.local.set({ applications: apps });
          return { updated: true };
        }
        return { updated: false, reason: "not_found" };
      }

      case "DELETE_APPLICATION": {
        let apps = await getApplications();
        apps = apps.filter(a => a.jobId !== message.data.jobId);
        await chrome.storage.local.set({ applications: apps });
        await updateBadge();
        return { deleted: true };
      }

      case "CLEAR_ALL": {
        await chrome.storage.local.set({ applications: [] });
        await updateBadge();
        return { cleared: true };
      }

      case "LOAD_TEST_DATA": {
        const testApps = generateTestData();
        await chrome.storage.local.set({ applications: testApps });
        await updateBadge();
        // Also sync all test data to API
        for (const app of testApps) {
          await syncToApi(app);
        }
        return { loaded: true, count: testApps.length };
      }

      case "API_LOGIN": {
        const result = await apiLogin(message.data.email, message.data.password);
        return result;
      }

      case "API_DISCONNECT": {
        await clearApiToken();
        return { disconnected: true };
      }

      case "API_STATUS": {
        const status = await getApiConnectionStatus();
        return status;
      }

      case "SYNC_ALL_TO_API": {
        const allApps = await getApplications();
        let synced = 0;
        for (const app of allApps) {
          const result = await syncToApi(app);
          if (result.synced) synced++;
        }
        return { synced, total: allApps.length };
      }

      default:
        return { error: "Unknown message type" };
    }
  };

  handler().then(sendResponse);
  return true; // Keep message channel open for async response
});

// ─── Ghost Job Check (alarm-based) ───

chrome.alarms.create("ghostCheck", { periodInMinutes: 1440 }); // Daily

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "ghostCheck") return;

  const apps = await getApplications();
  const now = Date.now();
  const GHOST_DAYS = 21;
  let updated = false;

  for (const app of apps) {
    if (app.status !== "applied") continue;
    const daysSince = (now - new Date(app.appliedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > GHOST_DAYS) {
      app.status = "ghosted";
      app.updatedAt = new Date().toISOString();
      app.ghostReason = "timeout";
      updated = true;
      console.log(`[CrossTrack] Auto-ghosted: ${app.company} - ${app.role} (${Math.round(daysSince)} days)`);
    }
  }

  if (updated) {
    await chrome.storage.local.set({ applications: apps });
    await updateBadge();
  }
});

// ─── Init ───

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get("applications");
  if (!data.applications) {
    await chrome.storage.local.set({ applications: [] });
  }
  await updateBadge();
  console.log("[CrossTrack] Extension installed and initialized");
});

// ─── Test Data Generator ───

function generateTestData() {
  const now = new Date();
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

  return [
    // These companies commonly send emails with NO role name — perfect for testing smart merge
    // Extension captures role → Email scan finds "Unknown Role" → Smart merge fills it in
    { jobId: "job_deshaw1", company: "D. E. Shaw", role: "SDE Intern", platform: "linkedin", url: "https://linkedin.com/jobs/deshaw1", location: "New York, NY", appliedAt: daysAgo(5), status: "applied" },
    { jobId: "job_jpmc1", company: "JPMorgan Chase", role: "Software Engineer Program", platform: "linkedin", url: "https://linkedin.com/jobs/jpmc1", location: "New York, NY", appliedAt: daysAgo(7), status: "applied" },
    { jobId: "job_goog1", company: "Google", role: "Software Engineer", platform: "linkedin", url: "https://linkedin.com/jobs/1", location: "Mountain View, CA", appliedAt: daysAgo(5), status: "applied" },
    { jobId: "job_amzn1", company: "Amazon", role: "SDE II", platform: "linkedin", url: "https://linkedin.com/jobs/2", location: "Seattle, WA", appliedAt: daysAgo(10), status: "interviewing" },
    { jobId: "job_msft1", company: "Microsoft", role: "Product Manager", platform: "linkedin", url: "https://linkedin.com/jobs/3", location: "Redmond, WA", appliedAt: daysAgo(3), status: "applied" },
    { jobId: "job_appl1", company: "Apple", role: "iOS Developer", platform: "indeed", url: "https://indeed.com/jobs/1", location: "Cupertino, CA", appliedAt: daysAgo(7), status: "applied" },
    { jobId: "job_nflx1", company: "Netflix", role: "Backend Engineer", platform: "indeed", url: "https://indeed.com/jobs/2", location: "Los Gatos, CA", appliedAt: daysAgo(14), status: "rejected" },
    { jobId: "job_meta1", company: "Meta Platforms", role: "Frontend Engineer", platform: "indeed", url: "https://indeed.com/jobs/3", location: "Menlo Park, CA", appliedAt: daysAgo(8), status: "applied" },
    { jobId: "job_strp1", company: "Stripe", role: "Software Engineer Intern", platform: "handshake", url: "https://joinhandshake.com/jobs/1", location: "San Francisco, CA", appliedAt: daysAgo(2), status: "applied" },
    { jobId: "job_tikt1", company: "TikTok", role: "Full Stack Engineer", platform: "linkedin", url: "https://linkedin.com/jobs/4", location: "New York, NY", appliedAt: daysAgo(25), status: "ghosted" },
  ];
}
