package com.crosstrack.api.controller;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.GhostJobScheduler;
import com.crosstrack.api.service.GmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final GhostJobScheduler ghostJobScheduler;
    private final ApplicationRepository applicationRepository;
    private final GmailService gmailService;
    private final UserRepository userRepository;

    @PostMapping("/ghost-check")
    public ResponseEntity<Map<String, Object>> triggerGhostCheck() {
        int resolved = ghostJobScheduler.processGhostApplications();
        return ResponseEntity.ok(Map.of(
                "message", "Ghost check complete",
                "resolvedCount", resolved
        ));
    }

    /**
     * Retroactive Role Repair — re-processes all "Unknown Role" applications
     * by re-fetching the original emails from Gmail and running the improved
     * extraction pipeline (subject anchors + HTML parsing + thread mining).
     */
    @PostMapping("/repair-roles")
    public ResponseEntity<Map<String, Object>> repairRoles(Authentication auth) {
        Long userId = getUserId(auth);

        List<Application> unknowns = applicationRepository
                .findByUserIdAndRoleAndSource(userId, "Unknown Role", "EMAIL_SCAN");

        if (unknowns.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "message", "No Unknown Role entries found",
                    "repaired", 0,
                    "total", 0
            ));
        }

        log.info("[Admin] Starting role repair for user {} — {} unknown roles", userId, unknowns.size());

        int repaired = 0;
        int failed = 0;

        for (Application app : unknowns) {
            try {
                String newRole = gmailService.repairRoleForApplication(userId, app);
                if (newRole != null && !"Unknown Role".equals(newRole)) {
                    String oldRole = app.getRole();
                    app.setRole(newRole);
                    applicationRepository.save(app);
                    repaired++;
                    log.info("[Admin] Repaired: {} at {} — '{}' → '{}'",
                            app.getCompany(), app.getRole(), oldRole, newRole);
                }
            } catch (Exception e) {
                failed++;
                log.warn("[Admin] Failed to repair app {}: {}", app.getId(), e.getMessage());
            }
        }

        log.info("[Admin] Role repair complete: {}/{} repaired, {} failed",
                repaired, unknowns.size(), failed);

        return ResponseEntity.ok(Map.of(
                "message", "Role repair complete",
                "repaired", repaired,
                "total", unknowns.size(),
                "failed", failed
        ));
    }

    private Long getUserId(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
