package com.crosstrack.api.controller;

import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.GmailService;
import com.crosstrack.api.service.GhostScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gmail")
@RequiredArgsConstructor
@Slf4j
public class GmailController {

    private final GmailService gmailService;
    private final GhostScheduler ghostScheduler;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    private static final String DEVELOPER_EMAIL = "dineshnannapaneni8@gmail.com";

    private Long getUserId(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    /**
     * GET /api/gmail/auth-url
     * Returns Google OAuth consent URL. Works for adding ANY Gmail account.
     */
    @GetMapping("/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl(Authentication auth) {
        getUserId(auth);
        String url = gmailService.getAuthorizationUrl();
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * GET /api/gmail/callback
     * Google redirects here after user grants permission.
     */
    @GetMapping("/callback")
    public ResponseEntity<String> handleCallback(@RequestParam("code") String code) {
        String redirectUrl = "http://localhost:5173/gmail-callback?code=" + code;
        String html = """
            <!DOCTYPE html>
            <html>
            <head><title>CrossTrack - Gmail Connected</title></head>
            <body>
                <h2>Connecting Gmail...</h2>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'GMAIL_AUTH_CODE', code: '%s' }, '*');
                        window.close();
                    } else {
                        window.location.href = '%s';
                    }
                </script>
            </body>
            </html>
            """.formatted(code, redirectUrl);
        return ResponseEntity.ok().header("Content-Type", "text/html").body(html);
    }

    /**
     * POST /api/gmail/callback-code
     * Frontend sends auth code (SPA flow). Creates/updates a GmailAccount entry.
     */
    @PostMapping("/callback-code")
    public ResponseEntity<Map<String, Object>> handleCallbackCode(
        @RequestBody Map<String, String> body,
        Authentication auth
    ) {
        Long userId = getUserId(auth);
        String code = body.get("code");
        Map<String, Object> result = gmailService.handleCallback(userId, code);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/gmail/status
     * Returns status of ALL connected Gmail accounts.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(Authentication auth) {
        Long userId = getUserId(auth);
        User user = userRepository.findById(userId).orElseThrow();
        List<Map<String, Object>> accounts = gmailService.getConnectedAccounts(userId);

        // Check if at least one account is connected
        boolean anyConnected = accounts.stream()
            .anyMatch(a -> Boolean.TRUE.equals(a.get("connected")));

        return ResponseEntity.ok(Map.of(
            "connected", anyConnected,
            "email", user.getGmailEmail() != null ? user.getGmailEmail() : "",
            "lastSync", user.getLastEmailSync() != null ? user.getLastEmailSync().toString() : "",
            "accounts", accounts
        ));
    }

    /**
     * POST /api/gmail/scan
     * Scans ALL connected Gmail accounts for job emails.
     */
    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> scanEmails(Authentication auth) {
        try {
            Long userId = getUserId(auth);
            GmailService.ScanResult result = gmailService.scanEmails(userId);

            return ResponseEntity.ok(Map.of(
                "created", result.getCreated(),
                "updated", result.getUpdated(),
                "totalScanned", result.getTotalScanned(),
                "errors", result.getErrors().size()
            ));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            log.error("[Gmail] Scan failed: {}", msg, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", msg,
                "hint", msg.contains("token") || msg.contains("401") || msg.contains("invalid_grant")
                    ? "Gmail token expired. Please disconnect and reconnect your Gmail account."
                    : "Check backend logs for details."
            ));
        }
    }

    /**
     * POST /api/gmail/disconnect
     * Disconnect ALL Gmail accounts (legacy behavior).
     */
    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect(Authentication auth) {
        Long userId = getUserId(auth);
        gmailService.disconnect(userId);
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }

    /**
     * POST /api/gmail/disconnect/{accountId}
     * Disconnect a SPECIFIC Gmail account.
     */
    @PostMapping("/disconnect/{accountId}")
    public ResponseEntity<Map<String, String>> disconnectAccount(
        @PathVariable("accountId") Long accountId,
        Authentication auth
    ) {
        Long userId = getUserId(auth);
        gmailService.disconnectAccount(userId, accountId);
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }

    /**
     * PUT /api/gmail/accounts/{accountId}/label
     * Update the label of a Gmail account (e.g., "Personal", "College", "Work").
     */
    @PutMapping("/accounts/{accountId}/label")
    public ResponseEntity<Map<String, String>> updateLabel(
        @PathVariable("accountId") Long accountId,
        @RequestBody Map<String, String> body,
        Authentication auth
    ) {
        Long userId = getUserId(auth);
        gmailService.updateAccountLabel(userId, accountId, body.get("label"));
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    /**
     * POST /api/gmail/request-access
     * Sends an email to the developer asking them to add this user as a Google OAuth test user.
     * Email is sent asynchronously so the HTTP response returns immediately.
     */
    @PostMapping("/request-access")
    public ResponseEntity<Map<String, String>> requestAccess(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));
        String name = user.getDisplayName() != null ? user.getDisplayName() : "Unknown";
        String email = user.getEmail();

        // Send email in background thread so HTTP response returns immediately
        new Thread(() -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(DEVELOPER_EMAIL);
                message.setSubject("CrossTrack - Gmail Access Request");
                message.setText(
                    "A user is requesting Gmail access for CrossTrack.\n\n" +
                    "Name: " + name + "\n" +
                    "Email: " + email + "\n\n" +
                    "Please add them as a test user in Google Cloud Console:\n" +
                    "https://console.cloud.google.com/apis/credentials/consent\n\n" +
                    "— CrossTrack"
                );
                mailSender.send(message);
                log.info("[Gmail] Access request sent for user {}", email);
            } catch (Exception e) {
                log.error("[Gmail] Failed to send access request for {}: {}", email, e.getMessage());
            }
        }).start();

        return ResponseEntity.ok(Map.of("message", "Request sent!"));
    }

    // ═══════════════════════════════════════════════════
    // GHOST ENDPOINTS (unchanged)
    // ═══════════════════════════════════════════════════

    @GetMapping("/ghost-summary")
    public ResponseEntity<GhostScheduler.GhostSummary> getGhostSummary(Authentication auth) {
        Long userId = getUserId(auth);
        return ResponseEntity.ok(ghostScheduler.getGhostSummary(userId));
    }

    @PostMapping("/ghost-cleanup")
    public ResponseEntity<Map<String, Object>> cleanupGhosts(Authentication auth) {
        Long userId = getUserId(auth);
        int deleted = ghostScheduler.cleanupDeadApplications(userId);
        return ResponseEntity.ok(Map.of(
            "deleted", deleted,
            "message", deleted + " dead application(s) removed"
        ));
    }
}
