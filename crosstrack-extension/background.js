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

const API_BASE = "http://localhost:8080/api";

async function getApiToken() {
  const data = await chrome.storage.local.get("apiToken");
  return data.apiToken || null;
}

// ─── Resume text cache (session-scoped, cleared on token change) ───

async function getCachedResumeText() {
  const data = await chrome.storage.session.get("cachedResumeText");
  return data.cachedResumeText || null;
}

async function cacheResumeText(text) {
  await chrome.storage.session.set({ cachedResumeText: text });
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
        // Always try to fetch fresh data from backend first (source of truth)
        const freshToken = await getApiToken();
        if (freshToken) {
          try {
            const apiResp = await fetch(`${API_BASE}/applications`, {
              headers: { "Authorization": `Bearer ${freshToken}` },
            });
            // 401/403 = token is expired or invalid — clear it and force re-login
            if (apiResp.status === 401 || apiResp.status === 403) {
              await clearApiToken();
              return { applications: [], error: "session_expired" };
            }
            if (apiResp.ok) {
              const apiApps = await apiResp.json();
              // Map backend format → extension format
              const mapped = apiApps.map(a => ({
                jobId: `api-${a.id}`,
                company: a.company || "Unknown Company",
                role: a.role || "Unknown Role",
                platform: (a.platform || "OTHER").toLowerCase(),
                status: (a.status || "applied").toLowerCase(),
                url: a.url || "",
                location: a.location || "",
                appliedAt: a.appliedAt || a.createdAt || new Date().toISOString(),
                source: a.source || "EMAIL",
                apiId: a.id,
              }));
              // Save fresh data into local storage so offline reads are current
              await chrome.storage.local.set({ applications: mapped });
              await updateBadge();
              return { applications: mapped };
            }
          } catch (e) {
            // Network error — backend is offline, serve local cache with a flag
            console.log("[CrossTrack] Backend offline, using local cache:", e.message);
            const cached = await getApplications();
            return { applications: cached, error: "offline" };
          }
        }
        // Not logged in — return empty (no cached stale data)
        return { applications: [], error: "not_logged_in" };
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

      // ── Sidebar AI actions ──

      case "GET_RESUMES": {
        const listToken = await getApiToken();
        if (!listToken) return { error: "Not logged in." };
        try {
          const resp = await fetch(`${API_BASE}/resumes`, {
            headers: { "Authorization": `Bearer ${listToken}` },
          });
          if (!resp.ok) return { error: `Backend returned ${resp.status} — is CrossTrack server running on :8080?` };
          const resumes = await resp.json();
          return { resumes };
        } catch (e) {
          return { error: "Network error fetching resumes." };
        }
      }

      case "GET_ATS_SCORE": {
        const atsToken = await getApiToken();
        if (!atsToken) return { error: "Not logged in to CrossTrack." };

        // If a specific resumeId is provided, always fetch that resume fresh (no cache)
        const selectedResumeId = message.data.resumeId || null;
        let resumeText = null;
        let resumeName = null;

        if (selectedResumeId) {
          // User explicitly selected a resume — fetch it by ID
          try {
            const resumeResp = await fetch(`${API_BASE}/resumes/${selectedResumeId}/text`, {
              headers: { "Authorization": `Bearer ${atsToken}` },
            });
            if (!resumeResp.ok) return { error: "Failed to load selected resume." };
            const resumeData = await resumeResp.json();
            resumeName = resumeData.name || null;
            resumeText = resumeData.parsedText || resumeData.text || "";
            if (!resumeText) return { error: "Selected resume has no text. Re-upload it in CrossTrack." };
            // Cache the newly selected resume
            await cacheResumeText(resumeText);
            await chrome.storage.session.set({ cachedResumeName: resumeName, cachedResumeId: selectedResumeId });
          } catch (e) {
            return { error: "Failed to fetch selected resume." };
          }
        } else {
          // No specific resume — use cache or default
          resumeText = await getCachedResumeText();
          if (!resumeText) {
            try {
              const resumeResp = await fetch(`${API_BASE}/resumes/default`, {
                headers: { "Authorization": `Bearer ${atsToken}` },
              });
              if (!resumeResp.ok) return { error: "No default resume found. Upload one in CrossTrack dashboard first." };
              const resumeData = await resumeResp.json();
              resumeName = resumeData.name || null;
              resumeText = resumeData.parsedText || "";
              if (!resumeText) return { error: "Resume has no text. Please re-upload your resume in CrossTrack." };
              await cacheResumeText(resumeText);
              await chrome.storage.session.set({ cachedResumeName: resumeName });
            } catch (e) {
              return { error: "Failed to fetch resume from CrossTrack." };
            }
          } else {
            const cached = await chrome.storage.session.get("cachedResumeName");
            resumeName = cached.cachedResumeName || null;
          }
        }

        try {
          const scoreResp = await fetch(`${API_BASE}/ai/match-score`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${atsToken}`,
            },
            body: JSON.stringify({
              resumeText,
              jobDescription: message.data.jobDescription,
            }),
          });
          if (scoreResp.status === 429) return { error: "Daily AI limit reached. Resets at midnight." };
          if (!scoreResp.ok) return { error: "Score request failed." };
          const result = await scoreResp.json();
          // Attach the resume name so the sidebar can show it
          result.resumeName = resumeName;
          return result;
        } catch (e) {
          return { error: "Network error reaching CrossTrack API." };
        }
      }

      case "GENERATE_COVER_LETTER": {
        const clToken = await getApiToken();
        if (!clToken) return { error: "Not logged in to CrossTrack." };

        let clResumeText = await getCachedResumeText();
        if (!clResumeText) {
          try {
            const resumeResp = await fetch(`${API_BASE}/resumes/default`, {
              headers: { "Authorization": `Bearer ${clToken}` },
            });
            if (resumeResp.ok) {
              const resumeData = await resumeResp.json();
              clResumeText = resumeData.parsedText || "";
              if (clResumeText) await cacheResumeText(clResumeText);
            }
          } catch (e) { /* fall through with empty resume */ }
        }

        try {
          const clResp = await fetch(`${API_BASE}/ai/cover-letter`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${clToken}`,
            },
            body: JSON.stringify({
              resumeText: clResumeText || "",
              jobDescription: message.data.jobDescription,
              company: message.data.company,
              role: message.data.role,
              tone: "professional but warm",
            }),
          });
          if (clResp.status === 429) return { error: "Daily AI limit reached. Resets at midnight." };
          if (!clResp.ok) return { error: "Cover letter request failed." };
          return await clResp.json();
        } catch (e) {
          return { error: "Network error reaching CrossTrack API." };
        }
      }

      case "TAILOR_RESUME_BULLETS": {
        const trToken = await getApiToken();
        if (!trToken) return { error: "Not logged in to CrossTrack." };

        let trResumeText = await getCachedResumeText();
        if (!trResumeText) {
          try {
            const resumeResp = await fetch(`${API_BASE}/resumes/default`, {
              headers: { "Authorization": `Bearer ${trToken}` },
            });
            if (resumeResp.ok) {
              const resumeData = await resumeResp.json();
              trResumeText = resumeData.parsedText || "";
              if (trResumeText) await cacheResumeText(trResumeText);
            }
          } catch (e) { /* fall through */ }
        }

        if (!trResumeText) return { error: "No resume found. Please upload one in CrossTrack." };

        try {
          const trResp = await fetch(`${API_BASE}/ai/tailor-resume`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${trToken}`,
            },
            body: JSON.stringify({
              resumeText: trResumeText,
              jobDescription: message.data.jobDescription,
              targetBullets: [],
            }),
          });
          if (trResp.status === 429) return { error: "Daily AI limit reached. Resets at midnight." };
          if (!trResp.ok) return { error: "Tailor request failed." };
          return await trResp.json();
        } catch (e) {
          return { error: "Network error reaching CrossTrack API." };
        }
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
