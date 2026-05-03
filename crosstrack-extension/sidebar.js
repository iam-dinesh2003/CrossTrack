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
  let selectedResumeId = null; // set when user picks a resume

  // ── Main entry: called from content.js when a job is detected ──
  window.CrossTrackSidebar = {
    show(jobData) {
      currentJob = jobData;
      const newKey = (jobData.company + "|" + jobData.role).toLowerCase();
      const existing = document.getElementById(SIDEBAR_ID);
      if (existing) {
        if (existing.dataset.jobKey === newKey) return; // Same job — do nothing
        // Different job — update header + reset all sections
        existing.dataset.jobKey = newKey;
        updateJobInfo(jobData);
        sidebarState = "idle";
        selectedResumeId = null;
        resetSidebarSections();
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

  const PILL_ID = "crosstrack-reopen-pill";

  // ── Reopen pill — stays on page after X is clicked ──
  function showReopenPill(jobData) {
    if (document.getElementById(PILL_ID)) return; // already showing
    const pill = document.createElement("div");
    pill.id = PILL_ID;
    pill.className = "ct-reopen-pill";
    pill.title = "Reopen CrossTrack";
    pill.innerHTML = `<span class="ct-pill-icon">&#9989;</span><span class="ct-pill-label">CrossTrack</span>`;
    pill.addEventListener("click", () => {
      pill.remove();
      injectSidebar(jobData || currentJob);
    });
    document.body.appendChild(pill);
  }

  function removeReopenPill() {
    const pill = document.getElementById(PILL_ID);
    if (pill) pill.remove();
  }

  // ── Inject sidebar into page ──
  function injectSidebar(jobData) {
    removeReopenPill(); // clear pill if user reopens

    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = "ct-sidebar";
    sidebar.dataset.jobKey = (jobData.company + "|" + jobData.role).toLowerCase();

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
          <button class="ct-btn-icon" id="ct-refresh" title="Refresh">&#8635;</button>
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
            <select class="ct-resume-select" id="ct-resume-picker" style="display:none;">
              <option value="">Loading resumes...</option>
            </select>
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
          <a class="ct-footer__link" href="http://localhost:5173" target="_blank" rel="noopener">
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

    // Refresh — reset all sections and reload resume picker
    sidebar.querySelector("#ct-refresh").addEventListener("click", () => {
      sidebarState = "idle";
      selectedResumeId = null;
      window.__ctCachedJd = null; // clear stale JD cache
      resetSidebarSections();
    });

    // Close — remove sidebar but leave reopen pill
    sidebar.querySelector("#ct-close").addEventListener("click", () => {
      sidebar.classList.remove("ct-sidebar--visible");
      setTimeout(() => {
        sidebar.remove();
        showReopenPill(currentJob);
      }, 300);
    });

    // Load resume list for picker
    loadResumePicker();

    // Score button
    sidebar.querySelector("#ct-score-btn").addEventListener("click", handleScore);

    // Cover letter button
    sidebar.querySelector("#ct-coverletter-btn").addEventListener("click", handleCoverLetter);

    // Bullets button
    sidebar.querySelector("#ct-bullets-btn").addEventListener("click", handleTailorBullets);
  }

  // ── Resume picker loader ──

  async function loadResumePicker() {
    const picker = document.getElementById("ct-resume-picker");
    if (!picker) return;

    // Always make picker area visible so user knows it exists
    picker.style.display = "block";

    try {
      const loginStatus = await chrome.runtime.sendMessage({ type: "CHECK_LOGIN" });
      if (!loginStatus || !loginStatus.loggedIn) {
        picker.innerHTML = '<option value="">⚠ Not logged in — connect via extension icon</option>';
        return;
      }

      const resp = await chrome.runtime.sendMessage({ type: "GET_RESUMES" });

      if (!resp || resp.error) {
        picker.innerHTML = `<option value="">⚠ ${resp?.error || "Could not load resumes — reload extension"}</option>`;
        return;
      }

      if (!resp.resumes || resp.resumes.length === 0) {
        picker.innerHTML = '<option value="">No resumes uploaded — add one in Dashboard</option>';
        return;
      }

      const resumes = resp.resumes;
      picker.innerHTML = resumes.map(r =>
        `<option value="${r.id}" ${r.isDefault ? "selected" : ""}>${escapeHtml(r.name || r.fileName || "Resume")}</option>`
      ).join("");

      // Set default selection
      const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
      selectedResumeId = defaultResume ? String(defaultResume.id) : null;
      picker.value = selectedResumeId || "";

      picker.addEventListener("change", () => {
        selectedResumeId = picker.value || null;
      });
    } catch (e) {
      picker.innerHTML = '<option value="">⚠ Error loading resumes — reload extension</option>';
    }
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
    setLoading("ct-score-content", "Extracting job description...");

    try {
      // Use pre-cached JD if available (set 2s after job switch)
      let jd = window.__ctCachedJd || extractJobDescription();
      window.__ctCachedJd = null; // consume cache

      // If JD is too short, LinkedIn SPA may not have rendered it yet — retry
      if (!jd || jd.trim().length < 50) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          setLoading("ct-score-content", `Waiting for job description to load... (${attempt}/3)`);
          await new Promise(r => setTimeout(r, 1000));
          jd = extractJobDescription();
          if (jd && jd.trim().length >= 50) break;
        }
      }

      const charCount = jd ? jd.trim().length : 0;
      if (charCount < 50) {
        // JD extraction failed — show char count so user understands what happened
        const scoreContent = document.getElementById("ct-score-content");
        scoreContent.innerHTML = `
          <div style="font-size:12px;color:#e17055;line-height:1.5;padding:4px 0;">
            ⚠ Couldn't read the job description (${charCount} chars detected).<br>
            <span style="color:#636e72;margin-top:4px;display:block;">
              Scroll down on the page to fully load the job posting, then click Try Again.
            </span>
          </div>
          <button class="ct-btn ct-btn--primary" id="ct-score-retry" style="margin-top:8px;">
            &#128202; Try Again
          </button>`;
        // Use querySelector scoped to scoreContent — safer than getElementById after re-render
        scoreContent.querySelector("#ct-score-retry").addEventListener("click", handleScore);
        sidebarState = "idle";
        return;
      }

      setLoading("ct-score-content", "Scoring your resume...");

      const response = await chrome.runtime.sendMessage({
        type: "GET_ATS_SCORE",
        data: {
          jobDescription: jd,
          company: currentJob.company,
          role: currentJob.role,
          resumeId: selectedResumeId || null,
        },
      });

      if (response && response.score !== undefined) {
        window.CrossTrackSidebar.updateScore(response);
        // Show which resume was used
        if (response.resumeName) {
          const scoreEl = document.getElementById("ct-score-content");
          if (scoreEl) {
            const label = document.createElement("div");
            label.style.cssText = "font-size:10px;color:#b2bec3;margin-top:6px;text-align:center;";
            label.textContent = `Resume: ${response.resumeName}`;
            scoreEl.appendChild(label);
          }
        }
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

  // ── Reset all AI sections to initial state (called on job switch) ──
  function resetSidebarSections() {
    const scoreContent = document.getElementById("ct-score-content");
    if (scoreContent) {
      scoreContent.innerHTML = `
        <div class="ct-hint">Score your resume against this job description to see how well you match.</div>
        <select class="ct-resume-select" id="ct-resume-picker"><option value="">Loading resumes...</option></select>
        <button class="ct-btn ct-btn--primary" id="ct-score-btn">&#128202; Score My Resume</button>`;
      scoreContent.querySelector("#ct-score-btn").addEventListener("click", handleScore);
      loadResumePicker();
    }
    const clContent = document.getElementById("ct-coverletter-content");
    if (clContent) {
      clContent.innerHTML = `<button class="ct-btn ct-btn--secondary" id="ct-coverletter-btn">&#128221; Generate Cover Letter</button>`;
      clContent.querySelector("#ct-coverletter-btn").addEventListener("click", handleCoverLetter);
    }
    const bulletsContent = document.getElementById("ct-bullets-content");
    if (bulletsContent) {
      bulletsContent.innerHTML = `
        <div class="ct-hint">AI rewrites your top 3 resume bullets to match this role's keywords.</div>
        <button class="ct-btn ct-btn--secondary" id="ct-bullets-btn">&#9999;&#65039; Tailor My Bullets</button>`;
      bulletsContent.querySelector("#ct-bullets-btn").addEventListener("click", handleTailorBullets);
    }

    // Pre-warm JD extraction — LinkedIn SPA takes ~1-2s to render the description panel
    // Schedule background extraction so it's ready by the time user clicks Score
    window.__ctCachedJd = null;
    setTimeout(() => {
      const preJd = extractJobDescription();
      if (preJd && preJd.trim().length >= 50) {
        window.__ctCachedJd = preJd;
      }
    }, 2000);
  }

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
      // LinkedIn's job description panel — try class-pattern selectors first
      // (LinkedIn uses hashed class names but "jobs-description" stays stable)
      const linkedinSelectors = [
        '[class*="jobs-description-content__text"]',
        '[class*="jobs-description__content"]',
        '[class*="jobs-description"]',
        '[class*="job-details-about-the-job"]',
        '[class*="job-details-jobs-unified-top-card"]',
        // fallback: the active job detail pane (right panel on /jobs/search/)
        '[class*="job-view-layout"] [class*="description"]',
        '[class*="jobs-details__main-content"]',
        // last resort: any section/div with "About the job" text nearby
        'section[class*="description"]',
      ];
      for (const sel of linkedinSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 100) {
          return el.textContent.trim().substring(0, 4000);
        }
      }
      // Final fallback: find largest div that contains job signal words,
      // but exclude navigation/header/sidebar/feed elements
      const signalWords = ["responsibilities", "requirements", "qualifications",
                           "about the role", "what you'll do", "you will", "skills",
                           "experience", "we are looking", "minimum qualifications"];
      const candidates = Array.from(document.querySelectorAll("div, section"))
        .filter(el => {
          if (el.closest("nav, header, footer, [role='navigation'], aside, [class*='feed'], [class*='sidebar'], [class*='header'], [class*='nav']")) return false;
          const txt = el.textContent.trim();
          if (txt.length < 200 || txt.length > 20000) return false;
          return signalWords.some(w => txt.toLowerCase().includes(w));
        })
        .sort((a, b) => a.textContent.length - b.textContent.length); // smallest matching = most specific
      if (candidates.length > 0) {
        return candidates[0].textContent.trim().substring(0, 4000);
      }
    }

    if (host.includes("indeed.com")) {
      const el = document.querySelector('[id="jobDescriptionText"]') ||
                 document.querySelector("article");
      if (el) return el.textContent.trim().substring(0, 4000);
    }

    if (host.includes("handshake.com") || host.includes("joinhandshake.com")) {
      const el = document.querySelector('[data-hook="job-description"]') ||
                 document.querySelector("article") ||
                 document.querySelector("main section:nth-of-type(2)");
      if (el) return el.textContent.trim().substring(0, 4000);
    }

    // Ashby HQ (ashbyhq.com, or company sites powered by Ashby)
    if (host.includes("ashbyhq.com")) {
      const selectors = [
        '[data-testid="job-description"]',
        '[class*="JobPosting"]',
        '[class*="job-posting"]',
        '[class*="posting-description"]',
        'main [class*="description"]',
        'main section',
        'main article',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 200) {
          return el.textContent.trim().substring(0, 4000);
        }
      }
    }

    // Greenhouse
    if (host.includes("greenhouse.io")) {
      const el = document.querySelector('#content') ||
                 document.querySelector('.job-post') ||
                 document.querySelector('[id*="content"]');
      if (el && el.textContent.trim().length > 200) {
        return el.textContent.trim().substring(0, 4000);
      }
    }

    // Lever
    if (host.includes("lever.co")) {
      const el = document.querySelector('.posting-description') ||
                 document.querySelector('[class*="posting"]') ||
                 document.querySelector('main');
      if (el && el.textContent.trim().length > 200) {
        return el.textContent.trim().substring(0, 4000);
      }
    }

    // Workday
    if (host.includes("workday.com") || host.includes("myworkdayjobs.com")) {
      const el = document.querySelector('[data-automation-id="jobPostingDescription"]') ||
                 document.querySelector('[class*="jobDescription"]') ||
                 document.querySelector('article');
      if (el && el.textContent.trim().length > 200) {
        return el.textContent.trim().substring(0, 4000);
      }
    }

    // ── Smart generic fallback ──
    // Find the richest text block that looks like a job description.
    // Exclude navigation, header, footer, and sidebar elements.

    // Strategy 1: look for elements with job-description signal words
    const signalWords = ["responsibilities", "requirements", "qualifications",
                         "about the role", "about us", "what you'll", "you will",
                         "experience", "skills", "we are looking"];

    const allDivs = Array.from(document.querySelectorAll("article, section, main, div"))
      .filter(el => {
        // Skip navigation, header, footer UI chrome
        if (el.closest("nav, header, footer, [role='navigation'], [role='banner'], [role='contentinfo']")) return false;
        if (el.tagName === "HEADER" || el.tagName === "NAV" || el.tagName === "FOOTER") return false;
        const txt = el.textContent.trim();
        return txt.length > 400;
      });

    // Try to find an element containing signal words
    const signalMatch = allDivs.find(el => {
      const txt = el.textContent.toLowerCase();
      return signalWords.some(w => txt.includes(w));
    });

    if (signalMatch) {
      // Find the SMALLEST element that still contains the signal words
      // (avoids grabbing the entire page body)
      const children = Array.from(signalMatch.querySelectorAll("div, section, article"))
        .filter(el => {
          const txt = el.textContent.trim();
          if (txt.length < 400) return false;
          return signalWords.some(w => txt.toLowerCase().includes(w));
        });
      const best = children.length > 0
        ? children[children.length - 1]  // smallest matching child
        : signalMatch;
      return best.textContent.trim().substring(0, 4000);
    }

    // Strategy 2: largest content block excluding nav/header/footer
    const candidates = allDivs.sort((a, b) => b.textContent.length - a.textContent.length);
    if (candidates.length > 0) return candidates[0].textContent.trim().substring(0, 4000);

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
