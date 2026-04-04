// ══════════════════════════════════════════════════
// CROSSTRACK INJECTOR — Runs in MAIN world
// ══════════════════════════════════════════════════
//
// STRATEGY: LinkedIn stores a reference to native fetch in a closure,
// so wrapping window.fetch doesn't work. Instead we use:
//
// 1. Semantic HTML extraction — <h1> for job title, <a href="/company/...">
//    for company name. These are accessibility-required elements that are
//    extremely stable across redesigns.
//
// 2. URL change detection — LinkedIn is an SPA, so we watch for URL changes
//    that include job IDs (currentJobId param changes).
//
// 3. PerformanceObserver — detect apply submission API calls (bulletproof).
//
// This approach has ZERO dependency on CSS classes, fetch wrapping, or
// API response parsing.

(function () {
  "use strict";

  const CROSSTRACK_MSG = "__CROSSTRACK_INTERCEPTED__";
  const PROCESSED_URLS = new Set();

  function post(type, data) {
    window.postMessage({ source: CROSSTRACK_MSG, type, data }, "*");
  }

  // ══════════════════════════════════════════════════
  // LINKEDIN JOB EXTRACTION — Semantic HTML
  // ══════════════════════════════════════════════════

  function extractLinkedInJob() {
    // Job title from <h1> — required for accessibility, very stable
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    const role = h1.textContent.trim();
    if (!role || role.length < 2 || role.length > 200) return null;

    // Company from <a href="/company/..."> link
    const companyLinks = document.querySelectorAll('a[href*="/company/"]');
    let company = null;
    for (const link of companyLinks) {
      const text = link.textContent.trim();
      if (text.length > 0 && text.length < 80 && text !== "Show more") {
        company = text;
        break;
      }
    }

    // Location — usually near company, in a span or div
    let location = "";
    try {
      // Look for location text near the h1 area — usually contains city, state
      const spans = document.querySelectorAll("span");
      for (const span of spans) {
        const text = span.textContent.trim();
        // Location patterns: "City, ST", "City, ST (Remote)", "United States (Remote)"
        if (
          text.length > 3 &&
          text.length < 80 &&
          (text.match(/\b[A-Z]{2}\b/) || text.includes("Remote") || text.includes("Hybrid") || text.includes("On-site")) &&
          !text.includes("http") &&
          !text.includes("@") &&
          !text.includes("benefit") &&
          !text.includes("ago")
        ) {
          location = text;
          break;
        }
      }
    } catch (e) {
      // Location extraction is best-effort
    }

    if (role && company) {
      return { role, company, location, platform: "linkedin" };
    }
    return null;
  }

  // ══════════════════════════════════════════════════
  // INDEED JOB EXTRACTION — Semantic HTML
  // ══════════════════════════════════════════════════

  function extractIndeedJob() {
    // Indeed job title in h1 or h2 with specific data attributes
    const h1 = document.querySelector("h1");
    const role = h1 ? h1.textContent.trim() : null;

    // Company — usually in a div/a with data-company-name or near the title
    let company = null;
    const companyEl =
      document.querySelector('[data-company-name]') ||
      document.querySelector('[data-testid="company-name"]');
    if (companyEl) {
      company = companyEl.getAttribute("data-company-name") || companyEl.textContent.trim();
    }
    if (!company) {
      // Fallback: links to /cmp/ (company pages)
      const cmpLink = document.querySelector('a[href*="/cmp/"]');
      if (cmpLink) company = cmpLink.textContent.trim();
    }

    if (role && company) {
      return { role, company, platform: "indeed", location: "" };
    }
    return null;
  }

  // ══════════════════════════════════════════════════
  // HANDSHAKE JOB EXTRACTION — Semantic HTML
  // ══════════════════════════════════════════════════

  function extractHandshakeJob() {
    const h1 = document.querySelector("h1");
    const role = h1 ? h1.textContent.trim() : null;

    let company = null;
    // Handshake uses /employers/ links
    const empLink = document.querySelector('a[href*="/employers/"]');
    if (empLink) company = empLink.textContent.trim();

    if (role && company) {
      return { role, company, platform: "handshake", location: "" };
    }
    return null;
  }

  // ══════════════════════════════════════════════════
  // PAGE TITLE FALLBACK — Works on direct job URLs
  // ══════════════════════════════════════════════════

  function extractFromPageTitle() {
    const title = document.title;
    const host = window.location.hostname;

    // LinkedIn direct job page: "Software Engineer at Google | LinkedIn"
    if (host.includes("linkedin.com")) {
      const match = title.match(/^(?:\(\d+\)\s*)?(.+?)\s+at\s+(.+?)\s*[\|–—]/);
      if (match) {
        return { role: match[1].trim(), company: match[2].trim(), platform: "linkedin", location: "" };
      }
    }

    // Indeed: "Role - Company - Location | Indeed.com"
    if (host.includes("indeed.com")) {
      const match = title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]/);
      if (match) {
        return { role: match[1].trim(), company: match[2].trim(), platform: "indeed", location: "" };
      }
    }

    // Handshake: "Role - Company | Handshake"
    if (host.includes("handshake.com") || host.includes("joinhandshake.com")) {
      const match = title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[\|–—]/);
      if (match) {
        return { role: match[1].trim(), company: match[2].trim(), platform: "handshake", location: "" };
      }
    }

    return null;
  }

  // ══════════════════════════════════════════════════
  // EXTRACT JOB — Try all strategies
  // ══════════════════════════════════════════════════

  function extractCurrentJob() {
    const host = window.location.hostname;

    let job = null;
    if (host.includes("linkedin.com")) job = extractLinkedInJob();
    else if (host.includes("indeed.com")) job = extractIndeedJob();
    else if (host.includes("handshake.com") || host.includes("joinhandshake.com")) job = extractHandshakeJob();

    // Fallback to page title
    if (!job) job = extractFromPageTitle();

    return job;
  }

  // ══════════════════════════════════════════════════
  // URL CHANGE WATCHER — Detect when user views a new job
  // ══════════════════════════════════════════════════

  let lastJobUrl = "";
  let lastJobKey = "";

  function checkForNewJob() {
    const url = window.location.href;
    const job = extractCurrentJob();

    if (!job) return;

    const jobKey = (job.company + "|" + job.role).toLowerCase();

    // Only post if this is a genuinely new job (different from last detected)
    if (jobKey !== lastJobKey) {
      lastJobKey = jobKey;
      lastJobUrl = url;
      console.log("[CrossTrack injector] Job detected:", job.company, "—", job.role);
      post("JOB_DETECTED", {
        company: job.company,
        role: job.role,
        location: job.location || "",
        platform: job.platform,
      });
    }
  }

  // Poll for job changes — handles SPA navigation and lazy-loaded content
  // The interval is lightweight since we just read a few DOM elements
  setInterval(checkForNewJob, 1500);

  // Also check on URL changes (SPA navigation)
  let lastUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Small delay to let new content load
      setTimeout(checkForNewJob, 800);
    }
  }, 500);

  // Initial check after page loads
  setTimeout(checkForNewJob, 2000);
  setTimeout(checkForNewJob, 4000);

  // ══════════════════════════════════════════════════
  // PERFORMANCE OBSERVER — Detect apply submissions
  // ══════════════════════════════════════════════════
  //
  // PerformanceObserver sees ALL network requests regardless of how
  // fetch/XHR is wrapped. We use it to detect apply API calls.

  try {
    const perfObserver = new PerformanceObserver(function (list) {
      for (const entry of list.getEntries()) {
        const url = entry.name;
        if (!url || PROCESSED_URLS.has(url)) continue;

        const host = window.location.hostname;

        if (host.includes("linkedin.com")) {
          if (
            url.includes("applicationsDash") ||
            url.includes("easyApply") ||
            url.includes("easy-apply") ||
            url.includes("onboardingApplication") ||
            url.includes("applyWithResume") ||
            url.includes("jobApplications") ||
            (url.includes("/voyager/api/") && url.includes("apply")) ||
            (url.includes("/voyager/api/") && url.includes("application")) ||
            (url.includes("graphql") && url.includes("apply"))
          ) {
            PROCESSED_URLS.add(url);
            console.log("[CrossTrack injector] LinkedIn APPLY detected via PerformanceObserver:", url);
            post("LINKEDIN_APPLY", { url: url });
          }
        }

        if (host.includes("indeed.com")) {
          if (
            url.includes("/applystart") ||
            url.includes("/indeedapply") ||
            url.includes("/ia/") ||
            (url.includes("/rpc/") && url.includes("apply"))
          ) {
            PROCESSED_URLS.add(url);
            console.log("[CrossTrack injector] Indeed apply detected via PerformanceObserver");
            post("INDEED_APPLY", { url: url });
          }
        }

        if (host.includes("joinhandshake.com") || host.includes("handshake.com")) {
          if (url.includes("/api/v1/applications")) {
            PROCESSED_URLS.add(url);
            console.log("[CrossTrack injector] Handshake apply detected via PerformanceObserver");
            post("HANDSHAKE_APPLY", { url: url });
          }
        }
      }
    });

    perfObserver.observe({ type: "resource", buffered: false });
    console.log("[CrossTrack injector] PerformanceObserver active");
  } catch (e) {
    console.log("[CrossTrack injector] PerformanceObserver not available:", e.message);
  }

  console.log("[CrossTrack injector] Active in MAIN world on", window.location.hostname);
})();
