package com.crosstrack.api.service;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.GmailAccount;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.GmailAccountRepository;
import com.crosstrack.api.repository.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.TokenResponse;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.MessagePartHeader;
import com.google.api.services.gmail.model.Thread;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GmailService {

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final GmailAccountRepository gmailAccountRepository;
    private final EmailClassifier emailClassifier;

    @Value("${google.client.id:}")
    private String clientId;

    @Value("${google.client.secret:}")
    private String clientSecret;

    @Value("${google.redirect.uri:http://localhost:8080/api/gmail/callback}")
    private String redirectUri;

    private static final JsonFactory JSON_FACTORY = JacksonFactory.getDefaultInstance();
    private static final List<String> SCOPES = List.of(GmailScopes.GMAIL_READONLY);

    // ═══════════════════════════════════════════════════
    // OAUTH FLOW
    // ═══════════════════════════════════════════════════

    public String getAuthorizationUrl() {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            return flow.newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setAccessType("offline")
                .setApprovalPrompt("force")
                .build();
        } catch (Exception e) {
            log.error("Failed to build auth URL", e);
            throw new RuntimeException("Failed to generate Google authorization URL", e);
        }
    }

    /**
     * Exchange auth code for tokens, create a new GmailAccount entry.
     * If user already connected this email, update the tokens.
     */
    public Map<String, Object> handleCallback(Long userId, String authCode) {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            GoogleTokenResponse tokenResponse = flow.newTokenRequest(authCode)
                .setRedirectUri(redirectUri)
                .execute();

            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

            // Get the Gmail email address
            Gmail gmail = buildGmailClient(tokenResponse.getAccessToken());
            String gmailEmail = gmail.users().getProfile("me").execute().getEmailAddress();

            // Check if this Gmail is already connected
            Optional<GmailAccount> existing = gmailAccountRepository.findByUserIdAndGmailEmail(userId, gmailEmail);

            GmailAccount account;
            if (existing.isPresent()) {
                // Update existing account's tokens
                account = existing.get();
                account.setAccessToken(tokenResponse.getAccessToken());
                if (tokenResponse.getRefreshToken() != null) {
                    account.setRefreshToken(tokenResponse.getRefreshToken());
                }
                account.setTokenExpiry(LocalDateTime.now().plusSeconds(tokenResponse.getExpiresInSeconds()));
                account.setConnected(true);
                log.info("[Gmail] Re-connected existing Gmail account: {}", gmailEmail);
            } else {
                // Create new Gmail account entry
                account = GmailAccount.builder()
                    .user(user)
                    .gmailEmail(gmailEmail)
                    .accessToken(tokenResponse.getAccessToken())
                    .refreshToken(tokenResponse.getRefreshToken())
                    .tokenExpiry(LocalDateTime.now().plusSeconds(tokenResponse.getExpiresInSeconds()))
                    .connected(true)
                    .build();
                log.info("[Gmail] Connected new Gmail account: {}", gmailEmail);
            }

            gmailAccountRepository.save(account);

            // Also update legacy fields on User for backward compatibility
            user.setGmailAccessToken(tokenResponse.getAccessToken());
            if (tokenResponse.getRefreshToken() != null) {
                user.setGmailRefreshToken(tokenResponse.getRefreshToken());
            }
            user.setGmailConnected(true);
            user.setGmailEmail(gmailEmail);
            user.setGmailTokenExpiry(LocalDateTime.now().plusSeconds(tokenResponse.getExpiresInSeconds()));
            userRepository.save(user);

            return Map.of(
                "connected", true,
                "email", gmailEmail,
                "accountId", account.getId()
            );

        } catch (Exception e) {
            log.error("[Gmail] OAuth callback failed", e);
            throw new RuntimeException("Gmail OAuth failed: " + e.getMessage(), e);
        }
    }

    /**
     * Disconnect a specific Gmail account.
     */
    public void disconnectAccount(Long userId, Long accountId) {
        GmailAccount account = gmailAccountRepository.findByIdAndUserId(accountId, userId)
            .orElseThrow(() -> new RuntimeException("Gmail account not found"));

        account.setAccessToken(null);
        account.setRefreshToken(null);
        account.setTokenExpiry(null);
        account.setConnected(false);
        account.setLastSync(null);
        gmailAccountRepository.save(account);
        log.info("[Gmail] Disconnected account: {} for user {}", account.getGmailEmail(), userId);

        // Update legacy user fields if this was the primary account
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            List<GmailAccount> remaining = gmailAccountRepository.findByUserIdAndConnectedTrue(userId);
            if (remaining.isEmpty()) {
                user.setGmailConnected(false);
                user.setGmailAccessToken(null);
                user.setGmailRefreshToken(null);
                user.setGmailTokenExpiry(null);
                user.setGmailEmail(null);
                userRepository.save(user);
            }
        }
    }

    /**
     * Legacy disconnect — disconnects ALL Gmail accounts.
     */
    public void disconnect(Long userId) {
        List<GmailAccount> accounts = gmailAccountRepository.findByUserIdAndConnectedTrue(userId);
        for (GmailAccount account : accounts) {
            account.setAccessToken(null);
            account.setRefreshToken(null);
            account.setTokenExpiry(null);
            account.setConnected(false);
            account.setLastSync(null);
            gmailAccountRepository.save(account);
        }

        User user = userRepository.findById(userId).orElseThrow();
        user.setGmailAccessToken(null);
        user.setGmailRefreshToken(null);
        user.setGmailTokenExpiry(null);
        user.setGmailEmail(null);
        user.setGmailConnected(false);
        user.setLastEmailSync(null);
        userRepository.save(user);
        log.info("[Gmail] Disconnected ALL Gmail accounts for user {}", userId);
    }

    /**
     * Get all connected Gmail accounts for a user.
     */
    public List<Map<String, Object>> getConnectedAccounts(Long userId) {
        List<GmailAccount> accounts = gmailAccountRepository.findByUserId(userId);
        return accounts.stream().map(a -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", a.getId());
            map.put("email", a.getGmailEmail());
            map.put("label", a.getLabel());
            map.put("connected", Boolean.TRUE.equals(a.getConnected()));
            map.put("lastSync", a.getLastSync() != null ? a.getLastSync().toString() : null);
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * Update label for a Gmail account.
     */
    public void updateAccountLabel(Long userId, Long accountId, String label) {
        GmailAccount account = gmailAccountRepository.findByIdAndUserId(accountId, userId)
            .orElseThrow(() -> new RuntimeException("Gmail account not found"));
        account.setLabel(label);
        gmailAccountRepository.save(account);
    }

    // ═══════════════════════════════════════════════════
    // EMAIL SCANNING — scans ALL connected accounts
    // ═══════════════════════════════════════════════════

    public ScanResult scanEmails(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        // Get all connected Gmail accounts
        List<GmailAccount> accounts = gmailAccountRepository.findByUserIdAndConnectedTrue(userId);

        // Backward compatibility: if no GmailAccount entries but user has legacy tokens, use those
        if (accounts.isEmpty() && Boolean.TRUE.equals(user.getGmailConnected()) && user.getGmailAccessToken() != null) {
            return scanEmailsLegacy(user);
        }

        if (accounts.isEmpty()) {
            throw new RuntimeException("No Gmail accounts connected. Please connect at least one Gmail account.");
        }

        int totalCreated = 0;
        int totalUpdated = 0;
        int totalScanned = 0;
        List<String> allErrors = new ArrayList<>();

        for (GmailAccount account : accounts) {
            try {
                log.info("[Gmail] Scanning account: {} for user {}", account.getGmailEmail(), userId);
                ScanResult result = scanSingleAccount(user, account);
                totalCreated += result.getCreated();
                totalUpdated += result.getUpdated();
                totalScanned += result.getTotalScanned();
                allErrors.addAll(result.getErrors());
            } catch (Exception e) {
                log.error("[Gmail] Failed to scan account: {}", account.getGmailEmail(), e);
                allErrors.add("Failed to scan " + account.getGmailEmail() + ": " + e.getMessage());
            }
        }

        // Update legacy last sync on user
        user.setLastEmailSync(LocalDateTime.now());
        userRepository.save(user);

        return new ScanResult(totalCreated, totalUpdated, totalScanned, allErrors);
    }

    private ScanResult scanSingleAccount(User user, GmailAccount account) throws Exception {
        // Refresh token if expired
        String accessToken = getValidAccessToken(account);

        Gmail gmail = buildGmailClient(accessToken);

        String query = buildSearchQuery(account.getLastSync());
        log.info("[Gmail] Search query for {}: {}", account.getGmailEmail(), query);

        List<Message> messages = fetchMessages(gmail, query);
        log.info("[Gmail] Found {} potential job emails from {}", messages.size(), account.getGmailEmail());

        int created = 0;
        int updated = 0;
        List<String> errors = new ArrayList<>();

        for (Message msgRef : messages) {
            try {
                Message fullMessage = gmail.users().messages().get("me", msgRef.getId())
                    .setFormat("full")
                    .execute();

                String from = getHeader(fullMessage, "From");
                String subject = getHeader(fullMessage, "Subject");
                String rawHtml = extractRawHtml(fullMessage); // Raw HTML for URL extraction
                String body = extractBody(fullMessage);       // Stripped text for classification
                String messageId = fullMessage.getId();

                // Step 1: Check List-Unsubscribe header (newsletter signal)
                String unsubscribeHeader = getHeader(fullMessage, "List-Unsubscribe");
                boolean hasUnsubscribeHeader = unsubscribeHeader != null && !unsubscribeHeader.isEmpty();

                log.info("[Gmail] [{}] Processing - From: {} | Subject: {} | Unsubscribe: {}",
                    account.getGmailEmail(), from, subject, hasUnsubscribeHeader);

                // Skip if already processed
                if (applicationRepository.existsBySourceEmailId(messageId)) {
                    log.info("[Gmail] SKIP (already processed): {}", subject);
                    continue;
                }

                // Run classification pipeline (3-layer filter + extraction)
                EmailClassifier.ClassificationResult result = emailClassifier.classify(from, subject, body, rawHtml, hasUnsubscribeHeader);
                log.info("[Gmail] Classification: jobRelated={}, status={}, company={}, role={}, confidence={}",
                    result.isJobRelated(), result.getStatus(), result.getCompany(), result.getRole(), result.getConfidence());

                if (!result.isJobRelated() || result.getConfidence() < 0.5) {
                    log.info("[Gmail] SKIP (not job-related or low confidence): {}", subject);
                    continue;
                }

                if (result.getCompany() == null && result.getRole() == null) {
                    log.info("[Gmail] SKIP (no company or role extracted): {}", subject);
                    continue;
                }

                String company = result.getCompany() != null ? result.getCompany() : "Unknown Company";
                String role = result.getRole() != null ? result.getRole() : "Unknown Role";

                // ── Layer 5: Thread mining — if role is still unknown, try the thread ──
                if ("Unknown Role".equals(role)) {
                    String threadId = fullMessage.getThreadId();
                    String threadRole = extractRoleFromThread(gmail, threadId);
                    if (threadRole != null) {
                        role = threadRole;
                        log.info("[Gmail] Role resolved via thread mining: '{}'", role);
                    }
                }

                // ── Layer 6: Extension lookup — check if extension captured role for this company ──
                if ("Unknown Role".equals(role)) {
                    Optional<Application> extApp = applicationRepository
                        .findFirstByUserIdAndCompanyIgnoreCaseAndSource(user.getId(), company, "EXTENSION");
                    if (extApp.isPresent() && extApp.get().getRole() != null
                            && !"Unknown Role".equals(extApp.get().getRole())) {
                        role = extApp.get().getRole();
                        log.info("[Gmail] Role resolved from extension data: '{}'", role);
                    }
                }

                String status = result.getStatus() != null ? result.getStatus() : "APPLIED";
                String platform = result.getPlatform();

                LocalDateTime emailDate = LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(fullMessage.getInternalDate()),
                    ZoneId.systemDefault()
                );

                Optional<Application> existing = findExistingApplication(user.getId(), company, role);

                if (existing.isPresent()) {
                    Application app = existing.get();
                    if (shouldUpdateStatus(app.getStatus(), status)) {
                        String oldStatus = app.getStatus();
                        app.setStatus(status);
                        app.setStatusChangedAt(LocalDateTime.now());
                        app.setSourceEmailId(messageId);
                        // Set interview date if parsed
                        if (result.getInterviewDate() != null) {
                            app.setInterviewDate(result.getInterviewDate());
                        }
                        // Set URL if not already set
                        if (app.getUrl() == null && result.getApplicationUrl() != null) {
                            app.setUrl(result.getApplicationUrl());
                        }
                        if (app.getNotes() == null) app.setNotes("");
                        app.setNotes(app.getNotes() + "\n[Email:" + account.getGmailEmail() + "] Status: " + oldStatus + " → " + status + " (from: " + subject + ")");
                        applicationRepository.save(app);
                        updated++;
                        log.info("[Gmail] Updated {} - {} from {} to {}", company, role, oldStatus, status);
                    }
                } else {
                    Application app = Application.builder()
                        .user(user)
                        .company(company)
                        .role(role)
                        .platform(platform)
                        .status(status)
                        .source("EMAIL_SCAN")
                        .sourceEmailId(messageId)
                        .url(result.getApplicationUrl())
                        .interviewDate(result.getInterviewDate())
                        .appliedAt(emailDate)
                        .statusChangedAt(emailDate)
                        .notes("[Email:" + account.getGmailEmail() + "] Detected from: " + subject)
                        .build();
                    applicationRepository.save(app);
                    created++;
                    log.info("[Gmail] Created new: {} - {} ({})", company, role, status);
                }

            } catch (Exception e) {
                log.warn("[Gmail] Failed to process message: {}", e.getMessage());
                errors.add(e.getMessage());
            }
        }

        // Update last sync for this account
        account.setLastSync(LocalDateTime.now());
        gmailAccountRepository.save(account);

        return new ScanResult(created, updated, messages.size(), errors);
    }

    /**
     * Legacy scan — for backward compatibility with old single-account data.
     */
    private ScanResult scanEmailsLegacy(User user) {
        try {
            String accessToken = getValidAccessTokenLegacy(user);
            Gmail gmail = buildGmailClient(accessToken);

            String query = buildSearchQuery(user.getLastEmailSync());
            log.info("[Gmail] Legacy scan query: {}", query);

            List<Message> messages = fetchMessages(gmail, query);
            log.info("[Gmail] Found {} potential job emails for user {}", messages.size(), user.getId());

            int created = 0;
            int updated = 0;
            List<String> errors = new ArrayList<>();

            for (Message msgRef : messages) {
                try {
                    Message fullMessage = gmail.users().messages().get("me", msgRef.getId())
                        .setFormat("full")
                        .execute();

                    String from = getHeader(fullMessage, "From");
                    String subject = getHeader(fullMessage, "Subject");
                    String body = extractBody(fullMessage);
                    String rawHtml = extractRawHtml(fullMessage);
                    String messageId = fullMessage.getId();

                    // Check List-Unsubscribe header (newsletter signal)
                    String unsubHeader = getHeader(fullMessage, "List-Unsubscribe");
                    boolean hasUnsub = unsubHeader != null && !unsubHeader.isEmpty();

                    log.info("[Gmail] Processing email - From: {} | Subject: {} | Unsubscribe: {}", from, subject, hasUnsub);

                    if (applicationRepository.existsBySourceEmailId(messageId)) {
                        continue;
                    }

                    EmailClassifier.ClassificationResult result = emailClassifier.classify(from, subject, body, rawHtml, hasUnsub);

                    if (!result.isJobRelated() || result.getConfidence() < 0.5) continue;
                    if (result.getCompany() == null && result.getRole() == null) continue;

                    String company = result.getCompany() != null ? result.getCompany() : "Unknown Company";
                    String role = result.getRole() != null ? result.getRole() : "Unknown Role";

                    // ── Layer 5: Thread mining — if role is still unknown, try the thread ──
                    if ("Unknown Role".equals(role)) {
                        String threadId = fullMessage.getThreadId();
                        String threadRole = extractRoleFromThread(gmail, threadId);
                        if (threadRole != null) {
                            role = threadRole;
                            log.info("[Gmail] Legacy scan — role resolved via thread mining: '{}'", role);
                        }
                    }

                    // ── Layer 6: Extension lookup — check if extension captured role for this company ──
                    if ("Unknown Role".equals(role)) {
                        Optional<Application> extApp = applicationRepository
                            .findFirstByUserIdAndCompanyIgnoreCaseAndSource(user.getId(), company, "EXTENSION");
                        if (extApp.isPresent() && extApp.get().getRole() != null
                                && !"Unknown Role".equals(extApp.get().getRole())) {
                            role = extApp.get().getRole();
                            log.info("[Gmail] Legacy scan — role resolved from extension data: '{}'", role);
                        }
                    }

                    String status = result.getStatus() != null ? result.getStatus() : "APPLIED";
                    String platform = result.getPlatform();

                    LocalDateTime emailDate = LocalDateTime.ofInstant(
                        Instant.ofEpochMilli(fullMessage.getInternalDate()),
                        ZoneId.systemDefault()
                    );

                    Optional<Application> existing = findExistingApplication(user.getId(), company, role);

                    if (existing.isPresent()) {
                        Application app = existing.get();
                        if (shouldUpdateStatus(app.getStatus(), status)) {
                            String oldStatus = app.getStatus();
                            app.setStatus(status);
                            app.setStatusChangedAt(LocalDateTime.now());
                            app.setSourceEmailId(messageId);
                            if (app.getNotes() == null) app.setNotes("");
                            app.setNotes(app.getNotes() + "\n[Email] Status: " + oldStatus + " → " + status + " (from: " + subject + ")");
                            applicationRepository.save(app);
                            updated++;
                        }
                    } else {
                        Application app = Application.builder()
                            .user(user)
                            .company(company)
                            .role(role)
                            .platform(platform)
                            .status(status)
                            .source("EMAIL_SCAN")
                            .sourceEmailId(messageId)
                            .appliedAt(emailDate)
                            .statusChangedAt(emailDate)
                            .notes("[Email] Detected from: " + subject)
                            .build();
                        applicationRepository.save(app);
                        created++;
                    }
                } catch (Exception e) {
                    errors.add(e.getMessage());
                }
            }

            user.setLastEmailSync(LocalDateTime.now());
            userRepository.save(user);

            return new ScanResult(created, updated, messages.size(), errors);
        } catch (Exception e) {
            throw new RuntimeException("Email scan failed: " + e.getMessage(), e);
        }
    }

    @Data
    public static class ScanResult {
        private final int created;
        private final int updated;
        private final int totalScanned;
        private final List<String> errors;
    }

    // ═══════════════════════════════════════════════════
    // THREAD MINING — Extract role from earliest message in a Gmail thread
    // ═══════════════════════════════════════════════════

    /**
     * Layer 5 of role extraction: Thread Mining.
     * Fetches the full Gmail thread and scans the FIRST (original) message
     * for role information. The original message often contains the job posting
     * details that confirmation emails omit.
     *
     * @return extracted role name, or null if not found
     */
    public String extractRoleFromThread(Gmail gmail, String threadId) {
        if (threadId == null || threadId.isEmpty()) return null;

        try {
            Thread thread = gmail.users().threads().get("me", threadId)
                .setFormat("full")
                .execute();

            List<Message> messages = thread.getMessages();
            if (messages == null || messages.size() < 2) return null;

            // Check the FIRST message (original application/posting)
            Message original = messages.get(0);
            String origFrom = getHeader(original, "From");
            String origSubject = getHeader(original, "Subject");
            String origBody = extractBody(original);
            String origHtml = extractRawHtml(original);

            // Try full extraction on the original message
            EmailClassifier.ExtractedJob details = emailClassifier.extractJobDetails(
                origFrom, origSubject, origBody, origHtml);

            if (details.getRole() != null && !"Unknown Role".equals(details.getRole())) {
                log.info("[Gmail] Thread mining found role: '{}' from thread {}", details.getRole(), threadId);
                return details.getRole();
            }

        } catch (Exception e) {
            log.debug("[Gmail] Thread mining failed for {}: {}", threadId, e.getMessage());
        }

        return null;
    }

    // ═══════════════════════════════════════════════════
    // RETROACTIVE ROLE REPAIR — Re-fetch email and re-extract role
    // ═══════════════════════════════════════════════════

    /**
     * Re-fetch the original email for an application and re-run the improved
     * extraction pipeline. Returns the new role if found, or null.
     */
    public String repairRoleForApplication(Long userId, Application app) throws Exception {
        if (app.getSourceEmailId() == null || app.getSourceEmailId().isEmpty()) {
            return null; // No email ID to re-fetch
        }

        // Get a Gmail client for this user
        Gmail gmail = getGmailClientForUser(userId);
        if (gmail == null) return null;

        // Re-fetch the full email
        Message fullMessage = gmail.users().messages().get("me", app.getSourceEmailId())
                .setFormat("full")
                .execute();

        String from = getHeader(fullMessage, "From");
        String subject = getHeader(fullMessage, "Subject");
        String body = extractBody(fullMessage);
        String rawHtml = extractRawHtml(fullMessage);

        // Re-run extraction with full pipeline (subject anchors + body + HTML)
        EmailClassifier.ExtractedJob details = emailClassifier.extractJobDetails(from, subject, body, rawHtml);

        String role = details.getRole();

        // If still unknown, try thread mining
        if (role == null || "Unknown Role".equals(role)) {
            String threadId = fullMessage.getThreadId();
            role = extractRoleFromThread(gmail, threadId);
        }

        return role;
    }

    /**
     * Get a Gmail client for a user (tries GmailAccount first, then legacy).
     */
    private Gmail getGmailClientForUser(Long userId) throws Exception {
        List<GmailAccount> accounts = gmailAccountRepository.findByUserIdAndConnectedTrue(userId);
        if (!accounts.isEmpty()) {
            String token = getValidAccessToken(accounts.get(0));
            return buildGmailClient(token);
        }

        // Fallback to legacy
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && Boolean.TRUE.equals(user.getGmailConnected()) && user.getGmailAccessToken() != null) {
            String token = getValidAccessTokenLegacy(user);
            return buildGmailClient(token);
        }

        return null;
    }

    // ═══════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════

    private GoogleAuthorizationCodeFlow buildFlow() throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        return new GoogleAuthorizationCodeFlow.Builder(
            transport, JSON_FACTORY, clientId, clientSecret, SCOPES)
            .setAccessType("offline")
            .build();
    }

    private Gmail buildGmailClient(String accessToken) throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();

        Credential credential = new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
            .setTransport(transport)
            .setJsonFactory(JSON_FACTORY)
            .setTokenServerEncodedUrl("https://oauth2.googleapis.com/token")
            .setClientAuthentication(new ClientParametersAuthentication(clientId, clientSecret))
            .build()
            .setAccessToken(accessToken);

        return new Gmail.Builder(transport, JSON_FACTORY, credential)
            .setApplicationName("CrossTrack")
            .build();
    }

    /**
     * Get valid access token for a GmailAccount (refresh if expired).
     */
    private String getValidAccessToken(GmailAccount account) throws Exception {
        if (account.getTokenExpiry() != null &&
            account.getTokenExpiry().isBefore(LocalDateTime.now())) {
            log.info("[Gmail] Refreshing expired token for account {}", account.getGmailEmail());
            return refreshAccessToken(account);
        }
        return account.getAccessToken();
    }

    private String refreshAccessToken(GmailAccount account) throws Exception {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();

        TokenResponse tokenResponse = new com.google.api.client.googleapis.auth.oauth2.GoogleRefreshTokenRequest(
            transport, JSON_FACTORY, account.getRefreshToken(), clientId, clientSecret)
            .execute();

        account.setAccessToken(tokenResponse.getAccessToken());
        account.setTokenExpiry(LocalDateTime.now().plusSeconds(tokenResponse.getExpiresInSeconds()));
        gmailAccountRepository.save(account);

        return tokenResponse.getAccessToken();
    }

    /**
     * Legacy token methods for backward compatibility.
     */
    private String getValidAccessTokenLegacy(User user) throws Exception {
        if (user.getGmailTokenExpiry() != null &&
            user.getGmailTokenExpiry().isBefore(LocalDateTime.now())) {
            return refreshAccessTokenLegacy(user);
        }
        return user.getGmailAccessToken();
    }

    private String refreshAccessTokenLegacy(User user) throws Exception {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();

        TokenResponse tokenResponse = new com.google.api.client.googleapis.auth.oauth2.GoogleRefreshTokenRequest(
            transport, JSON_FACTORY, user.getGmailRefreshToken(), clientId, clientSecret)
            .execute();

        user.setGmailAccessToken(tokenResponse.getAccessToken());
        user.setGmailTokenExpiry(LocalDateTime.now().plusSeconds(tokenResponse.getExpiresInSeconds()));
        userRepository.save(user);

        return tokenResponse.getAccessToken();
    }

    private String buildSearchQuery(LocalDateTime lastSync) {
        StringBuilder query = new StringBuilder();

        query.append("(");
        query.append("from:greenhouse.io OR from:lever.co OR from:workday.com ");
        query.append("OR from:icims.com OR from:smartrecruiters.com OR from:ashbyhq.com ");
        query.append("OR from:joinhandshake.com OR from:jobvite.com OR from:myworkdayjobs.com ");
        query.append("OR from:jobs-noreply@linkedin.com ");
        query.append("OR from:indeed.com ");
        query.append("OR from:careers@ OR from:recruiting@ OR from:talent@ OR from:hiring@ ");
        query.append("OR subject:\"thank you for applying\" ");
        query.append("OR subject:\"application received\" ");
        query.append("OR subject:\"your application\" ");
        query.append("OR subject:\"you applied\" ");
        query.append("OR subject:\"interview scheduled\" ");
        query.append("OR subject:\"schedule an interview\" ");
        query.append("OR subject:\"offer letter\" ");
        query.append("OR subject:\"regret to inform\" ");
        query.append("OR subject:\"moving forward with other\" ");
        query.append(")");

        long thirtyDaysAgo = Instant.now().getEpochSecond() - (30L * 24 * 60 * 60);

        if (lastSync != null) {
            long lastSyncEpoch = lastSync.atZone(ZoneId.systemDefault()).toEpochSecond();
            long lookbackTime = Math.min(lastSyncEpoch, thirtyDaysAgo);
            query.append(" after:").append(lookbackTime);
        } else {
            long ninetyDaysAgo = Instant.now().getEpochSecond() - (90L * 24 * 60 * 60);
            query.append(" after:").append(ninetyDaysAgo);
        }

        query.append(" -in:sent -in:drafts -in:spam");
        query.append(" -from:groww -from:zerodha -from:digest -from:newsletter -from:yudi");

        return query.toString();
    }

    private List<Message> fetchMessages(Gmail gmail, String query) throws IOException {
        List<Message> allMessages = new ArrayList<>();
        String pageToken = null;

        do {
            ListMessagesResponse response = gmail.users().messages().list("me")
                .setQ(query)
                .setMaxResults(100L)
                .setPageToken(pageToken)
                .execute();

            if (response.getMessages() != null) {
                allMessages.addAll(response.getMessages());
            }
            pageToken = response.getNextPageToken();

            if (allMessages.size() >= 500) break;

        } while (pageToken != null);

        return allMessages;
    }

    private String getHeader(Message message, String headerName) {
        if (message.getPayload() == null || message.getPayload().getHeaders() == null) return "";
        return message.getPayload().getHeaders().stream()
            .filter(h -> h.getName().equalsIgnoreCase(headerName))
            .map(MessagePartHeader::getValue)
            .findFirst()
            .orElse("");
    }

    private String extractBody(Message message) {
        if (message.getPayload() == null) return "";

        String body = extractBodyFromPart(message.getPayload());
        if (body != null && !body.isEmpty()) return body;

        return message.getSnippet() != null ? message.getSnippet() : "";
    }

    /**
     * Extract raw HTML body WITHOUT stripping tags.
     * Used for URL extraction — we need href attributes intact.
     */
    private String extractRawHtml(Message message) {
        if (message.getPayload() == null) return "";
        return extractRawHtmlFromPart(message.getPayload());
    }

    private String extractRawHtmlFromPart(MessagePart part) {
        if (part == null) return "";

        if (part.getBody() != null && part.getBody().getData() != null) {
            String mimeType = part.getMimeType() != null ? part.getMimeType() : "";
            if (mimeType.equals("text/html")) {
                byte[] bytes = Base64.getUrlDecoder().decode(part.getBody().getData());
                return new String(bytes); // Return raw HTML, don't strip tags
            }
        }

        if (part.getParts() != null) {
            for (MessagePart subPart : part.getParts()) {
                if ("text/html".equals(subPart.getMimeType())) {
                    String html = extractRawHtmlFromPart(subPart);
                    if (html != null && !html.isEmpty()) return html;
                }
            }
            // Fallback to any part
            for (MessagePart subPart : part.getParts()) {
                String html = extractRawHtmlFromPart(subPart);
                if (html != null && !html.isEmpty()) return html;
            }
        }

        return "";
    }

    private String extractBodyFromPart(MessagePart part) {
        if (part == null) return null;

        if (part.getBody() != null && part.getBody().getData() != null) {
            String mimeType = part.getMimeType() != null ? part.getMimeType() : "";
            if (mimeType.equals("text/plain") || mimeType.equals("text/html")) {
                byte[] bytes = Base64.getUrlDecoder().decode(part.getBody().getData());
                String decoded = new String(bytes);
                if (mimeType.equals("text/html")) {
                    decoded = decoded.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
                }
                return decoded;
            }
        }

        if (part.getParts() != null) {
            for (MessagePart subPart : part.getParts()) {
                if ("text/plain".equals(subPart.getMimeType())) {
                    String body = extractBodyFromPart(subPart);
                    if (body != null) return body;
                }
            }
            for (MessagePart subPart : part.getParts()) {
                String body = extractBodyFromPart(subPart);
                if (body != null) return body;
            }
        }

        return null;
    }

    private Optional<Application> findExistingApplication(Long userId, String company, String role) {
        List<Application> userApps = applicationRepository.findByUserIdOrderByAppliedAtDesc(userId);

        String normCompany = company.toLowerCase().trim();
        String normRole = role.toLowerCase().trim();

        // First: try exact or substring match on both company AND role
        Optional<Application> match = userApps.stream()
            .filter(app -> {
                String appCompany = app.getCompany().toLowerCase().trim();
                String appRole = app.getRole().toLowerCase().trim();

                if (appCompany.equals(normCompany) && appRole.equals(normRole)) return true;

                boolean companyMatch = appCompany.contains(normCompany) || normCompany.contains(appCompany);
                boolean roleMatch = appRole.contains(normRole) || normRole.contains(appRole);

                return companyMatch && roleMatch;
            })
            .findFirst();

        if (match.isPresent()) return match;

        // Fallback: company-only match for EXTENSION apps (role was captured at apply-time)
        return userApps.stream()
            .filter(app -> "EXTENSION".equals(app.getSource()))
            .filter(app -> {
                String appCompany = app.getCompany().toLowerCase().trim();
                return appCompany.contains(normCompany) || normCompany.contains(appCompany);
            })
            .findFirst();
    }

    private boolean shouldUpdateStatus(String currentStatus, String newStatus) {
        if (currentStatus.equals(newStatus)) return false;
        if (newStatus.equals("REJECTED")) return true;
        if (newStatus.equals("OFFER") && !currentStatus.equals("REJECTED")) return true;
        if (newStatus.equals("INTERVIEW") && currentStatus.equals("APPLIED")) return true;
        return false;
    }
}
