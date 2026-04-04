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
      errorEl.textContent = "Cannot connect to API. Is Spring Boot running on port 8080?";
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
    if (response && response.applications) {
      allApplications = response.applications;
      updateStats();
      renderApplications();
    }
  });
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

  list.innerHTML = filtered
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
