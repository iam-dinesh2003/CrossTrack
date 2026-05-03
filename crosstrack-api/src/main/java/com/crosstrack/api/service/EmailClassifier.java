package com.crosstrack.api.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.select.Elements;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Email Classification Engine for CrossTrack.
 *
 * STRICT Pipeline — only classifies emails that are clearly job-related:
 *   1. REJECT — Skip known non-job senders (newsletters, finance, social)
 *   2. CLASSIFY — Must match a specific status phrase (APPLIED, INTERVIEW, REJECTED, OFFER)
 *   3. EXTRACT — Pull out company name and role from subject/body
 *   4. DETECT PLATFORM — Determine which job portal sent it
 *
 * Key principle: It's better to MISS a job email than to WRONGLY classify a non-job email.
 */
@Component
@Slf4j
public class EmailClassifier {

    // ═══════════════════════════════════════════════════
    // DATA CLASSES
    // ═══════════════════════════════════════════════════

    @Data
    @Builder
    @AllArgsConstructor
    public static class ClassificationResult {
        private boolean jobRelated;
        private String status;        // APPLIED, INTERVIEW, REJECTED, OFFER, null
        private String company;
        private String role;
        private String platform;      // LINKEDIN, INDEED, GREENHOUSE, WORKDAY, COMPANY_DIRECT, etc.
        private double confidence;    // 0.0 - 1.0
        private LocalDateTime interviewDate; // Parsed from interview invitation emails
        private String applicationUrl;       // Extracted from email body links
    }

    // ═══════════════════════════════════════════════════
    // STEP 0: MULTI-STEP FILTER — Block newsletters, coaches, non-job emails
    // ═══════════════════════════════════════════════════
    //
    // 3-layer filtering system:
    //   Layer A: Newsletter header check (List-Unsubscribe = newsletter)
    //   Layer B: Blacklist (blocked senders, subjects, domains)
    //   Layer C: Intent check (success phrase must be in first 200 chars)

    // ── Layer B: Blacklisted senders (substring match on From header) ──
    private static final List<String> BLOCKED_SENDERS = List.of(
        // Finance / Investment
        "groww", "zerodha", "kite", "upstox", "angelone", "angel one",
        "paytm money", "smallcase", "coin by zerodha",
        "nsdl", "cdsl", "moneycontrol",
        // Social / Non-job LinkedIn
        "messages-noreply@linkedin.com",
        // Shopping / Misc
        "flipkart", "myntra", "swiggy", "zomato",
        // Career coaches / Motivational content creators
        "yudi",
        "career coach", "career mentor", "job coach",
        "career counselor", "career guidance"
    );

    // ── Layer B: Blacklisted sender domains (newsletter/coaching platforms) ──
    private static final List<String> EXCLUDED_DOMAINS = List.of(
        // Newsletter platforms
        "substack.com", "beehiiv.com", "convertkit.com", "mailchimp.com",
        "sendinblue.com", "constantcontact.com", "campaign-archive.com",
        "hashnode.com", "medium.com", "revue.email", "buttondown.email",
        "ghost.io", "tinyletter.com",
        // Career coaching platforms
        "teachable.com", "thinkific.com", "kajabi.com", "podia.com",
        "gumroad.com", "carrd.co",
        // Mass email senders
        "sendgrid.net", "mailgun.org", "amazonses.com"
    );

    private static final List<String> BLOCKED_SUBJECTS = List.of(
        "digest", "newsletter", "daily brief", "weekly update",
        "market update", "stock", "portfolio", "ipo",
        "mutual fund", "dividend", "trading",
        "invoice", "receipt",
        "posted:", "commented:", "shared a post", "endorsed you",
        "new connection", "invitation to connect",
        "prize", "contest",
        // Career coaching / Motivational content
        "success story", "how i got", "how he got", "how she got",
        "panic attack", "landed a job", "landed the job",
        "my journey", "career transformation", "from rejection to",
        "got hired at", "i got the offer",
        "yudi"
    );

    // ── SUCCESS_PHRASES — Must appear in first 200 chars of body for intent check ──
    // These indicate REAL job correspondence, not just keywords buried in a newsletter
    private static final List<String> SUCCESS_PHRASES = List.of(
        "thank you for applying",
        "thanks for applying",
        "application received",
        "application has been submitted",
        "we received your application",
        "we have received your application",
        "your application for",
        "your application to",
        "you applied to",
        "you recently applied",
        "application confirmation",
        "we will not be moving forward",
        "we regret to inform",
        "unfortunately, we",
        "not selected for",
        "we'd like to schedule an interview",
        "interview scheduled",
        "offer letter",
        "offer of employment",
        "we are pleased to offer",
        "next steps for your application",
        "we were impressed by your application",
        "move forward with your application"
    );

    /**
     * Layer A: Check if email has List-Unsubscribe header → newsletter, skip it.
     * Exception: ATS platforms (greenhouse, lever, etc.) sometimes include unsubscribe headers
     * in legitimate job emails, so we whitelist those.
     */
    public boolean isNewsletter(String from, boolean hasUnsubscribeHeader) {
        if (!hasUnsubscribeHeader) return false;

        // ATS senders with unsubscribe headers are still legitimate
        String fromLower = from.toLowerCase();
        for (String ats : ATS_SENDERS) {
            if (fromLower.contains(ats)) return false;
        }

        // If it has List-Unsubscribe and is NOT from a known ATS → newsletter
        log.info("[EmailClassifier] NEWSLETTER detected (List-Unsubscribe header): {}", from);
        return true;
    }

    /**
     * Layer B: Check sender against blacklists and excluded domains.
     */
    private boolean isBlockedEmail(String from, String subject) {
        String fromLower = from.toLowerCase();
        String subjectLower = subject.toLowerCase();

        // Check blocked senders
        for (String blocked : BLOCKED_SENDERS) {
            if (fromLower.contains(blocked)) {
                log.debug("[EmailClassifier] BLOCKED sender: {} (matched: {})", from, blocked);
                return true;
            }
        }

        // Check excluded domains (newsletter/coaching platforms)
        for (String domain : EXCLUDED_DOMAINS) {
            if (fromLower.contains(domain)) {
                log.debug("[EmailClassifier] BLOCKED domain: {} (matched: {})", from, domain);
                return true;
            }
        }

        // Check blocked subjects
        for (String blocked : BLOCKED_SUBJECTS) {
            if (subjectLower.contains(blocked)) {
                log.debug("[EmailClassifier] BLOCKED subject: {} (matched: {})", subject, blocked);
                return true;
            }
        }

        return false;
    }

    /**
     * Layer C: Intent check — a real job email has a success phrase near the TOP of the body.
     * Newsletters bury job keywords deep in the body (paragraph 5, footer, etc.).
     * Real confirmation emails lead with the intent: "Thank you for applying..." in the first lines.
     *
     * This ONLY applies to non-ATS senders. ATS emails are trusted regardless.
     */
    private boolean hasJobIntentInOpening(String from, String subject, String body) {
        // ATS senders are always trusted — skip intent check
        String fromLower = from.toLowerCase();
        for (String ats : ATS_SENDERS) {
            if (fromLower.contains(ats)) return true;
        }

        // Check subject first — if subject has a success phrase, that's strong enough
        String subjectLower = subject.toLowerCase();
        for (String phrase : SUCCESS_PHRASES) {
            if (subjectLower.contains(phrase)) return true;
        }

        // Check first 200 chars of body for a success phrase
        String bodyOpening = body.length() > 200 ? body.substring(0, 200).toLowerCase() : body.toLowerCase();
        for (String phrase : SUCCESS_PHRASES) {
            if (bodyOpening.contains(phrase)) return true;
        }

        log.debug("[EmailClassifier] NO JOB INTENT in opening — subject: {}", subject);
        return false;
    }

    // ═══════════════════════════════════════════════════
    // STEP 1: FILTER — Is this email job-related?
    // Now much stricter: requires SPECIFIC job application phrases,
    // not just generic words like "opportunity" or "position"
    // ═══════════════════════════════════════════════════

    // These are SPECIFIC phrases that only appear in actual job emails
    private static final List<String> STRONG_JOB_PHRASES = List.of(
        // Application confirmations
        "thank you for applying",
        "thanks for applying",
        "application received",
        "application has been submitted",
        "we received your application",
        "we have received your application",
        "your application for",
        "your application to",
        "you applied to",
        "you recently applied",
        "application confirmation",
        "next steps for your application",
        "your journey begins here",
        // Rejections
        "we will not be moving forward",
        "we have decided to pursue other candidates",
        "we have decided to move forward with other candidates",
        "we regret to inform",
        "unfortunately, we",
        "not selected for",
        "position has been filled",
        "decided not to move forward",
        "will not be advancing your application",
        "we have chosen to move forward with another",
        // Interview invites
        "we'd like to schedule an interview",
        "we would like to schedule an interview",
        "interview scheduled",
        "phone screen with",
        "technical assessment",
        "we'd like to invite you for an interview",
        "we were impressed by your application",
        "move forward with your application",
        "advancing to the next round",
        // Offers
        "offer letter",
        "offer of employment",
        "we are pleased to offer",
        "we're pleased to offer",
        "we are excited to offer you",
        "we would like to extend an offer"
    );

    // ATS (Applicant Tracking System) senders — these are ALWAYS job-related
    private static final List<String> ATS_SENDERS = List.of(
        "greenhouse.io", "lever.co", "workday.com", "icims.com",
        "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com",
        "jobvite.com", "recruitee.com", "bamboohr.com",
        "taleo.net", "successfactors.com", "breezy.hr",
        "joinhandshake.com",
        // Job-specific LinkedIn emails (NOT general linkedin.com)
        "jobs-noreply@linkedin.com",
        "jobs-listings@linkedin.com",
        // Job-specific Indeed emails
        "indeed.com",
        // Common job-specific addresses
        "careers@", "recruiting@", "talent@", "hiring@", "jobs@"
    );

    public boolean isJobRelated(String from, String subject, String body) {
        return isJobRelated(from, subject, body, false);
    }

    /**
     * Full 3-layer filter: Newsletter header → Blacklist → Intent check → Keyword match.
     * @param hasUnsubscribeHeader true if email has List-Unsubscribe header
     */
    public boolean isJobRelated(String from, String subject, String body, boolean hasUnsubscribeHeader) {
        // Layer A: Newsletter header check
        if (isNewsletter(from, hasUnsubscribeHeader)) return false;

        // Layer B: Blacklist check (senders, domains, subjects)
        if (isBlockedEmail(from, subject)) return false;

        String combined = (subject + " " + body).toLowerCase();
        String fromLower = from.toLowerCase();

        // Check ATS senders — these are always job-related
        for (String sender : ATS_SENDERS) {
            if (fromLower.contains(sender)) return true;
        }

        // Check for STRONG job phrases (specific, not generic)
        boolean hasJobPhrase = false;
        for (String phrase : STRONG_JOB_PHRASES) {
            if (combined.contains(phrase)) {
                hasJobPhrase = true;
                break;
            }
        }

        if (!hasJobPhrase) return false;

        // Layer C: Intent check — success phrase must be in subject or first 200 chars of body
        // This catches newsletters that mention "application" deep in the body
        if (!hasJobIntentInOpening(from, subject, body)) return false;

        return true;
    }

    // ═══════════════════════════════════════════════════
    // STEP 2: CLASSIFY — What status does this indicate?
    // ═══════════════════════════════════════════════════

    // Ordered by priority — rejection check first (most important to catch)
    private static final List<String> REJECTION_PHRASES = List.of(
        "we will not be moving forward",
        "we have decided to pursue other candidates",
        "we have decided to move forward with other candidates",
        "we are unable to offer you",
        "unfortunately, we",
        "unfortunately we",
        "we regret to inform",
        "not selected",
        "position has been filled",
        "we won't be moving forward",
        "decided not to move forward",
        "after careful consideration",
        "we appreciate your interest but",
        "not be proceeding",
        "your application was not selected",
        "we are not able to offer",
        "other candidates whose experience",
        "will not be advancing your application",
        "we have chosen to move forward with another",
        "at this time we are unable",
        "thank you for your interest, however"
    );

    private static final List<String> INTERVIEW_PHRASES = List.of(
        "schedule an interview",
        "schedule a call",
        "schedule a meeting",
        "we'd like to schedule",
        "we would like to schedule",
        "interview scheduled",
        "meet with our team",
        "phone screen",
        "technical assessment",
        "coding challenge",
        "take-home assignment",
        "virtual onsite",
        "onsite interview",
        "hiring manager would like to",
        "we were impressed by your application",
        "move forward with your application",
        "advancing to the next round",
        "next round of",
        "we'd like to invite you for"
    );

    private static final List<String> OFFER_PHRASES = List.of(
        "offer letter",
        "offer of employment",
        "we are pleased to offer",
        "we're pleased to offer",
        "we are excited to offer",
        "we're excited to offer",
        "we would like to extend an offer",
        "congratulations! we'd like to offer",
        "formal offer",
        "compensation package",
        "we'd like to welcome you to the team"
    );

    private static final List<String> APPLICATION_PHRASES = List.of(
        "application received",
        "thank you for applying",
        "thanks for applying",
        "we received your application",
        "your application has been submitted",
        "application has been received",
        "we have received your application",
        "thank you for your interest in the",
        "your application for",
        "application confirmation",
        "you applied to",
        "you recently applied"
    );

    public String classifyStatus(String subject, String body) {
        String combined = (subject + " " + body).toLowerCase();

        // Check OFFER first (most specific)
        for (String phrase : OFFER_PHRASES) {
            if (combined.contains(phrase)) {
                log.info("[EmailClassifier] OFFER detected: '{}'", phrase);
                return "OFFER";
            }
        }

        // Check REJECTION (important to catch)
        for (String phrase : REJECTION_PHRASES) {
            if (combined.contains(phrase)) {
                log.info("[EmailClassifier] REJECTED detected: '{}'", phrase);
                return "REJECTED";
            }
        }

        // Check INTERVIEW
        for (String phrase : INTERVIEW_PHRASES) {
            if (combined.contains(phrase)) {
                // Make sure it's not a rejection that mentions "interview"
                boolean hasRejection = REJECTION_PHRASES.stream()
                    .anyMatch(combined::contains);
                if (!hasRejection) {
                    log.info("[EmailClassifier] INTERVIEW detected: '{}'", phrase);
                    return "INTERVIEW";
                }
            }
        }

        // Check APPLICATION
        for (String phrase : APPLICATION_PHRASES) {
            if (combined.contains(phrase)) {
                log.info("[EmailClassifier] APPLIED detected: '{}'", phrase);
                return "APPLIED";
            }
        }

        return null; // Can't classify — will be skipped
    }

    // ═══════════════════════════════════════════════════
    // STEP 3: EXTRACT — Pull out company name and role
    // ═══════════════════════════════════════════════════

    // Common subject line patterns (ordered: 2-group patterns first, then 1-group)
    private static final List<Pattern> SUBJECT_PATTERNS = List.of(
        // "Your application to Software Engineer at Google"
        Pattern.compile("application\\s+(?:to|for)\\s+(.+?)\\s+(?:at|with|@)\\s+(.+)", Pattern.CASE_INSENSITIVE),
        // "Thank you for applying to Software Engineer at Google"
        Pattern.compile("applying\\s+(?:to|for)\\s+(.+?)\\s+(?:at|with|@)\\s+(.+)", Pattern.CASE_INSENSITIVE),
        // "Software Engineer at Google — Application Received"
        Pattern.compile("^(.+?)\\s+(?:at|with|@)\\s+(.+?)\\s*(?:—|–|-|\\|)", Pattern.CASE_INSENSITIVE),
        // "Your application for Software Engineer has been received"
        Pattern.compile("application\\s+for\\s+(.+?)\\s+(?:has been|was|is)", Pattern.CASE_INSENSITIVE),
        // "Update on your Software Engineer application"
        Pattern.compile("(?:update|status)\\s+(?:on|regarding)\\s+your\\s+(.+?)\\s+application", Pattern.CASE_INSENSITIVE),
        // "Your Cisco Journey Begins Here" — company from "Your X Journey"
        Pattern.compile("Your\\s+(.+?)\\s+Journey", Pattern.CASE_INSENSITIVE),
        // "Next Steps for Your Application at Google"
        Pattern.compile("(?:next steps|update)\\s+(?:for|on|regarding)\\s+your\\s+(?:application|interview)\\s+(?:at|with)\\s+(.+?)\\s*[!.]*$", Pattern.CASE_INSENSITIVE),
        // "Welcome to Google" / "Welcome to the Google team"
        Pattern.compile("Welcome\\s+to\\s+(?:the\\s+)?(.+?)(?:\\s+team)?\\s*[!.]*$", Pattern.CASE_INSENSITIVE),
        // "Thank you for your interest in Google"
        Pattern.compile("(?:thank you|thanks)\\s+for\\s+your\\s+interest\\s+in\\s+(.+?)\\s*[!.]*$", Pattern.CASE_INSENSITIVE),
        // "Thank you for applying to IXL Learning!" — company only, no role
        Pattern.compile("applying\\s+(?:to|for)\\s+(.+?)\\s*[!.]*$", Pattern.CASE_INSENSITIVE),
        // "Your application to Google!" — company only
        Pattern.compile("application\\s+(?:to|for)\\s+(.+?)\\s*[!.]*$", Pattern.CASE_INSENSITIVE)
    );

    // Common body text patterns (2-group patterns first, then 1-group for role-only extraction)
    private static final List<Pattern> BODY_PATTERNS = List.of(
        // ── 2-group: extract BOTH role and company ──
        // "your application for the Software Engineer position at Google"
        Pattern.compile("(?:application|applied)\\s+for\\s+(?:the\\s+)?(.+?)\\s+(?:position|role)\\s+(?:at|with)\\s+(.+?)[\\.\\,,]", Pattern.CASE_INSENSITIVE),
        // "the Software Engineer role at Google"
        Pattern.compile("the\\s+(.+?)\\s+(?:role|position)\\s+(?:at|with)\\s+(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "You applied to Software Engineer at Google"
        Pattern.compile("applied\\s+to\\s+(.+?)\\s+(?:at|with)\\s+(.+?)[\\.\\,]", Pattern.CASE_INSENSITIVE),
        // ── 1-group: extract ROLE only (company usually already found from subject/display name) ──
        // "the Software Engineer position"
        Pattern.compile("the\\s+(.+?)\\s+position", Pattern.CASE_INSENSITIVE),
        // "for the role of Software Engineer"
        Pattern.compile("for\\s+the\\s+role\\s+of\\s+(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "your interest in the Software Engineer position/role/opening"
        Pattern.compile("interest\\s+in\\s+(?:the\\s+)?(.+?)\\s+(?:position|role|opening)", Pattern.CASE_INSENSITIVE),
        // "application for the Software Engineer role/position/opening"
        Pattern.compile("application\\s+for\\s+(?:the\\s+)?(.+?)\\s+(?:role|position|opening)", Pattern.CASE_INSENSITIVE),
        // "application for Software Engineer." — plain role ending with punctuation (e.g. Paylocity emails)
        Pattern.compile("application\\s+for\\s+(?:the\\s+)?([A-Z][\\w\\s,/&-]{2,60}?)\\s*[.!,\\n]", Pattern.CASE_INSENSITIVE),
        // "received your application for Software Engineer"
        Pattern.compile("received\\s+your\\s+application\\s+for\\s+(?:the\\s+)?(.+?)[\\.!,\\n]", Pattern.CASE_INSENSITIVE),
        // "your application for Software Engineer" (body variant)
        Pattern.compile("your\\s+application\\s+for\\s+(?:the\\s+)?(.+?)[\\.!,\\n]", Pattern.CASE_INSENSITIVE),
        // "regarding the Software Engineer opportunity/position/role"
        Pattern.compile("regarding\\s+(?:the\\s+)?(.+?)\\s+(?:opportunity|position|role|opening)", Pattern.CASE_INSENSITIVE),
        // "reviewed your application/resume for Software Engineer"
        Pattern.compile("reviewed?\\s+your\\s+(?:application|resume)\\s+for\\s+(?:the\\s+)?(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "interviewing for the Software Engineer"
        Pattern.compile("interviewing\\s+for\\s+(?:the\\s+)?(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "applied for the Software Engineer" (role only)
        Pattern.compile("applied\\s+for\\s+(?:the\\s+)?(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "you applied to Software Engineer" (role only, no company after)
        Pattern.compile("you\\s+applied\\s+(?:to|for)\\s+(.+?)[\\.\\,,\\s]", Pattern.CASE_INSENSITIVE),
        // "interest in a career at X. We have received your application for Role"
        Pattern.compile("interest\\s+in\\s+a\\s+career\\s+at\\s+.+?[.\\n]\\s*(?:Dear\\s+\\w+,\\s*)?(?:Thank\\s+you.+?)?(?:We\\s+have\\s+)?received\\s+your\\s+application\\s+for\\s+(.+?)[\\.!,]", Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
    );

    // ── Subject Anchor Patterns — high-precision subject-line-only role extraction ──
    // These target specific subject line formats that existing SUBJECT_PATTERNS miss
    private static final List<Pattern> SUBJECT_ANCHOR_PATTERNS = List.of(
        // "Your application for Software Engineer at Google"
        Pattern.compile("application\\s+for\\s+(.+?)\\s+(?:at|with|@)\\s+(.+)", Pattern.CASE_INSENSITIVE),
        // "Software Engineer - Application Received"
        Pattern.compile("^(?:Re:\\s*)?(.+?)\\s*[-–—]\\s*(?:application|update|status|confirmation)", Pattern.CASE_INSENSITIVE),
        // "Re: Software Engineer Position"
        Pattern.compile("(?:Re:\\s*)?(.+?)\\s+(?:position|role|opening|opportunity)\\b", Pattern.CASE_INSENSITIVE),
        // "Thank you for applying - Software Engineer"
        Pattern.compile("(?:thank you|thanks).*?[-–—]\\s*(.+?)$", Pattern.CASE_INSENSITIVE),
        // "Application Update: Software Engineer"
        Pattern.compile("(?:application|status)\\s+(?:update|confirmation)[:\\s]+(.+?)$", Pattern.CASE_INSENSITIVE),
        // "Interview Invitation: Software Engineer at Google"
        Pattern.compile("(?:interview|phone screen|assessment)\\s+(?:invitation|request|scheduled?)[:\\s]+(.+?)(?:\\s+(?:at|with|@)\\s+(.+))?$", Pattern.CASE_INSENSITIVE),
        // "Regarding your Software Engineer application"
        Pattern.compile("regarding\\s+(?:your\\s+)?(.+?)\\s+application", Pattern.CASE_INSENSITIVE),
        // "Next steps: Software Engineer"
        Pattern.compile("next\\s+steps?[:\\s]+(.+?)$", Pattern.CASE_INSENSITIVE)
    );

    @Data
    @Builder
    public static class ExtractedJob {
        private String company;
        private String role;
    }

    /**
     * Original 3-param version — delegates to the new overloaded version with null rawHtml.
     */
    public ExtractedJob extractJobDetails(String from, String subject, String body) {
        return extractJobDetails(from, subject, body, null);
    }

    /**
     * High-precision cascading extraction with 5 layers.
     * Stops as soon as role is found (if-else ladder).
     *
     * LAYER 1:   Sender display name → company
     * LAYER 1.5: Subject anchor patterns → role (NEW)
     * LAYER 2:   Existing SUBJECT_PATTERNS → role + company
     * LAYER 3:   Existing + new BODY_PATTERNS → role + company
     * LAYER 3.5: HTML data-label extraction via Jsoup → role (NEW)
     * LAYER 4:   Domain fallback → company only
     * CLEANING:  Enhanced cleanExtracted() + normalizeRole()
     *
     * Thread mining (Layer 5) happens in GmailService since it needs the Gmail client.
     */
    public ExtractedJob extractJobDetails(String from, String subject, String body, String rawHtml) {
        String company = null;
        String role = null;

        // ── LAYER 1: Sender display name → company ──
        String displayName = extractDisplayName(from);
        if (displayName != null) {
            company = cleanCompanyFromDisplayName(displayName);
            if (company != null) {
                log.info("[EmailClassifier] Company from display name: '{}' (raw: '{}')", company, displayName);
            }
        }

        // ── LAYER 1.5: Subject anchor patterns → role (NEW, tried FIRST) ──
        role = trySubjectAnchors(subject);

        // ── LAYER 2: Subject line regex patterns ──
        if (role == null) {
            for (Pattern pattern : SUBJECT_PATTERNS) {
                Matcher matcher = pattern.matcher(subject);
                if (matcher.find()) {
                    if (matcher.groupCount() >= 2) {
                        String group1 = matcher.group(1).trim();
                        String group2 = matcher.group(2).trim();

                        if (pattern.pattern().contains("at|with|@")) {
                            if (role == null) role = group1;
                            if (company == null) company = group2;
                        } else {
                            if (group1.length() < group2.length() && group1.split("\\s+").length <= 3) {
                                if (company == null) company = group1;
                                if (role == null) role = group2;
                            } else {
                                if (role == null) role = group1;
                                if (company == null) company = group2;
                            }
                        }
                    } else if (matcher.groupCount() == 1) {
                        String extracted = matcher.group(1).trim();
                        String pat = pattern.pattern().toLowerCase();
                        if (pat.contains("applying") || pat.contains("application") ||
                            pat.contains("journey") || pat.contains("interest in") ||
                            pat.contains("welcome") || pat.contains("next steps")) {
                            if (company == null) company = extracted;
                        } else {
                            if (role == null) role = extracted;
                        }
                    }
                    break;
                }
            }
        } else {
            // Role found from anchor — still try to get company from subject if needed
            if (company == null) {
                for (Pattern pattern : SUBJECT_PATTERNS) {
                    Matcher matcher = pattern.matcher(subject);
                    if (matcher.find()) {
                        if (matcher.groupCount() >= 2) {
                            String group2 = matcher.group(2).trim();
                            if (pattern.pattern().contains("at|with|@")) {
                                company = group2;
                            }
                        } else if (matcher.groupCount() == 1) {
                            String extracted = matcher.group(1).trim();
                            String pat = pattern.pattern().toLowerCase();
                            if (pat.contains("applying") || pat.contains("application") ||
                                pat.contains("journey") || pat.contains("interest in") ||
                                pat.contains("welcome") || pat.contains("next steps")) {
                                company = extracted;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // ── LAYER 3: Body text patterns ──
        if (company == null || role == null) {
            for (Pattern pattern : BODY_PATTERNS) {
                Matcher matcher = pattern.matcher(body);
                if (matcher.find()) {
                    if (matcher.groupCount() >= 2) {
                        if (role == null) role = matcher.group(1).trim();
                        if (company == null) company = matcher.group(2).trim();
                    } else if (matcher.groupCount() == 1 && role == null) {
                        role = matcher.group(1).trim();
                    }
                    break;
                }
            }
        }

        // ── LAYER 3.5: HTML data-label extraction via Jsoup (NEW) ──
        if (role == null && rawHtml != null) {
            String htmlRole = extractRoleFromHtml(rawHtml);
            if (htmlRole != null) {
                role = htmlRole;
            }
        }

        // ── LAYER 4: Sender domain fallback → company only ──
        if (company == null) {
            company = extractCompanyFromDomain(from);
            if (company != null) {
                log.info("[EmailClassifier] Company from sender domain: '{}'", company);
            }
        }

        // ── CLEANING: Apply cleanExtracted + normalizeRole ──
        if (company != null) company = cleanExtracted(company);
        if (role != null) role = cleanExtracted(role);

        // Normalize role to standard title
        if (role != null) role = normalizeRole(role);

        // Reject company if it looks like a personal name
        if (company != null && isLikelyPersonalName(company)) {
            log.debug("[EmailClassifier] Rejecting personal name as company: '{}'", company);
            company = extractCompanyFromDomain(from);
            if (company != null) company = cleanExtracted(company);
        }

        return ExtractedJob.builder()
            .company(company)
            .role(role)
            .build();
    }

    /**
     * Extract display name from "From" header.
     * "Cisco Careers <hiring@cisco.com>" → "Cisco Careers"
     * "hiring@cisco.com" → null
     */
    private String extractDisplayName(String from) {
        if (from == null) return null;
        // Pattern: "Display Name <email@domain.com>"
        Matcher m = Pattern.compile("^(.+?)\\s*<[^>]+>").matcher(from.trim());
        if (m.find()) {
            String name = m.group(1).trim().replaceAll("^\"|\"$", ""); // Remove quotes
            if (!name.isEmpty() && !name.contains("@")) {
                return name;
            }
        }
        return null;
    }

    /**
     * Clean company name from sender display name.
     * Removes common suffixes like "Careers", "Jobs", "Recruiting", "Talent", "HR", "Hiring".
     * "Cisco Careers" → "Cisco"
     * "Google Jobs" → "Google"
     * "Amazon" → "Amazon"
     */
    private String cleanCompanyFromDisplayName(String displayName) {
        if (displayName == null) return null;

        // Skip generic/platform display names — these aren't company names
        String lower = displayName.toLowerCase();
        List<String> genericNames = List.of(
            "indeed", "linkedin", "glassdoor", "handshake", "greenhouse",
            "lever", "workday", "icims", "smartrecruiters", "jobvite",
            "noreply", "no-reply", "no reply", "mailer-daemon",
            "notifications", "alert", "alerts"
        );
        for (String generic : genericNames) {
            if (lower.equals(generic) || lower.startsWith(generic + " ")) return null;
        }

        // Remove common job-related suffixes
        String cleaned = displayName
            .replaceAll("(?i)\\s*(careers?|jobs?|recruiting|recruitment|talent( team)?|hr|hiring|staffing|team|notifications?)\\s*$", "")
            .replaceAll("(?i)^(team|the)\\s+", "")
            .trim();

        if (cleaned.isEmpty() || cleaned.length() < 2) return null;

        // Reject if it looks like a personal name
        if (isLikelyPersonalName(cleaned)) return null;

        return cleaned;
    }

    /**
     * Last resort: extract company from sender email domain.
     * "hiring@jobalerts.cisco.com" → "Cisco"
     * Skips generic domains (gmail, indeed, linkedin, etc.)
     */
    private String extractCompanyFromDomain(String from) {
        if (from == null) return null;

        List<String> genericDomains = List.of(
            "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
            "indeed.com", "linkedin.com", "greenhouse.io", "lever.co",
            "workday.com", "icims.com", "smartrecruiters.com", "ashbyhq.com",
            "jobvite.com", "bamboohr.com", "taleo.net", "breezy.hr",
            "handshake.com", "joinhandshake.com", "mail.com", "noreply.com"
        );

        Matcher emailMatcher = Pattern.compile("[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})").matcher(from);
        if (!emailMatcher.find()) return null;

        String fullDomain = emailMatcher.group(1).toLowerCase();
        for (String generic : genericDomains) {
            if (fullDomain.contains(generic)) return null;
        }

        String[] parts = fullDomain.split("\\.");
        String companyPart;
        if (parts.length >= 3) {
            companyPart = parts[parts.length - 2];
        } else if (parts.length == 2) {
            companyPart = parts[0];
        } else {
            return null;
        }

        if (companyPart.length() < 3 || List.of("com", "net", "org", "edu", "gov", "app", "otp", "mail", "info").contains(companyPart)) {
            return null;
        }

        return companyPart.substring(0, 1).toUpperCase() + companyPart.substring(1);
    }

    // ═══════════════════════════════════════════════════
    // ROLE NORMALIZATION — Map common variations to standard titles
    // ═══════════════════════════════════════════════════

    private static final Map<String, String> ROLE_NORMALIZATIONS = Map.ofEntries(
        Map.entry("sde", "Software Development Engineer"),
        Map.entry("sde 1", "Software Development Engineer"),
        Map.entry("sde-1", "Software Development Engineer"),
        Map.entry("sde i", "Software Development Engineer"),
        Map.entry("sde1", "Software Development Engineer"),
        Map.entry("sde 2", "Software Development Engineer II"),
        Map.entry("sde ii", "Software Development Engineer II"),
        Map.entry("software development engineer", "Software Development Engineer"),
        Map.entry("software development engineer i", "Software Development Engineer"),
        Map.entry("software development engineer 1", "Software Development Engineer"),
        Map.entry("swe", "Software Engineer"),
        Map.entry("swe 1", "Software Engineer"),
        Map.entry("swe i", "Software Engineer"),
        Map.entry("software engineer i", "Software Engineer"),
        Map.entry("software engineer 1", "Software Engineer"),
        Map.entry("software engineer", "Software Engineer"),
        Map.entry("software engineer ii", "Software Engineer II"),
        Map.entry("software engineer 2", "Software Engineer II"),
        Map.entry("sr software engineer", "Senior Software Engineer"),
        Map.entry("senior software engineer", "Senior Software Engineer"),
        Map.entry("jr software engineer", "Junior Software Engineer"),
        Map.entry("junior software engineer", "Junior Software Engineer"),
        Map.entry("java developer", "Java Developer"),
        Map.entry("java engineer", "Java Developer"),
        Map.entry("java software engineer", "Java Developer"),
        Map.entry("cloud engineer", "Cloud Engineer"),
        Map.entry("cloud infrastructure engineer", "Cloud Engineer"),
        Map.entry("cloud devops engineer", "Cloud Engineer"),
        Map.entry("devops engineer", "DevOps Engineer"),
        Map.entry("dev ops engineer", "DevOps Engineer"),
        Map.entry("jr. dev ops engineer", "DevOps Engineer"),
        Map.entry("jr dev ops engineer", "DevOps Engineer"),
        Map.entry("jr dev ops", "DevOps Engineer"),
        Map.entry("junior devops engineer", "DevOps Engineer"),
        Map.entry("full stack developer", "Full Stack Developer"),
        Map.entry("full-stack developer", "Full Stack Developer"),
        Map.entry("fullstack developer", "Full Stack Developer"),
        Map.entry("full stack engineer", "Full Stack Developer"),
        Map.entry("full-stack engineer", "Full Stack Developer"),
        Map.entry("front end developer", "Frontend Developer"),
        Map.entry("front-end developer", "Frontend Developer"),
        Map.entry("frontend developer", "Frontend Developer"),
        Map.entry("frontend engineer", "Frontend Developer"),
        Map.entry("front end engineer", "Frontend Developer"),
        Map.entry("back end developer", "Backend Developer"),
        Map.entry("back-end developer", "Backend Developer"),
        Map.entry("backend developer", "Backend Developer"),
        Map.entry("backend engineer", "Backend Developer"),
        Map.entry("back end engineer", "Backend Developer"),
        Map.entry("qa engineer", "QA Engineer"),
        Map.entry("quality assurance engineer", "QA Engineer"),
        Map.entry("test engineer", "QA Engineer"),
        Map.entry("data engineer", "Data Engineer"),
        Map.entry("data analyst", "Data Analyst"),
        Map.entry("data scientist", "Data Scientist"),
        Map.entry("ml engineer", "ML Engineer"),
        Map.entry("machine learning engineer", "ML Engineer"),
        Map.entry("web developer", "Web Developer"),
        Map.entry("graphic designer", "Graphic Designer"),
        Map.entry("product manager", "Product Manager"),
        Map.entry("project manager", "Project Manager")
    );

    /**
     * Normalize a role to a standard title. Returns null for garbled/invalid roles.
     */
    public String normalizeRole(String role) {
        if (role == null) return null;

        String trimmed = role.trim();
        // Reject roles that are too long (likely garbled email subject fragments)
        if (trimmed.length() > 50) {
            log.debug("[EmailClassifier] Rejecting garbled role (>50 chars): {}", trimmed);
            return null;
        }

        // Exact match lookup (case-insensitive)
        String key = trimmed.toLowerCase().replaceAll("\\s+", " ");
        String normalized = ROLE_NORMALIZATIONS.get(key);
        if (normalized != null) return normalized;

        // Title-case the original if no normalization found
        return titleCase(trimmed);
    }

    private String titleCase(String str) {
        if (str == null || str.isEmpty()) return str;
        String[] words = str.toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (!sb.isEmpty()) sb.append(' ');
            if (word.length() > 0) {
                sb.append(Character.toUpperCase(word.charAt(0)));
                if (word.length() > 1) sb.append(word.substring(1));
            }
        }
        return sb.toString();
    }

    private String cleanExtracted(String value) {
        if (value == null) return null;
        return value
            // Remove square brackets and contents: [External], [Action Required]
            .replaceAll("\\[.*?\\]", "")
            // Remove Re:, Fwd:, FW: prefixes
            .replaceAll("(?i)^\\s*(re|fwd|fw)\\s*:\\s*", "")
            // Remove leading articles
            .replaceAll("(?i)^(the|a|an)\\s+", "")
            // Remove "from " prefix
            .replaceAll("(?i)^from\\s+", "")
            // Remove possessives
            .replaceAll("['\\u2019]s$", "")
            // Remove common noise phrases
            .replaceAll("(?i)^(invitation to apply|your application|action required|attention)\\s*[-:–—]?\\s*", "")
            // Strip trailing punctuation
            .replaceAll("[\\.,;:!\\-–—]+$", "")
            .replaceAll("\\s+", " ")
            .trim();
    }

    /**
     * Check if a name looks like a person's name rather than a company.
     */
    private boolean isLikelyPersonalName(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase().trim();

        // Contains possessives or "from" indicating a person
        if (lower.contains("'s") || lower.contains("\u2019s")) return true;
        if (lower.matches(".*\\bfrom\\b.*")) return true;

        // Personal titles
        if (lower.matches("^(mr|mrs|ms|dr|prof)\\.?\\s+.*")) return true;

        // 2-word names without company indicators are likely personal names
        String[] words = name.trim().split("\\s+");
        if (words.length == 2 && Character.isUpperCase(words[0].charAt(0))
            && Character.isUpperCase(words[1].charAt(0))) {
            // Check if no company indicators
            if (!lower.contains("inc") && !lower.contains("corp") && !lower.contains("llc")
                && !lower.contains("labs") && !lower.contains("tech") && !lower.contains("group")
                && !lower.contains("systems") && !lower.contains("solutions")
                && !lower.contains("global") && !lower.contains("digital")) {
                return true;
            }
        }

        return false;
    }

    // ═══════════════════════════════════════════════════
    // SUBJECT ANCHOR EXTRACTION — Try subject-specific patterns for role
    // ═══════════════════════════════════════════════════

    /**
     * Try subject anchor patterns to extract role (and optionally company).
     * Returns extracted role or null if no match.
     */
    private String trySubjectAnchors(String subject) {
        if (subject == null || subject.isEmpty()) return null;

        // Clean subject: remove [External], [Action Required], Re:, Fwd: prefixes
        String cleanSubject = subject
            .replaceAll("\\[.*?\\]", "")
            .replaceAll("(?i)^\\s*(re|fwd|fw)\\s*:\\s*", "")
            .trim();

        for (Pattern pattern : SUBJECT_ANCHOR_PATTERNS) {
            Matcher matcher = pattern.matcher(cleanSubject);
            if (matcher.find()) {
                String candidate = matcher.group(1).trim();
                // Clean and validate
                candidate = cleanExtracted(candidate);
                if (candidate != null && !candidate.isEmpty() && candidate.length() <= 50) {
                    // Make sure it looks like a role, not a company name or noise
                    String lower = candidate.toLowerCase();
                    if (lower.contains("engineer") || lower.contains("developer") ||
                        lower.contains("analyst") || lower.contains("manager") ||
                        lower.contains("designer") || lower.contains("scientist") ||
                        lower.contains("architect") || lower.contains("intern") ||
                        lower.contains("sde") || lower.contains("swe") ||
                        lower.contains("devops") || lower.contains("qa") ||
                        lower.contains("consultant") || lower.contains("specialist") ||
                        lower.contains("administrator") || lower.contains("coordinator") ||
                        ROLE_NORMALIZATIONS.containsKey(lower)) {
                        log.info("[EmailClassifier] Role from subject anchor: '{}'", candidate);
                        return candidate;
                    }
                }
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════
    // HTML DATA-LABEL EXTRACTION — Parse structured ATS emails via Jsoup
    // ═══════════════════════════════════════════════════

    /**
     * Extract role from structured HTML in ATS emails.
     * Many ATS platforms (Greenhouse, Workday, Lever) include role in HTML tables or bold labels.
     */
    public String extractRoleFromHtml(String rawHtml) {
        if (rawHtml == null || rawHtml.isEmpty()) return null;

        try {
            Document doc = Jsoup.parse(rawHtml);

            // Strategy A: Table rows with label→value pairs
            // e.g., <td>Position:</td><td>Software Engineer</td>
            for (Element row : doc.select("tr")) {
                Elements cells = row.select("td, th");
                if (cells.size() >= 2) {
                    String label = cells.get(0).text().toLowerCase().trim();
                    if (label.matches("(position|role|job\\s*title|title|job|opening|requisition)\\s*:?")) {
                        String value = cells.get(1).text().trim();
                        if (!value.isEmpty() && value.length() < 80 && value.length() > 2) {
                            log.info("[EmailClassifier] Role from HTML table: '{}'", value);
                            return value;
                        }
                    }
                }
            }

            // Strategy B: Bold/strong label followed by text
            // e.g., <strong>Position:</strong> Software Engineer
            for (Element bold : doc.select("strong, b")) {
                String label = bold.text().toLowerCase().trim();
                if (label.matches("(position|role|job\\s*title|title|job|opening)\\s*:?")) {
                    // Try next sibling text node
                    Node next = bold.nextSibling();
                    if (next != null) {
                        String value = next.toString().replaceAll("<[^>]+>", "").trim();
                        if (value.startsWith(":")) value = value.substring(1).trim();
                        if (!value.isEmpty() && value.length() < 80 && value.length() > 2) {
                            log.info("[EmailClassifier] Role from HTML bold label: '{}'", value);
                            return value;
                        }
                    }
                    // Try parent's next sibling or next element
                    Element parent = bold.parent();
                    if (parent != null) {
                        Element nextEl = parent.nextElementSibling();
                        if (nextEl != null) {
                            String value = nextEl.text().trim();
                            if (!value.isEmpty() && value.length() < 80 && value.length() > 2) {
                                log.info("[EmailClassifier] Role from HTML next element: '{}'", value);
                                return value;
                            }
                        }
                    }
                }
            }

            // Strategy C: Data attributes
            for (Element el : doc.select("[data-role], [data-position], [data-job-title]")) {
                for (String attr : List.of("data-role", "data-position", "data-job-title")) {
                    String val = el.attr(attr);
                    if (!val.isEmpty() && val.length() < 80) {
                        log.info("[EmailClassifier] Role from HTML data attribute: '{}'", val);
                        return val;
                    }
                }
            }

            // Strategy D: Span/div with class containing "job-title", "position", "role"
            for (Element el : doc.select("[class*=job-title], [class*=position], [class*=role-name], [class*=jobTitle]")) {
                String value = el.text().trim();
                if (!value.isEmpty() && value.length() < 80 && value.length() > 2) {
                    log.info("[EmailClassifier] Role from HTML class selector: '{}'", value);
                    return value;
                }
            }

            // Strategy E: ATS-specific patterns
            // Greenhouse: role often in <h2> or <a> near "applied for" / "position"
            for (Element heading : doc.select("h1, h2, h3")) {
                String text = heading.text().trim();
                if (text.length() > 2 && text.length() < 80) {
                    String lower = text.toLowerCase();
                    // Headings that ARE role names (contain role keywords)
                    if (lower.contains("engineer") || lower.contains("developer") ||
                        lower.contains("analyst") || lower.contains("designer") ||
                        lower.contains("manager") || lower.contains("intern") ||
                        lower.contains("architect") || lower.contains("specialist")) {
                        log.info("[EmailClassifier] Role from HTML heading: '{}'", text);
                        return text;
                    }
                }
            }

            // Strategy F: Look for "Position: X" or "Role: X" in plain text within divs/spans
            for (Element el : doc.select("td, div, span, p")) {
                String text = el.ownText().trim();
                Matcher m = Pattern.compile("(?:Position|Role|Job Title|Title)\\s*:\\s*(.+)", Pattern.CASE_INSENSITIVE).matcher(text);
                if (m.find()) {
                    String value = m.group(1).trim();
                    // Stop at first sentence boundary
                    value = value.split("[\\.,;|]")[0].trim();
                    if (!value.isEmpty() && value.length() < 80 && value.length() > 2) {
                        log.info("[EmailClassifier] Role from HTML inline text: '{}'", value);
                        return value;
                    }
                }
            }

        } catch (Exception e) {
            log.debug("[EmailClassifier] HTML parsing failed: {}", e.getMessage());
        }

        return null;
    }

    // ═══════════════════════════════════════════════════
    // STEP 4: DETECT PLATFORM — Which job portal/ATS sent it?
    // ═══════════════════════════════════════════════════
    //
    // Smart detection: checks BOTH the sender AND the email body.
    // Why? Many companies use ATS platforms behind the scenes:
    //   - Email from: hiring@cisco.com  (looks like company direct)
    //   - But body contains: "View your application at cisco.greenhouse.io"
    //   - This means they applied via Greenhouse, not cisco.com directly
    //
    // Priority: Job board (LinkedIn/Indeed) > ATS in body > ATS in sender > COMPANY_DIRECT

    // Platform detection rules: {keyword → platform name}
    private static final List<PlatformRule> PLATFORM_RULES = List.of(
        // Job boards — check sender AND body
        new PlatformRule("linkedin.com", "linkedin.com/jobs", "LINKEDIN"),
        new PlatformRule("indeed.com", "indeed.com", "INDEED"),
        new PlatformRule("joinhandshake.com", "joinhandshake.com", "HANDSHAKE"),
        new PlatformRule("handshake.com", "handshake.com", "HANDSHAKE"),
        // ATS platforms — many companies use these behind the scenes
        new PlatformRule("greenhouse.io", "greenhouse.io", "GREENHOUSE"),
        new PlatformRule("lever.co", "lever.co", "LEVER"),
        new PlatformRule("workday.com", "workday.com", "WORKDAY"),
        new PlatformRule("myworkdayjobs.com", "myworkdayjobs.com", "WORKDAY"),
        new PlatformRule("icims.com", "icims.com", "ICIMS"),
        new PlatformRule("smartrecruiters.com", "smartrecruiters.com", "SMARTRECRUITERS"),
        new PlatformRule("ashbyhq.com", "ashbyhq.com", "ASHBY"),
        new PlatformRule("jobvite.com", "jobvite.com", "JOBVITE"),
        new PlatformRule("taleo.net", "taleo.net", "TALEO"),
        new PlatformRule("successfactors.com", "successfactors.com", "SAP_SUCCESSFACTORS"),
        new PlatformRule("breezy.hr", "breezy.hr", "BREEZY"),
        new PlatformRule("bamboohr.com", "bamboohr.com", "BAMBOOHR"),
        new PlatformRule("recruitee.com", "recruitee.com", "RECRUITEE"),
        new PlatformRule("jazz.co", "jazz.co", "JAZZHR"),
        new PlatformRule("applytojob.com", "applytojob.com", "JAZZHR")
    );

    @Data
    @AllArgsConstructor
    private static class PlatformRule {
        private String senderKeyword;  // match in From header
        private String bodyKeyword;    // match in email body (links, footers)
        private String platformName;
    }

    public String detectPlatform(String from, String body) {
        String fromLower = from.toLowerCase();
        String bodyLower = body.toLowerCase();

        // First pass: check sender (most reliable)
        for (PlatformRule rule : PLATFORM_RULES) {
            if (fromLower.contains(rule.getSenderKeyword())) {
                return rule.getPlatformName();
            }
        }

        // Second pass: check email body for ATS links
        // This catches company emails that use ATS behind the scenes
        // e.g., email from hiring@cisco.com but body has "greenhouse.io" link
        for (PlatformRule rule : PLATFORM_RULES) {
            if (bodyLower.contains(rule.getBodyKeyword())) {
                log.info("[EmailClassifier] Platform detected from body link: {} (found: {})",
                    rule.getPlatformName(), rule.getBodyKeyword());
                return rule.getPlatformName();
            }
        }

        // No known platform found — this is a direct company application
        // e.g., hiring@cisco.com with no ATS links = applied on cisco.com directly
        return "COMPANY_DIRECT";
    }

    // ═══════════════════════════════════════════════════
    // STEP 5: EXTRACT INTERVIEW DATE — Parse date/time from interview emails
    // ═══════════════════════════════════════════════════

    private static final Map<String, Integer> MONTH_MAP = Map.ofEntries(
        Map.entry("january", 1), Map.entry("february", 2), Map.entry("march", 3),
        Map.entry("april", 4), Map.entry("may", 5), Map.entry("june", 6),
        Map.entry("july", 7), Map.entry("august", 8), Map.entry("september", 9),
        Map.entry("october", 10), Map.entry("november", 11), Map.entry("december", 12),
        Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mar", 3),
        Map.entry("apr", 4), Map.entry("jun", 6), Map.entry("jul", 7),
        Map.entry("aug", 8), Map.entry("sep", 9), Map.entry("oct", 10),
        Map.entry("nov", 11), Map.entry("dec", 12)
    );

    // Patterns for interview date extraction
    private static final List<Pattern> DATE_PATTERNS = List.of(
        // "March 20, 2026 at 2:00 PM" or "March 20, 2026, 2:00 PM"
        Pattern.compile("(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+(\\d{1,2}),?\\s+(\\d{4})\\s+(?:at\\s+)?(\\d{1,2}):(\\d{2})\\s*(AM|PM|am|pm)", Pattern.CASE_INSENSITIVE),
        // "March 20, 2026" (date only, no time)
        Pattern.compile("(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+(\\d{1,2}),?\\s+(\\d{4})", Pattern.CASE_INSENSITIVE),
        // "3/20/2026 2:00 PM" or "03/20/2026 14:00"
        Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{4})\\s+(\\d{1,2}):(\\d{2})\\s*(AM|PM|am|pm)?", Pattern.CASE_INSENSITIVE),
        // "2026-03-20T14:00" ISO format
        Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})", Pattern.CASE_INSENSITIVE)
    );

    /**
     * Extract interview date/time from email body. Only called for INTERVIEW status emails.
     */
    public LocalDateTime extractInterviewDate(String body) {
        if (body == null || body.isEmpty()) return null;

        for (Pattern pattern : DATE_PATTERNS) {
            Matcher matcher = pattern.matcher(body);
            while (matcher.find()) {
                try {
                    String fullMatch = matcher.group(0);
                    LocalDateTime parsed = parseMatchedDate(matcher, pattern);
                    if (parsed != null) {
                        // Sanity check: date should be in the future or recent past (within 1 year)
                        LocalDateTime oneYearAgo = LocalDateTime.now().minusYears(1);
                        LocalDateTime oneYearAhead = LocalDateTime.now().plusYears(1);
                        if (parsed.isAfter(oneYearAgo) && parsed.isBefore(oneYearAhead)) {
                            log.info("[EmailClassifier] Extracted interview date: {} from: {}", parsed, fullMatch);
                            return parsed;
                        }
                    }
                } catch (Exception e) {
                    // Continue to next match
                }
            }
        }

        return null;
    }

    private LocalDateTime parseMatchedDate(Matcher matcher, Pattern pattern) {
        String patternStr = pattern.pattern();

        // "Month Day, Year Time" pattern
        if (patternStr.contains("January|February") && matcher.groupCount() >= 3) {
            String monthStr = matcher.group(1).toLowerCase();
            int month = MONTH_MAP.getOrDefault(monthStr, 0);
            if (month == 0) return null;

            int day = Integer.parseInt(matcher.group(2));
            int year = Integer.parseInt(matcher.group(3));

            int hour = 10; // Default to 10 AM if no time
            int minute = 0;

            if (matcher.groupCount() >= 6 && matcher.group(4) != null) {
                hour = Integer.parseInt(matcher.group(4));
                minute = Integer.parseInt(matcher.group(5));
                String ampm = matcher.group(6);
                if (ampm != null) {
                    if (ampm.equalsIgnoreCase("PM") && hour < 12) hour += 12;
                    if (ampm.equalsIgnoreCase("AM") && hour == 12) hour = 0;
                }
            }

            return LocalDateTime.of(year, month, day, hour, minute);
        }

        // "M/D/YYYY Time" pattern
        if (patternStr.contains("\\d{1,2}/\\d{1,2}")) {
            int month = Integer.parseInt(matcher.group(1));
            int day = Integer.parseInt(matcher.group(2));
            int year = Integer.parseInt(matcher.group(3));

            int hour = 10;
            int minute = 0;

            if (matcher.groupCount() >= 5 && matcher.group(4) != null) {
                hour = Integer.parseInt(matcher.group(4));
                minute = Integer.parseInt(matcher.group(5));
                if (matcher.groupCount() >= 6 && matcher.group(6) != null) {
                    String ampm = matcher.group(6);
                    if (ampm.equalsIgnoreCase("PM") && hour < 12) hour += 12;
                    if (ampm.equalsIgnoreCase("AM") && hour == 12) hour = 0;
                }
            }

            return LocalDateTime.of(year, month, day, hour, minute);
        }

        // ISO format
        if (patternStr.contains("\\d{4}-\\d{2}")) {
            int year = Integer.parseInt(matcher.group(1));
            int month = Integer.parseInt(matcher.group(2));
            int day = Integer.parseInt(matcher.group(3));
            int hour = Integer.parseInt(matcher.group(4));
            int minute = Integer.parseInt(matcher.group(5));
            return LocalDateTime.of(year, month, day, hour, minute);
        }

        return null;
    }

    // ═══════════════════════════════════════════════════
    // STEP 6: EXTRACT APPLICATION URL — Find job portal links in email body
    // ═══════════════════════════════════════════════════

    private static final Pattern URL_PATTERN = Pattern.compile("https?://[^\\s\"'<>\\)]+", Pattern.CASE_INSENSITIVE);

    // Keywords that indicate an application/job URL
    private static final List<String> URL_JOB_KEYWORDS = List.of(
        "application", "status", "your-application", "view-application",
        "job", "apply", "track", "candidate", "portal", "career",
        // ATS domains
        "greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com",
        "icims.com", "smartrecruiters.com", "ashbyhq.com", "jobvite.com",
        "taleo.net", "successfactors.com", "bamboohr.com",
        "linkedin.com/jobs", "indeed.com/viewjob", "joinhandshake.com"
    );

    // URLs to skip
    private static final List<String> URL_SKIP_KEYWORDS = List.of(
        "unsubscribe", "privacy", "policy", "terms", "facebook.com",
        "twitter.com", "instagram.com", "youtube.com", "mailto:",
        "google.com/maps", "apple.com/maps", "fonts.googleapis",
        "schemas.microsoft", ".png", ".jpg", ".gif", ".css"
    );

    /**
     * Extract the best application URL from email body.
     * Call this with the RAW HTML body before stripping tags.
     */
    public String extractApplicationUrl(String rawBody) {
        if (rawBody == null || rawBody.isEmpty()) return null;

        Matcher matcher = URL_PATTERN.matcher(rawBody);
        String bestUrl = null;
        int bestScore = 0;

        while (matcher.find()) {
            String url = matcher.group(0).trim();
            // Clean trailing punctuation
            while (url.endsWith(".") || url.endsWith(",") || url.endsWith(";")) {
                url = url.substring(0, url.length() - 1);
            }

            String urlLower = url.toLowerCase();

            // Skip non-job URLs
            if (URL_SKIP_KEYWORDS.stream().anyMatch(urlLower::contains)) continue;

            // Score the URL based on job keywords
            int score = 0;
            for (String keyword : URL_JOB_KEYWORDS) {
                if (urlLower.contains(keyword)) score += 2;
            }

            // Bonus for ATS domains
            if (urlLower.contains("greenhouse.io") || urlLower.contains("lever.co") ||
                urlLower.contains("workday.com") || urlLower.contains("myworkdayjobs.com")) {
                score += 5;
            }

            if (score > bestScore) {
                bestScore = score;
                bestUrl = url;
            }
        }

        if (bestUrl != null) {
            log.info("[EmailClassifier] Extracted application URL: {} (score: {})", bestUrl, bestScore);
        }

        return bestUrl;
    }

    // ═══════════════════════════════════════════════════
    // FULL PIPELINE — Classify a single email
    // ═══════════════════════════════════════════════════

    public ClassificationResult classify(String from, String subject, String body) {
        return classify(from, subject, body, null, false);
    }

    public ClassificationResult classify(String from, String subject, String body, String rawHtml) {
        return classify(from, subject, body, rawHtml, false);
    }

    /**
     * Full classification pipeline with 3-layer filtering.
     * @param rawHtml The raw HTML body (before tag stripping) for URL extraction. Can be null.
     * @param hasUnsubscribeHeader true if the email has a List-Unsubscribe header (newsletter signal).
     */
    public ClassificationResult classify(String from, String subject, String body, String rawHtml, boolean hasUnsubscribeHeader) {
        // 3-Layer Filter: Newsletter header → Blacklist → Intent check → Keyword match
        if (!isJobRelated(from, subject, body, hasUnsubscribeHeader)) {
            return ClassificationResult.builder()
                .jobRelated(false)
                .confidence(0.0)
                .build();
        }

        // Step 2: Classify status — MUST be classifiable
        String status = classifyStatus(subject, body);

        // If we can't determine a status, default to APPLIED only if sender is an ATS platform
        if (status == null) {
            String fromLower = from.toLowerCase();
            boolean isAtsSender = ATS_SENDERS.stream().anyMatch(fromLower::contains);
            if (isAtsSender) {
                status = "APPLIED";
                log.info("[EmailClassifier] ATS sender but no status phrase — defaulting to APPLIED: {}", subject);
            } else {
                log.debug("[EmailClassifier] Skipping — no clear status: {}", subject);
                return ClassificationResult.builder()
                    .jobRelated(false)
                    .confidence(0.2)
                    .build();
            }
        }

        // Step 3: Extract company and role (cascading: display name → subject anchors → subject → body → HTML → domain)
        ExtractedJob job = extractJobDetails(from, subject, body, rawHtml);

        // Step 4: Detect platform
        String platform = detectPlatform(from, body);

        // Step 5: Extract interview date (only for INTERVIEW status)
        LocalDateTime interviewDate = null;
        if ("INTERVIEW".equals(status)) {
            interviewDate = extractInterviewDate(body);
        }

        // Step 6: Extract application URL from raw HTML
        String applicationUrl = null;
        if (rawHtml != null) {
            applicationUrl = extractApplicationUrl(rawHtml);
        }

        // Calculate confidence
        double confidence = 0.6; // Base: job-related + has status
        if (job.getCompany() != null) confidence += 0.2;
        if (job.getRole() != null) confidence += 0.2;

        return ClassificationResult.builder()
            .jobRelated(true)
            .status(status)
            .company(job.getCompany())
            .role(job.getRole())
            .platform(platform)
            .interviewDate(interviewDate)
            .applicationUrl(applicationUrl)
            .confidence(confidence)
            .build();
    }
}
