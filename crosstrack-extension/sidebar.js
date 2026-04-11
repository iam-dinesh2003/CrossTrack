// ══════════════════════════════════════════════════
// CrossTrack ATS Sidebar — Injected panel on job pages
// ══════════════════════════════════════════════════
//
// Shows up when a job is detected on LinkedIn/Indeed/Handshake.
// Lets users score their resume against the JD, generate a cover letter,
// and tailor resume bullets — all at apply-time.

(function () {
  "use strict";

  const SIDEBAR_ID = "crosstrack-ats-sidebar";

  // ── State ──
  let currentJob = null;
  let sidebarState = "idle"; // idle | scoring | scored | generating | done

  // ── Main entry: called from content.js when a job is detected ──
  window.CrossTrackSidebar = {
    show(jobData) {
      currentJob = jobData;
      if (document.getElementById(SIDEBAR_ID)) {
        updateJobInfo(jobData);
        return;
      }
      injectSidebar(jobData);
    },
    hide() {
      const el = document.getElementById(SIDEBAR_ID);
      if (el) el.remove();
    },
    updateScore(matchResult) {
      renderScoreSection(matchResult);
    },
    updateCoverLetter(text) {
      renderCoverLetterSection(text);
    },
    updateTailoredBullets(result) {
      renderBulletsSection(result);
    },
  };

  // ── Inject sidebar into page ──
  function injectSidebar(jobData) {
    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = "ct-sidebar";

    sidebar.innerHTML = buildSidebarHTML(jobData);
    document.body.appendChild(sidebar);
    attachSidebarEvents(sidebar);

    // Slide in
    requestAnimationFrame(() => {
      sidebar.classList.add("ct-sidebar--visible");
    });
  }

  function buildSidebarHTML(jobData) {
    return `
      <div class="ct-sidebar__header">
        <div class="ct-sidebar__logo">
          <span class="ct-sidebar__logo-icon">&#9989;</span>
          <span class="ct-sidebar__logo-text">CrossTrack</span>
        </div>
        <div class="ct-sidebar__controls">
          <button class="ct-btn-icon" id="ct-minimize" title="Minimize">&#8722;</button>
          <button class="ct-btn-icon" id="ct-close" title="Close">&#10005;</button>
        </div>
      </div>

      <div class="ct-sidebar__body" id="ct-body">
        <div class="ct-job-info" id="ct-job-info">
          <div class="ct-job-info__role" id="ct-job-role">${escapeHtml(jobData.role)}</div>
          <div class="ct-job-info__company" id="ct-job-company">${escapeHtml(jobData.company)}</div>
        </div>

        <div class="ct-section" id="ct-score-section">
          <div class="ct-section__title">Resume Match</div>
          <div class="ct-section__content" id="ct-score-content">
            <div class="ct-hint">Score your resume against this job description to see how well you match.</div>
            <button class="ct-btn ct-btn--primary" id="ct-score-btn">
              &#128202; Score My Resume
            </button>
          </div>
        </div>

        <div class="ct-section" id="ct-coverletter-section">
          <div class="ct-section__title">Cover Letter</div>
          <div class="ct-section__content" id="ct-coverletter-content">
            <button class="ct-btn ct-btn--secondary" id="ct-coverletter-btn">
              &#128221; Generate Cover Letter
            </button>
          </div>
        </div>

        <div class="ct-section" id="ct-bullets-section">
          <div class="ct-section__title">Tailor Resume Bullets</div>
          <div class="ct-section__content" id="ct-bullets-content">
            <div class="ct-hint">AI rewrites your top 3 resume bullets to match this role's keywords.</div>
            <button class="ct-btn ct-btn--secondary" id="ct-bullets-btn">
              &#9999;&#65039; Tailor My Bullets
            </button>
          </div>
        </div>

        <div class="ct-footer">
          <a class="ct-footer__link" href="https://crosstrack-production.up.railway.app" target="_blank" rel="noopener">
            Open Dashboard &#10132;
          </a>
        </div>
      </div>

      <div class="ct-sidebar__minimized" id="ct-minimized-bar" style="display:none;">
        <span class="ct-sidebar__logo-icon">&#9989;</span>
        <button class="ct-btn-icon" id="ct-expand" title="Expand">+</button>
      </div>
    `;
  }

  function attachSidebarEvents(sidebar) {
    // Minimize / Expand
    sidebar.querySelector("#ct-minimize").addEventListener("click", () => {
      document.getElementById("ct-body").style.display = "none";
      document.getElementById("ct-minimized-bar").style.display = "flex";
    });
    sidebar.querySelector("#ct-expand").addEventListener("click", () => {
      document.getElementById("ct-body").style.display = "flex";
      document.getElementById("ct-minimized-bar").style.display = "none";
    });

    // Close
    sidebar.querySelector("#ct-close").addEventListener("click", () => {
      sidebar.classList.remove("ct-sidebar--visible");
      setTimeout(() => sidebar.remove(), 300);
    });

    // Score button
    sidebar.querySelector("#ct-score-btn").addEventListener("click", handleScore);

    // Cover letter button
    sidebar.querySelector("#ct-coverletter-btn").addEventListener("click", handleCoverLetter);

    // Bullets button
    sidebar.querySelector("#ct-bullets-btn").addEventListener("click", handleTailorBullets);
  }

  // ── Button handlers ──

  async function handleScore() {
    const btn = document.getElementById("ct-score-btn");
    if (!btn || sidebarState === "scoring") return;

    // Check login
    try {
      const loginStatus = await chrome.runtime.sendMessage({ type: "CHECK_LOGIN" });
      if (!loginStatus || !loginStatus.loggedIn) {
        showNotLoggedIn("ct-score-content");
        return;
      }
    } catch (e) { return; }

    sidebarState = "scoring";
    setLoading("ct-score-content", "Analyzing your resume...");

    try {
      const jd = extractJobDescription();
      const response = await chrome.runtime.sendMessage({
        type: "GET_ATS_SCORE",
        data: { jobDescription: jd, company: currentJob.company, role: currentJob.role },
      });

      if (response && response.score !== undefined) {
        window.CrossTrackSidebar.updateScore(response);
        sidebarState = "scored";
      } else if (response && response.error) {
        showError("ct-score-content", response.error);
        sidebarState = "idle";
      } else {
        showError("ct-score-content", "Could not score resume. Please try again.");
        sidebarState = "idle";
      }
    } catch (e) {
      showError("ct-score-content", "Error communicating with extension.");
      sidebarState = "idle";
    }
  }

  async function handleCoverLetter() {
    const btn = document.getElementById("ct-coverletter-btn");
    if (!btn || btn.disabled) return;

    try {
      const loginStatus = await chrome.runtime.sendMessage({ type: "CHECK_LOGIN" });
      if (!loginStatus || !loginStatus.loggedIn) {
        showNotLoggedIn("ct-coverletter-content");
        return;
      }
    } catch (e) { return; }

    btn.disabled = true;
    setLoading("ct-coverletter-content", "Writing your cover letter...");

    try {
      const jd = extractJobDescription();
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_COVER_LETTER",
        data: { jobDescription: jd, company: currentJob.company, role: currentJob.role },
      });

      if (response && response.coverLetter) {
        window.CrossTrackSidebar.updateCoverLetter(response.coverLetter);
      } else {
        showError("ct-coverletter-content", response?.error || "Failed to generate cover letter.");
        if (btn) btn.disabled = false;
      }
    } catch (e) {
      showError("ct-coverletter-content", "Error generating cover letter.");
      if (btn) btn.disabled = false;
    }
  }

  async function handleTailorBullets() {
    const btn = document.getElementById("ct-bullets-btn");
    if (!btn || btn.disabled) return;

    try {
      const loginStatus = await chrome.runtime.sendMessage({ type: "CHECK_LOGIN" });
      if (!loginStatus || !loginStatus.loggedIn) {
        showNotLoggedIn("ct-bullets-content");
        return;
      }
    } catch (e) { return; }

    btn.disabled = true;
    setLoading("ct-bullets-content", "Tailoring your resume bullets...");

    try {
      const jd = extractJobDescription();
      const response = await chrome.runtime.sendMessage({
        type: "TAILOR_RESUME_BULLETS",
        data: { jobDescription: jd },
      });

      if (response && response.tailoredBullets) {
        window.CrossTrackSidebar.updateTailoredBullets(response);
      } else {
        showError("ct-bullets-content", response?.error || "Failed to tailor bullets.");
        if (btn) btn.disabled = false;
      }
    } catch (e) {
      showError("ct-bullets-content", "Error tailoring bullets.");
      if (btn) btn.disabled = false;
    }
  }

  // ── Render sections ──

  function renderScoreSection(result) {
    const container = document.getElementById("ct-score-content");
    if (!container) return;

    const score = result.score || 0;
    const verdict = result.verdict || "";
    const color = score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
    const label = verdict.replace(/_/g, " ");

    const missing = (result.missingSkills || []).slice(0, 5);
    const matching = (result.matchingSkills || []).slice(0, 5);

    container.innerHTML = `
      <div class="ct-score-ring" style="--score-color:${color}">
        <div class="ct-score-ring__value" style="color:${color}">${score}</div>
        <div class="ct-score-ring__label">${label}</div>
      </div>

      ${matching.length ? `
        <div class="ct-chips-group">
          <div class="ct-chips-label">&#10003; Matching</div>
          <div class="ct-chips">
            ${matching.map(s => `<span class="ct-chip ct-chip--green">${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>` : ""}

      ${missing.length ? `
        <div class="ct-chips-group">
          <div class="ct-chips-label">&#9888; Missing</div>
          <div class="ct-chips">
            ${missing.map(s => `<span class="ct-chip ct-chip--red">${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>` : ""}

      ${result.summary ? `<div class="ct-summary">${escapeHtml(result.summary)}</div>` : ""}
    `;
  }

  function renderCoverLetterSection(text) {
    const container = document.getElementById("ct-coverletter-content");
    if (!container) return;

    container.innerHTML = `
      <div class="ct-textarea-wrapper">
        <textarea class="ct-textarea" id="ct-cl-text" readonly>${escapeHtml(text)}</textarea>
      </div>
      <div class="ct-action-row">
        <button class="ct-btn ct-btn--small" id="ct-cl-copy">&#128203; Copy</button>
        <button class="ct-btn ct-btn--small ct-btn--secondary" id="ct-cl-regen">&#8635; Regenerate</button>
      </div>
    `;

    document.getElementById("ct-cl-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("ct-cl-copy");
        if (btn) { btn.textContent = "&#10003; Copied!"; setTimeout(() => { btn.innerHTML = "&#128203; Copy"; }, 2000); }
      });
    });
    document.getElementById("ct-cl-regen").addEventListener("click", () => {
      container.innerHTML = `<button class="ct-btn ct-btn--secondary" id="ct-coverletter-btn">&#128221; Generate Cover Letter</button>`;
      document.getElementById("ct-coverletter-btn").addEventListener("click", handleCoverLetter);
    });
  }

  function renderBulletsSection(result) {
    const container = document.getElementById("ct-bullets-content");
    if (!container) return;

    const bullets = result.tailoredBullets || [];
    const keywords = (result.keywordsAdded || []).slice(0, 4);
    const tip = result.tip || "";

    container.innerHTML = `
      <div class="ct-bullets-list">
        ${bullets.map((b, i) => `
          <div class="ct-bullet-item">
            <span class="ct-bullet-num">${i + 1}</span>
            <div class="ct-bullet-text" contenteditable="false">${escapeHtml(b)}</div>
            <button class="ct-btn-copy-bullet" title="Copy" data-text="${escapeHtml(b)}">&#128203;</button>
          </div>`).join("")}
      </div>

      ${keywords.length ? `
        <div class="ct-chips-group">
          <div class="ct-chips-label">&#128276; Keywords added</div>
          <div class="ct-chips">
            ${keywords.map(k => `<span class="ct-chip ct-chip--blue">${escapeHtml(k)}</span>`).join("")}
          </div>
        </div>` : ""}

      ${tip ? `<div class="ct-tip">&#128161; ${escapeHtml(tip)}</div>` : ""}

      <button class="ct-btn ct-btn--small ct-btn--secondary" id="ct-copy-all-bullets">&#128203; Copy All</button>
    `;

    // Individual copy buttons
    container.querySelectorAll(".ct-btn-copy-bullet").forEach(btn => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.text);
        btn.textContent = "✓";
        setTimeout(() => { btn.textContent = "📋"; }, 1500);
      });
    });

    // Copy all
    document.getElementById("ct-copy-all-bullets").addEventListener("click", () => {
      const allText = bullets.map((b, i) => `${i + 1}. ${b}`).join("\n");
      navigator.clipboard.writeText(allText);
      const copyAllBtn = document.getElementById("ct-copy-all-bullets");
      if (copyAllBtn) { copyAllBtn.textContent = "✓ Copied!"; setTimeout(() => { copyAllBtn.textContent = "📋 Copy All"; }, 2000); }
    });
  }

  // ── UI helpers ──

  function updateJobInfo(jobData) {
    const roleEl = document.getElementById("ct-job-role");
    const companyEl = document.getElementById("ct-job-company");
    if (roleEl) roleEl.textContent = jobData.role;
    if (companyEl) companyEl.textContent = jobData.company;
  }

  function setLoading(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="ct-loading">
        <div class="ct-spinner"></div>
        <span>${message}</span>
      </div>`;
  }

  function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="ct-error">&#9888; ${escapeHtml(message)}</div>`;
  }

  function showNotLoggedIn(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="ct-not-logged-in">
        &#128274; Not connected to CrossTrack.<br>
        <small>Click the extension icon to log in.</small>
      </div>`;
  }

  // ── Job description extraction ──
  // Uses semantic/stable selectors — NOT fragile class names

  function extractJobDescription() {
    const host = window.location.hostname;

    if (host.includes("linkedin.com")) {
      // LinkedIn: job description is in an article or a section with a stable data attribute
      const selectors = [
        "[data-job-id] ~ * article",
        "article",
        "[class*='description'] div",
        "section section",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 100) {
          return el.textContent.trim().substring(0, 3000);
        }
      }
    }

    if (host.includes("indeed.com")) {
      const el = document.querySelector('[id="jobDescriptionText"]') ||
                 document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.closest("div")?.nextElementSibling ||
                 document.querySelector("article");
      if (el) return el.textContent.trim().substring(0, 3000);
    }

    if (host.includes("handshake.com") || host.includes("joinhandshake.com")) {
      const el = document.querySelector('[data-hook="job-description"]') ||
                 document.querySelector("article") ||
                 document.querySelector("main section:nth-of-type(2)");
      if (el) return el.textContent.trim().substring(0, 3000);
    }

    // Generic fallback: largest text block on page
    const candidates = Array.from(document.querySelectorAll("article, section, main div"))
      .filter(el => el.textContent.trim().length > 200)
      .sort((a, b) => b.textContent.length - a.textContent.length);
    if (candidates.length > 0) return candidates[0].textContent.trim().substring(0, 3000);

    return "";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

})();
