// ══════════════════════════════════════════════════
// CROSSTRACK CONTENT SCRIPT — BULLETPROOF EDITION v2
// ══════════════════════════════════════════════════
//
// KEY RULE: Never auto-save just from viewing a job.
// Only save when the user ACTUALLY APPLIES (clicks Submit + confirmation).
//
// Detection strategy:
// 1. Detect job info passively (h1 + company links) — NO save
// 2. User clicks "Easy Apply" → apply flow starts
// 3. User clicks "Submit application" → save triggered
// 4. Confirmation text appears → save triggered (only if apply flow active)

(function () {
  "use strict";

  function log(...args) {
    console.log("[CrossTrack]", ...args);
  }

  function generateJobId(company, role) {
    const str = (company + "|" + role).toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "job_" + Math.abs(hash).toString(36);
  }

  // ─── Save throttle — prevent saving same job within 120s ───
  const recentSaves = new Map();

  function alreadySaved(company, role) {
    const key = (company + "|" + role).toLowerCase();
    const now = Date.now();
    if (recentSaves.has(key) && now - recentSaves.get(key) < 120000) return true;
    recentSaves.set(key, now);
    return false;
  }

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.com")) return "indeed";
    if (host.includes("joinhandshake.com") || host.includes("handshake.com"))
      return "handshake";
    return "other";
  }

  // ─── Banners ───

  function showSuccessBanner(company, role, synced) {
    const existing = document.getElementById("crosstrack-success");
    if (existing) existing.remove();

    const syncText = synced
      ? "Saved &amp; synced to dashboard"
      : "Saved locally (sync pending)";
    const syncIcon = synced ? "&#9989;" : "&#9888;&#65039;";

    const banner = document.createElement("div");
    banner.id = "crosstrack-success";
    banner.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:2147483647;" +
      "background:linear-gradient(135deg,#10B981,#059669);" +
      "color:white;padding:16px 24px;border-radius:12px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,0.3);" +
      "animation:crosstrack-slide-in 0.4s ease-out;max-width:380px;" +
      "pointer-events:none;";
    banner.innerHTML =
      "<style>@keyframes crosstrack-slide-in{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}</style>" +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:20px;">&#10004;&#65039;</span>' +
      "<div>" +
      '<div style="font-weight:700;margin-bottom:2px;">Application Tracked!</div>' +
      '<div style="font-size:12px;opacity:0.9;">' +
      company + " &mdash; " + role + "</div>" +
      '<div style="font-size:11px;opacity:0.8;margin-top:2px;">' +
      syncIcon + " " + syncText +
      "</div></div></div>";
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.transition = "opacity 0.5s, transform 0.5s";
        banner.style.opacity = "0";
        banner.style.transform = "translateX(120%)";
        setTimeout(() => banner.remove(), 500);
      }
    }, 5000);
  }

  function showLoginBanner(company, role) {
    const existing = document.getElementById("crosstrack-login-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "crosstrack-login-banner";
    banner.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:2147483647;" +
      "background:linear-gradient(135deg,#EF4444,#DC2626);" +
      "color:white;padding:16px 24px;border-radius:12px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,0.3);" +
      "animation:crosstrack-slide-in 0.4s ease-out;max-width:400px;cursor:pointer;";
    banner.innerHTML =
      "<style>@keyframes crosstrack-slide-in{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}</style>" +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:20px;">&#128274;</span>' +
      "<div>" +
      '<div style="font-weight:700;margin-bottom:2px;">Please Login to CrossTrack</div>' +
      '<div style="font-size:12px;opacity:0.9;">Detected: ' + company + " &mdash; " + role + "</div>" +
      '<div style="font-size:11px;opacity:0.8;margin-top:4px;">Click the CrossTrack extension icon → Connect your account to start tracking.</div>' +
      "</div></div>";
    banner.addEventListener("click", () => banner.remove());
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.transition = "opacity 0.5s, transform 0.5s";
        banner.style.opacity = "0";
        banner.style.transform = "translateX(120%)";
        setTimeout(() => banner.remove(), 500);
      }
    }, 8000);
  }

  function showDuplicateWarning(existingApp, currentJob, score) {
    return new Promise((resolve) => {
      const existing = document.getElementById("crosstrack-warning");
      if (existing) existing.remove();

      const banner = document.createElement("div");
      banner.id = "crosstrack-warning";
      banner.style.cssText =
        "position:fixed;top:20px;right:20px;z-index:2147483647;" +
        "background:#FEF3C7;color:#92400E;padding:16px 24px;border-radius:12px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
        "font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,0.3);" +
        "max-width:400px;border:1px solid #F59E0B;";
      banner.innerHTML =
        "<div style='margin-bottom:10px;'>" +
        "<strong>&#9888;&#65039; Possible Duplicate</strong>" +
        "<p style='margin:4px 0;font-size:12px;'>You already applied to <strong>" +
        existingApp.company + "</strong> &mdash; " + existingApp.role + "</p></div>" +
        "<div style='display:flex;gap:8px;'>" +
        "<button id='crosstrack-save-anyway' style='padding:6px 14px;background:#F59E0B;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;'>Save Anyway</button>" +
        "<button id='crosstrack-skip' style='padding:6px 14px;background:white;color:#92400E;border:1px solid #D97706;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;'>Skip</button></div>";
      document.body.appendChild(banner);

      const timeout = setTimeout(() => {
        banner.remove();
        resolve({ action: "cancel" });
      }, 15000);

      document.getElementById("crosstrack-save-anyway").addEventListener("click", () => {
        clearTimeout(timeout);
        banner.remove();
        resolve({ action: "apply_anyway" });
      });

      document.getElementById("crosstrack-skip").addEventListener("click", () => {
        clearTimeout(timeout);
        banner.remove();
        resolve({ action: "cancel" });
      });
    });
  }

  // ─── Save Application ───

  let saveInProgress = false;
  let loginBannerShownRecently = false;

  async function saveApplication(jobData) {
    if (!jobData || !jobData.company || !jobData.role) {
      log("Cannot save — missing company or role");
      return;
    }

    if (alreadySaved(jobData.company, jobData.role)) {
      log("Already saved recently, skipping:", jobData.company);
      return;
    }

    if (saveInProgress) {
      log("Save already in progress, skipping");
      return;
    }

    saveInProgress = true;
    log("SAVING application:", jobData.company, "—", jobData.role);

    try {
      // Step 1: Check login
      try {
        const loginStatus = await chrome.runtime.sendMessage({ type: "CHECK_LOGIN" });
        if (!loginStatus || !loginStatus.loggedIn) {
          log("NOT LOGGED IN — showing login banner");
          saveInProgress = false;
          recentSaves.delete((jobData.company + "|" + jobData.role).toLowerCase());
          if (!loginBannerShownRecently) {
            loginBannerShownRecently = true;
            showLoginBanner(jobData.company, jobData.role);
            setTimeout(() => { loginBannerShownRecently = false; }, 60000);
          }
          return;
        }
      } catch (e) {
        log("Login check failed:", e.message);
      }

      // Step 2: Check duplicates
      try {
        const dupeResponse = await chrome.runtime.sendMessage({
          type: "CHECK_DUPLICATE",
          data: { company: jobData.company, role: jobData.role },
        });
        if (dupeResponse && dupeResponse.isDuplicate) {
          log("Duplicate found! Score:", dupeResponse.score);
          const choice = await showDuplicateWarning(
            dupeResponse.bestMatch, jobData, dupeResponse.score
          );
          if (choice.action === "cancel") {
            log("User skipped duplicate");
            saveInProgress = false;
            return;
          }
        }
      } catch (e) {
        log("Duplicate check failed, saving anyway:", e.message);
      }

      // Step 3: Save
      chrome.runtime.sendMessage(
        { type: "APPLICATION_DETECTED", data: jobData },
        (response) => {
          saveInProgress = false;
          if (chrome.runtime.lastError) {
            log("Save ERROR:", chrome.runtime.lastError.message);
            return;
          }
          if (response && response.saved) {
            log("SUCCESS! Saved:", jobData.company, "—", jobData.role, "| Synced:", response.synced);
            showSuccessBanner(jobData.company, jobData.role, response.synced);
          } else if (response && response.reason === "not_logged_in") {
            log("NOT LOGGED IN");
            recentSaves.delete((jobData.company + "|" + jobData.role).toLowerCase());
            if (!loginBannerShownRecently) {
              loginBannerShownRecently = true;
              showLoginBanner(jobData.company, jobData.role);
              setTimeout(() => { loginBannerShownRecently = false; }, 60000);
            }
          } else {
            log("Save returned:", JSON.stringify(response));
          }
        }
      );
    } catch (e) {
      saveInProgress = false;
      log("Save exception:", e.message);
    }
  }

  // ══════════════════════════════════════════════════
  // JOB EXTRACTION — Semantic HTML (stable, no CSS classes)
  // ══════════════════════════════════════════════════

  function extractLinkedInJob() {
    const h1s = document.querySelectorAll("h1");
    let role = null;
    for (const h1 of h1s) {
      const text = h1.textContent.trim();
      if (!text || text.length < 2 || text.length > 200) continue;
      if (
        text === "Jobs" || text === "LinkedIn" ||
        text.toLowerCase().includes("notification") ||
        text.toLowerCase().includes("messaging") ||
        text.toLowerCase().includes("my network") ||
        text.toLowerCase().includes("home")
      ) continue;
      role = text;
      break;
    }
    if (!role) return null;

    let company = null;
    const companyLinks = document.querySelectorAll('a[href*="/company/"]');
    for (const link of companyLinks) {
      const text = link.textContent.trim();
      if (text.length > 0 && text.length < 80 && text !== "Show more" && text !== "See more" && text !== "Show all" && !text.includes("\n")) {
        company = text.split("\n")[0].trim();
        break;
      }
    }
    if (!company) {
      const spans = document.querySelectorAll('span[class*="company"], div[class*="company"]');
      for (const el of spans) {
        const text = el.textContent.trim();
        if (text.length > 1 && text.length < 80) { company = text; break; }
      }
    }

    if (role && company) return { role, company, platform: "linkedin" };
    return null;
  }

  function extractIndeedJob() {
    const h1 = document.querySelector("h1");
    const role = h1 ? h1.textContent.trim() : null;
    let company = null;
    const companyEl = document.querySelector("[data-company-name]") || document.querySelector('[data-testid="company-name"]');
    if (companyEl) company = companyEl.getAttribute("data-company-name") || companyEl.textContent.trim();
    if (!company) { const cmpLink = document.querySelector('a[href*="/cmp/"]'); if (cmpLink) company = cmpLink.textContent.trim(); }
    if (role && company) return { role, company, platform: "indeed" };
    return null;
  }

  function extractHandshakeJob() {
    const h1 = document.querySelector("h1");
    const role = h1 ? h1.textContent.trim() : null;
    let company = null;
    const empLink = document.querySelector('a[href*="/employers/"]');
    if (empLink) company = empLink.textContent.trim();
    if (role && company) return { role, company, platform: "handshake" };
    return null;
  }

  function extractFromPageTitle() {
    const title = document.title;
    const host = window.location.hostname;
    if (host.includes("linkedin.com")) {
      const match = title.match(/^(?:\(\d+\)\s*)?(.+?)\s+at\s+(.+?)\s*[\|–—]/);
      if (match) return { role: match[1].trim(), company: match[2].trim(), platform: "linkedin" };
      const altMatch = title.match(/^(?:\(\d+\)\s*)?(.+?)\s*[-–—]\s*(.+?)\s*[\|–—]/);
      if (altMatch) return { role: altMatch[1].trim(), company: altMatch[2].trim(), platform: "linkedin" };
    }
    if (host.includes("indeed.com")) {
      const match = title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]/);
      if (match) return { role: match[1].trim(), company: match[2].trim(), platform: "indeed" };
    }
    if (host.includes("handshake.com") || host.includes("joinhandshake.com")) {
      const match = title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[\|–—]/);
      if (match) return { role: match[1].trim(), company: match[2].trim(), platform: "handshake" };
    }
    return null;
  }

  function extractCurrentJob() {
    const host = window.location.hostname;
    let job = null;
    if (host.includes("linkedin.com")) job = extractLinkedInJob();
    else if (host.includes("indeed.com")) job = extractIndeedJob();
    else if (host.includes("handshake.com") || host.includes("joinhandshake.com")) job = extractHandshakeJob();
    if (!job) job = extractFromPageTitle();
    return job;
  }

  // ══════════════════════════════════════════════════
  // JOB DETECTION — passive (detect only, never save)
  // ══════════════════════════════════════════════════

  let lastDetectedJob = null;
  let lastJobKey = "";

  function checkForNewJob() {
    const job = extractCurrentJob();
    if (!job) return null;

    const jobKey = (job.company + "|" + job.role).toLowerCase();
    if (jobKey !== lastJobKey) {
      lastJobKey = jobKey;
      lastDetectedJob = {
        jobId: generateJobId(job.company, job.role),
        company: job.company,
        role: job.role,
        platform: job.platform || detectPlatform(),
        url: window.location.href,
        location: job.location || "",
        appliedAt: new Date().toISOString(),
        status: "applied",
      };
      log("Job detected:", job.company, "—", job.role);
    }
    return lastDetectedJob;
  }

  setInterval(checkForNewJob, 1500);

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(checkForNewJob, 800);
    }
  }, 500);

  setTimeout(checkForNewJob, 1000);
  setTimeout(checkForNewJob, 3000);

  // ══════════════════════════════════════════════════
  // POSTMESSAGE BRIDGE — from injector.js (MAIN world)
  // ══════════════════════════════════════════════════

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "__CROSSTRACK_INTERCEPTED__") return;

    const { type, data } = event.data;

    if (type === "JOB_DETECTED") {
      lastDetectedJob = {
        jobId: generateJobId(data.company, data.role),
        company: data.company,
        role: data.role,
        platform: data.platform || detectPlatform(),
        url: window.location.href,
        location: data.location || "",
        appliedAt: new Date().toISOString(),
        status: "applied",
      };
      log("Job detected via injector:", data.company, "—", data.role);
    } else if (
      type === "LINKEDIN_APPLY" ||
      type === "INDEED_APPLY" ||
      type === "HANDSHAKE_APPLY"
    ) {
      // PerformanceObserver saw an apply API call — this is STRONG signal
      log("Apply API call detected via PerformanceObserver:", type);
      triggerSave("performanceobserver");
    }
  });

  // ══════════════════════════════════════════════════
  // APPLY FLOW STATE — the core gate
  // ══════════════════════════════════════════════════
  //
  // applyFlowActive = true ONLY after user clicks an Apply/Submit button.
  // ALL confirmation-based saves are gated behind this flag.
  // This prevents false saves from just viewing a previously-applied job.

  let applyFlowActive = false;
  let applyFlowTimeout = null;

  function startApplyFlow() {
    applyFlowActive = true;
    clearTimeout(applyFlowTimeout);
    applyFlowTimeout = setTimeout(() => {
      applyFlowActive = false;
      log("Apply flow expired (30s timeout)");
    }, 30000);
    log("Apply flow STARTED — now watching for confirmation");
  }

  function endApplyFlow() {
    applyFlowActive = false;
    clearTimeout(applyFlowTimeout);
  }

  // ══════════════════════════════════════════════════
  // UNIFIED SAVE TRIGGER — gated behind applyFlowActive
  // ══════════════════════════════════════════════════

  function triggerSave(source) {
    // PerformanceObserver is a strong signal (actual network request to apply endpoint)
    // so it bypasses the applyFlowActive gate
    const isStrongSignal = (source === "performanceobserver" || source === "submit-button-click");

    if (!applyFlowActive && !isStrongSignal) {
      log("triggerSave BLOCKED — apply flow not active (source:", source + ")");
      return;
    }

    log("triggerSave from:", source);

    let jobData = lastDetectedJob;
    if (!jobData) {
      const job = extractCurrentJob();
      if (job) {
        jobData = {
          jobId: generateJobId(job.company, job.role),
          company: job.company,
          role: job.role,
          platform: job.platform || detectPlatform(),
          url: window.location.href,
          location: job.location || "",
          appliedAt: new Date().toISOString(),
          status: "applied",
        };
        lastDetectedJob = jobData;
      }
    }

    if (jobData) {
      log("Saving:", jobData.company, "—", jobData.role, "(from " + source + ")");
      saveApplication(jobData);
      // End the apply flow after a successful save trigger
      // (prevents double-saves from backup triggers)
      setTimeout(() => endApplyFlow(), 3000);
    } else {
      log("No job data available (source:", source + ")");
    }
  }

  // ══════════════════════════════════════════════════
  // CONFIRMATION PHRASES — only used during active apply flow
  // ══════════════════════════════════════════════════
  //
  // REMOVED "you applied for this job" — LinkedIn shows this on ALL
  // previously applied jobs, causing false saves when just viewing.

  const CONFIRMATION_PHRASES = [
    "application sent",
    "your application was sent",
    "your application has been submitted",
    "application submitted",
    "successfully applied",
    "your resume has been submitted",
    "thank you for applying",
    "your application has been received",
    "application complete",
    "you have successfully applied",
  ];

  function textMatchesConfirmation(text) {
    const lower = text.toLowerCase();
    for (const phrase of CONFIRMATION_PHRASES) {
      if (lower.includes(phrase)) return phrase;
    }
    return null;
  }

  // ══════════════════════════════════════════════════
  // CLICK LISTENER — CAPTURING PHASE
  // ══════════════════════════════════════════════════

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("button, a, [role='button'], [type='submit'], input[type='submit']");
      if (!btn) return;

      const rawText = (btn.textContent || btn.value || btn.getAttribute("aria-label") || "").trim();
      const text = rawText.toLowerCase().replace(/\s+/g, " ");

      // "Easy Apply" or "Apply" button → start the flow (no save yet)
      if (
        text.includes("easy apply") ||
        text === "apply" ||
        text === "apply now" ||
        text === "apply for free" ||
        text === "apply on company site"
      ) {
        log("APPLY button clicked:", rawText);
        if (!lastDetectedJob) checkForNewJob();
        startApplyFlow();
        return; // Don't save — just start tracking
      }

      // "Submit application" or "Submit" → this is the FINAL step, trigger save
      if (
        text.includes("submit application") ||
        text.includes("send application") ||
        text.includes("submit your application")
      ) {
        log("FINAL SUBMIT clicked:", rawText);
        if (!lastDetectedJob) checkForNewJob();
        startApplyFlow(); // Ensure flow is active
        setTimeout(() => triggerSave("submit-button-click"), 2000);
        return;
      }

      // Generic "Submit" or "Done" — only save if we're in an apply flow
      if (
        (text === "submit" || text === "done") && applyFlowActive
      ) {
        log("Generic submit/done clicked during apply flow:", rawText);
        setTimeout(() => triggerSave("submit-button-click"), 2000);
        return;
      }

      // "Next" / "Review" buttons during apply flow — just keep tracking
      if (applyFlowActive && (text.includes("next") || text.includes("review"))) {
        log("Apply flow step:", rawText);
      }
    },
    true // CAPTURING PHASE — fires before stopPropagation
  );

  // ══════════════════════════════════════════════════
  // MUTATION OBSERVER — ONLY active during apply flow
  // ══════════════════════════════════════════════════

  function setupMutationObserver() {
    if (!document.body) {
      setTimeout(setupMutationObserver, 500);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      // GATE: only look for confirmations during an active apply flow
      if (!applyFlowActive) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const text = node.innerText || node.textContent || "";
          const match = textMatchesConfirmation(text);
          if (match) {
            log("CONFIRMATION in DOM:", match);
            triggerSave("mutation-observer");
            return;
          }
        }
        if (mutation.type === "characterData" || mutation.type === "attributes") {
          const text = (mutation.target.textContent || "").trim();
          const match = textMatchesConfirmation(text);
          if (match) {
            log("CONFIRMATION in changed node:", match);
            triggerSave("mutation-observer");
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-label", "aria-hidden"],
    });

    log("MutationObserver active (gated behind apply flow)");
  }

  setupMutationObserver();

  // ══════════════════════════════════════════════════
  // LINKEDIN EASY APPLY MODAL DETECTION
  // ══════════════════════════════════════════════════

  if (detectPlatform() === "linkedin") {
    setInterval(() => {
      // Detect Easy Apply modal opening
      const modal = document.querySelector(
        '[aria-labelledby*="easy-apply"], ' +
        '[class*="jobs-easy-apply"], ' +
        '[data-test-modal]'
      );
      if (modal && !applyFlowActive) {
        log("LinkedIn Easy Apply modal detected — starting flow");
        if (!lastDetectedJob) checkForNewJob();
        startApplyFlow();
      }

      // Check for post-submission confirmation IN the modal (only if apply flow active)
      if (applyFlowActive) {
        const dismissBtns = document.querySelectorAll(
          'button[aria-label*="Dismiss"], button[aria-label*="dismiss"]'
        );
        for (const btn of dismissBtns) {
          const parent = btn.closest('[role="dialog"], [class*="modal"], [class*="overlay"]');
          if (parent) {
            const parentText = parent.innerText || "";
            const match = textMatchesConfirmation(parentText);
            if (match) {
              log("CONFIRMATION in dismiss dialog:", match);
              triggerSave("linkedin-dismiss-dialog");
              return;
            }
          }
        }
      }
    }, 1000);
  }

  // ══════════════════════════════════════════════════
  // URL-BASED DETECTION — only during apply flow
  // ══════════════════════════════════════════════════

  setInterval(() => {
    if (!applyFlowActive) return; // GATED

    const url = window.location.href.toLowerCase();
    if (
      url.includes("post-apply") ||
      url.includes("thankyou") ||
      url.includes("application_submitted") ||
      url.includes("application-submitted") ||
      url.includes("apply/complete") ||
      url.includes("apply/success")
    ) {
      log("Post-apply URL detected:", url);
      triggerSave("post-apply-url");
    }
  }, 1000);

  // ══════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════

  log("=== CrossTrack v1.4 loaded on:", window.location.hostname, "===");
  log("Platform:", detectPlatform());
  log("RULE: Only saves when you APPLY — never from just viewing a job.");

  try {
    chrome.runtime.sendMessage({ type: "GET_APPLICATIONS" }, (response) => {
      if (chrome.runtime.lastError) {
        log("WARNING:", chrome.runtime.lastError.message);
      } else {
        log("Background OK. Apps:", (response && response.applications) ? response.applications.length : 0);
      }
    });
  } catch (e) {
    log("ERROR:", e.message);
  }
})();
