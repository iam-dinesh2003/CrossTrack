// ══════════════════════════════════════════════════
// CrossTrack — Popup Script
// ══════════════════════════════════════════════════

const API_BASE = "http://localhost:8080/api";

const PLATFORM_COLORS = {
  linkedin: "#0A66C2",
  indeed: "#6C5CE7",
  handshake: "#E4522B",
  manual: "#64748B",
};

const STATUS_OPTIONS = ["applied", "interviewing", "offered", "rejected", "ghosted"];

let currentFilter = "all";
let allApplications = [];

// ─── Init ───

document.addEventListener("DOMContentLoaded", () => {
  loadApplications();
  setupEventListeners();
  checkApiStatus();
});

function setupEventListeners() {
  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderApplications();
    });
  });

  // Dashboard button
  document.getElementById("dashboardBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
  });

  // Refresh
  document.getElementById("refreshBtn").addEventListener("click", loadApplications);

  // Open Sidebar on current tab — uses scripting API (no message race condition)
  document.getElementById("openSidebarBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { window.close(); return; }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "ISOLATED",
        func: () => {
          if (!window.CrossTrackSidebar) return;

          // Try to find job data already detected by content.js
          let jobData = window.__ctLastJob || null;

          // If not cached, extract from page DOM right now
          if (!jobData) {
            const h1s = document.querySelectorAll("h1");
            let role = null;
            for (const h1 of h1s) {
              const t = h1.textContent.trim();
              if (t && t.length > 2 && t.length < 200 &&
                  !["Jobs", "LinkedIn", "Home"].includes(t)) {
                role = t; break;
              }
            }
            let company = null;
            const cLinks = document.querySelectorAll('a[href*="/company/"]');
            for (const l of cLinks) {
              const t = l.textContent.trim().split("\n")[0].trim();
              if (t && t.length > 0 && t.length < 80) { company = t; break; }
            }
            if (role || company) {
              const host = window.location.hostname;
              jobData = {
                jobId: "popup_" + Date.now(),
                role: role || "Unknown Role",
                company: company || "Unknown Company",
                platform: host.includes("linkedin") ? "linkedin"
                        : host.includes("indeed") ? "indeed"
                        : host.includes("handshake") ? "handshake" : "other",
                url: window.location.href,
                appliedAt: new Date().toISOString(),
                status: "applied",
              };
            }
          }

          if (jobData) {
            window.CrossTrackSidebar.show(jobData);
          }
        },
      });
    } catch (e) {
      // Tab is not a supported job page
      const btn = document.getElementById("openSidebarBtn");
      if (btn) {
        btn.textContent = "⚠ Not a job page";
        btn.style.color = "#e17055";
        setTimeout(() => {
          btn.innerHTML = "&#128269; Sidebar";
          btn.style.color = "";
        }, 2500);
      }
      return; // Don't close popup so user sees the error
    }
    window.close();
  });

  // Quick Add toggle
  document.getElementById("quickAddToggle").addEventListener("click", () => {
    const form = document.getElementById("quickAddForm");
    const btn = document.getElementById("quickAddToggle");
    if (form.style.display === "none") {
      form.style.display = "block";
      btn.style.display = "none";
    }
  });

  document.getElementById("quickAddCancel").addEventListener("click", () => {
    document.getElementById("quickAddForm").style.display = "none";
    document.getElementById("quickAddToggle").style.display = "block";
  });

  // Quick Add save
  document.getElementById("quickAddSave").addEventListener("click", async () => {
    const company = document.getElementById("addCompany").value.trim();
    const role = document.getElementById("addRole").value.trim();
    const platform = document.getElementById("addPlatform").value;
    const url = document.getElementById("addUrl").value.trim();

    if (!company || !role) {
      alert("Company and Role are required!");
      return;
    }

    const jobData = {
      jobId: "manual_" + Date.now(),
      company,
      role,
      platform,
      url: url || "",
      location: "",
      appliedAt: new Date().toISOString(),
      status: "applied",
    };

    // Save to extension local storage
    chrome.runtime.sendMessage(
      { type: "APPLICATION_DETECTED", data: jobData },
      () => {}
    );

    // Also sync to API directly if connected
    const storageData = await chrome.storage.local.get(["apiToken"]);
    if (storageData.apiToken) {
      try {
        await fetch(`${API_BASE}/applications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${storageData.apiToken}`,
          },
          body: JSON.stringify({
            company,
            role,
            platform: platform.toUpperCase(),
            status: "APPLIED",
            url: url || "",
            location: "",
            salary: "",
            notes: "Manually tracked via CrossTrack extension",
            source: "EXTENSION",
            appliedAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // API sync failed silently
      }
    }

    // Reset form
    document.getElementById("addCompany").value = "";
    document.getElementById("addRole").value = "";
    document.getElementById("addUrl").value = "";
    document.getElementById("quickAddForm").style.display = "none";
    document.getElementById("quickAddToggle").style.display = "block";

    // Reload list
    setTimeout(() => loadApplications(), 300);
  });

  // Load test data
  document.getElementById("loadTestBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "LOAD_TEST_DATA" }, (response) => {
      if (response && response.loaded) {
        loadApplications();
      }
    });
  });

  // Clear all
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all tracked applications?")) {
      chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, () => {
        loadApplications();
      });
    }
  });

  // API Login — done directly via fetch (no background script dependency)
  document.getElementById("apiLoginBtn").addEventListener("click", async () => {
    const email = document.getElementById("apiEmailInput").value.trim();
    const password = document.getElementById("apiPasswordInput").value;
    const errorEl = document.getElementById("apiError");

    if (!email || !password) {
      errorEl.textContent = "Enter email and password";
      errorEl.style.display = "block";
      return;
    }

    document.getElementById("apiLoginBtn").textContent = "Connecting...";
    document.getElementById("apiLoginBtn").disabled = true;
    errorEl.style.display = "none";

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Save token directly to chrome.storage
        await chrome.storage.local.set({
          apiToken: data.token,
          apiEmail: data.email,
        });
        errorEl.style.display = "none";
        checkApiStatus();
      } else {
        errorEl.textContent = "Invalid email or password";
        errorEl.style.display = "block";
      }
    } catch (err) {
      errorEl.textContent = "Cannot connect to CrossTrack API. Please try again.";
      errorEl.style.display = "block";
    }

    document.getElementById("apiLoginBtn").textContent = "Connect";
    document.getElementById("apiLoginBtn").disabled = false;
  });

  // API Disconnect — done directly via chrome.storage
  document.getElementById("disconnectBtn").addEventListener("click", async () => {
    await chrome.storage.local.remove(["apiToken", "apiEmail"]);
    checkApiStatus();
  });

  // Sync All — done directly via fetch
  document.getElementById("syncAllBtn").addEventListener("click", async () => {
    document.getElementById("syncAllBtn").textContent = "Syncing...";
    document.getElementById("syncAllBtn").disabled = true;

    const storageData = await chrome.storage.local.get(["apiToken", "applications"]);
    const token = storageData.apiToken;
    const apps = storageData.applications || [];

    if (!token) {
      alert("Not connected to API. Please connect first.");
      document.getElementById("syncAllBtn").textContent = "Sync All";
      document.getElementById("syncAllBtn").disabled = false;
      return;
    }

    let synced = 0;
    for (const app of apps) {
      try {
        const res = await fetch(`${API_BASE}/applications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            company: app.company,
            role: app.role,
            platform: (app.platform || "OTHER").toUpperCase(),
            status: (app.status || "applied").toUpperCase().replace("INTERVIEWING", "INTERVIEW").replace("OFFERED", "OFFER"),
            url: app.url || "",
            location: app.location || "",
            salary: app.salary || "",
            notes: "Synced from CrossTrack extension",
            source: "EXTENSION",
            appliedAt: app.appliedAt || new Date().toISOString(),
          }),
        });
        if (res.ok) synced++;
      } catch (e) {
        // skip failed ones
      }
    }

    alert(`Synced ${synced} of ${apps.length} applications to dashboard!`);
    document.getElementById("syncAllBtn").textContent = "Sync All";
    document.getElementById("syncAllBtn").disabled = false;
  });
}

// ─── API Status — read directly from chrome.storage ───

async function checkApiStatus() {
  const data = await chrome.storage.local.get(["apiToken", "apiEmail"]);
  const connectedEl = document.getElementById("apiConnected");
  const disconnectedEl = document.getElementById("apiDisconnected");

  if (data.apiToken) {
    connectedEl.style.display = "flex";
    disconnectedEl.style.display = "none";
    document.getElementById("apiEmail").textContent = data.apiEmail || "Connected";
  } else {
    connectedEl.style.display = "none";
    disconnectedEl.style.display = "block";
  }
}

// ─── Data Loading ───

function loadApplications() {
  chrome.runtime.sendMessage({ type: "GET_APPLICATIONS" }, (response) => {
    if (!response) return;

    // Session expired or not logged in — clear stale list, show login form
    if (response.error === "session_expired" || response.error === "not_logged_in") {
      allApplications = [];
      updateStats();
      renderApplications();
      // Refresh the API status section so login form appears
      checkApiStatus();
      showOfflineBar("Session expired — please log in again to sync your jobs.", "#e17055");
      return;
    }

    // Backend offline — still show cached data but with a notice
    if (response.error === "offline") {
      showOfflineBar("⚠ Backend offline — showing cached data. Start the server to sync.", "#fdcb6e");
    } else {
      // Clear any previous offline bar on success
      const bar = document.getElementById("ct-offline-bar");
      if (bar) bar.remove();
    }

    if (response.applications) {
      allApplications = response.applications;
      updateStats();
      renderApplications();
    }
  });
}

function showOfflineBar(message, color) {
  let bar = document.getElementById("ct-offline-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "ct-offline-bar";
    bar.style.cssText = `padding:6px 12px;font-size:11px;color:#fff;text-align:center;
      background:${color};border-radius:4px;margin:4px 8px;`;
    const appList = document.getElementById("appList");
    if (appList && appList.parentNode) appList.parentNode.insertBefore(bar, appList);
  }
  bar.style.background = color;
  bar.textContent = message;
}

// ─── Stats ───

function updateStats() {
  const apps = allApplications;
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  document.getElementById("totalCount").textContent = apps.length;
  document.getElementById("weekCount").textContent = apps.filter(
    (a) => new Date(a.appliedAt) > weekAgo
  ).length;
  document.getElementById("interviewCount").textContent = apps.filter(
    (a) => a.status === "interviewing"
  ).length;
  document.getElementById("ghostedCount").textContent = apps.filter(
    (a) => a.status === "ghosted"
  ).length;
}

// ─── Render ───

function renderApplications() {
  const list = document.getElementById("appList");
  const empty = document.getElementById("emptyState");

  let filtered = allApplications;
  if (currentFilter !== "all") {
    filtered = allApplications.filter((a) => a.status === currentFilter);
  }

  if (filtered.length === 0) {
    list.innerHTML = "";
    if (empty) {
      list.appendChild(empty);
      empty.style.display = "block";
    }
    return;
  }

  if (empty) empty.style.display = "none";

  // Show only the 3 most recent applications
  const recent = filtered.slice(0, 3);
  const hiddenCount = filtered.length - recent.length;

  list.innerHTML = recent
    .map(
      (app) => `
    <div class="app-item" data-jobid="${app.jobId}">
      <div class="app-avatar" style="background: ${getAvatarColor(app.company)}">
        ${app.company.charAt(0).toUpperCase()}
      </div>
      <div class="app-info">
        <div class="app-company">${escapeHtml(app.company)}</div>
        <div class="app-role">${escapeHtml(app.role)}</div>
      </div>
      <div class="app-meta">
        <span class="platform-badge platform-${app.platform}">${app.platform}</span>
        <select class="status-select" data-jobid="${app.jobId}">
          ${STATUS_OPTIONS.map(
            (s) => `<option value="${s}" ${s === app.status ? "selected" : ""}>${capitalize(s)}</option>`
          ).join("")}
        </select>
        <span class="app-date">${formatDate(app.appliedAt)}</span>
      </div>
    </div>
  `
    )
    .join("");

  if (hiddenCount > 0) {
    list.innerHTML += `
      <div style="text-align:center;padding:8px 0 4px;">
        <a href="#" id="viewAllLink" style="font-size:11px;color:#6C5CE7;font-weight:600;text-decoration:none;">
          +${hiddenCount} more — Open Dashboard
        </a>
      </div>`;
    document.getElementById("viewAllLink").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "http://localhost:5173" });
    });
  }

  // Status change handlers
  list.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const jobId = e.target.dataset.jobid;
      const newStatus = e.target.value;
      chrome.runtime.sendMessage(
        { type: "UPDATE_STATUS", data: { jobId, newStatus } },
        () => loadApplications()
      );
    });
  });
}

// ─── Helpers ───

function getAvatarColor(company) {
  const colors = ["#6C5CE7", "#0A66C2", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
