package com.crosstrack.api.controller;

import com.crosstrack.api.dto.*;
import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.*;
import com.crosstrack.api.service.GhostJobScheduler;
import com.crosstrack.api.service.GmailService;
import com.crosstrack.api.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final GhostJobScheduler ghostJobScheduler;
    private final GmailService gmailService;
    private final RateLimitService rateLimitService;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final CoachMessageRepository coachMessageRepository;
    private final UserMemoryRepository userMemoryRepository;
    private final ResumeVariantRepository resumeVariantRepository;
    private final GmailAccountRepository gmailAccountRepository;
    private final InterviewNoteRepository interviewNoteRepository;
    private final FollowUpReminderRepository followUpReminderRepository;
    private final GhostResolutionRepository ghostResolutionRepository;
    private final DuplicateFlagRepository duplicateFlagRepository;

    // ── GET /api/admin/stats ──────────────────────────────────────────────────
    @GetMapping("/stats")
    public ResponseEntity<AdminStatsResponse> getStats() {
        long totalUsers = userRepository.count();
        long totalApps  = applicationRepository.count();

        LocalDateTime weekAgo  = LocalDateTime.now().minusWeeks(1);
        LocalDateTime monthAgo = LocalDateTime.now().minusMonths(1);

        long newUsersThisWeek  = userRepository.countByCreatedAtAfter(weekAgo);
        long newUsersThisMonth = userRepository.countByCreatedAtAfter(monthAgo);
        long newAppsThisWeek   = applicationRepository.countByAppliedAtAfter(weekAgo);
        long newAppsThisMonth  = applicationRepository.countByAppliedAtAfter(monthAgo);

        // Status breakdown
        String[] statuses = {"APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED", "WITHDRAWN"};
        Map<String, Long> statusBreakdown = new LinkedHashMap<>();
        for (String s : statuses) {
            statusBreakdown.put(s, applicationRepository.countByStatus(s));
        }

        // Rates
        long offerCount     = statusBreakdown.getOrDefault("OFFER", 0L);
        long interviewCount = statusBreakdown.getOrDefault("INTERVIEW", 0L);
        long ghostedCount   = statusBreakdown.getOrDefault("GHOSTED", 0L);
        double offerRate    = totalApps > 0 ? offerCount     * 100.0 / totalApps : 0;
        double responseRate = totalApps > 0 ? (offerCount + interviewCount) * 100.0 / totalApps : 0;
        double ghostingRate = totalApps > 0 ? ghostedCount   * 100.0 / totalApps : 0;

        // Platform breakdown (volume)
        Map<String, Long> platformBreakdown = new LinkedHashMap<>();
        applicationRepository.findAll().stream()
                .filter(a -> a.getPlatform() != null)
                .collect(Collectors.groupingBy(Application::getPlatform, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> platformBreakdown.put(e.getKey(), e.getValue()));

        // Platform offer breakdown
        Map<String, Long> platformOfferBreakdown = new LinkedHashMap<>();
        applicationRepository.countByStatusGroupByPlatform("OFFER")
                .forEach(row -> platformOfferBreakdown.put((String) row[0], (Long) row[1]));

        // Source breakdown
        Map<String, Long> sourceBreakdown = new LinkedHashMap<>();
        applicationRepository.countGroupBySource()
                .forEach(row -> sourceBreakdown.put((String) row[0], (Long) row[1]));

        // Ghost level breakdown
        Map<String, Long> ghostLevelBreakdown = new LinkedHashMap<>();
        applicationRepository.countByGhostLevel()
                .forEach(row -> ghostLevelBreakdown.put(String.valueOf(row[0]), (Long) row[1]));

        // Feature adoption
        long gmailConnectedUsers  = userRepository.countByGmailConnectedTrue();
        long usersWithResumes     = resumeVariantRepository.countDistinctUsers();
        long usersWithCoachHistory = coachMessageRepository.countDistinctUsers();

        // Data health
        long unknownRoleCount    = applicationRepository.countByRole("Unknown Role");
        long activeDuplicateFlags = duplicateFlagRepository.countByResolved(false);

        return ResponseEntity.ok(AdminStatsResponse.builder()
                .totalUsers(totalUsers)
                .totalApplications(totalApps)
                .newUsersThisWeek(newUsersThisWeek)
                .newUsersThisMonth(newUsersThisMonth)
                .newAppsThisWeek(newAppsThisWeek)
                .newAppsThisMonth(newAppsThisMonth)
                .offerRate(Math.round(offerRate * 10.0) / 10.0)
                .responseRate(Math.round(responseRate * 10.0) / 10.0)
                .ghostingRate(Math.round(ghostingRate * 10.0) / 10.0)
                .statusBreakdown(statusBreakdown)
                .platformBreakdown(platformBreakdown)
                .platformOfferBreakdown(platformOfferBreakdown)
                .sourceBreakdown(sourceBreakdown)
                .gmailConnectedUsers(gmailConnectedUsers)
                .usersWithResumes(usersWithResumes)
                .usersWithCoachHistory(usersWithCoachHistory)
                .unknownRoleCount(unknownRoleCount)
                .ghostLevelBreakdown(ghostLevelBreakdown)
                .activeDuplicateFlags(activeDuplicateFlags)
                .build());
    }

    // ── GET /api/admin/users ──────────────────────────────────────────────────
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> listUsers(
            @RequestParam(defaultValue = "") String search) {

        List<User> users = search.isBlank()
                ? userRepository.findAll()
                : userRepository.searchUsers(search);

        String[] statuses = {"APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED", "WITHDRAWN"};

        List<AdminUserResponse> response = users.stream().map(u -> {
            long appCount = applicationRepository.countByUserId(u.getId());

            // Per-status breakdown for this user
            Map<String, Long> statusMap = new LinkedHashMap<>();
            for (String s : statuses) {
                statusMap.put(s, applicationRepository.countByUserIdAndStatus(u.getId(), s));
            }

            LocalDateTime lastActivity = applicationRepository
                    .findTopByUserIdOrderByAppliedAtDesc(u.getId())
                    .map(Application::getAppliedAt)
                    .orElse(null);

            return AdminUserResponse.builder()
                    .id(u.getId())
                    .email(u.getEmail())
                    .displayName(u.getDisplayName())
                    .role(u.getRole())
                    .createdAt(u.getCreatedAt())
                    .applicationCount(appCount)
                    .resumeCount(resumeVariantRepository.countByUserId(u.getId()))
                    .gmailConnected(Boolean.TRUE.equals(u.getGmailConnected())
                            || !gmailAccountRepository.findByUserIdAndConnectedTrue(u.getId()).isEmpty())
                    .statusBreakdown(statusMap)
                    .lastActivityAt(lastActivity)
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    // ── GET /api/admin/users/{id} ─────────────────────────────────────────────
    @GetMapping("/users/{id}")
    public ResponseEntity<AdminUserDetailResponse> getUserDetail(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));

        List<Application> apps = applicationRepository.findByUserIdOrderByAppliedAtDesc(id);
        List<AdminUserDetailResponse.ApplicationSummary> appSummaries = apps.stream()
                .limit(50)
                .map(a -> AdminUserDetailResponse.ApplicationSummary.builder()
                        .id(a.getId())
                        .company(a.getCompany())
                        .role(a.getRole())
                        .status(a.getStatus())
                        .platform(a.getPlatform())
                        .source(a.getSource())
                        .ghostLevel(a.getGhostLevel() != null ? a.getGhostLevel() : 0)
                        .appliedAt(a.getAppliedAt())
                        .build())
                .collect(Collectors.toList());

        String[] statuses = {"APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED", "WITHDRAWN"};
        Map<String, Long> statusMap = new LinkedHashMap<>();
        for (String s : statuses) {
            statusMap.put(s, applicationRepository.countByUserIdAndStatus(id, s));
        }

        List<String> resumeNames = resumeVariantRepository.findByUserId(id).stream()
                .map(r -> r.getName() != null ? r.getName() : r.getFileName())
                .collect(Collectors.toList());

        int gmailCount = gmailAccountRepository.findByUserId(id).size();

        return ResponseEntity.ok(AdminUserDetailResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .gmailConnected(Boolean.TRUE.equals(user.getGmailConnected()) || gmailCount > 0)
                .gmailAccountCount(gmailCount)
                .applicationCount(apps.size())
                .resumeCount(resumeVariantRepository.countByUserId(id))
                .memoryCount(userMemoryRepository.countByUserId(id))
                .coachMessageCount(coachMessageRepository.findByUserIdOrderByCreatedAtDesc(id).size())
                .followUpCount(followUpReminderRepository.findByUserIdAndStatusOrderByDueDateAsc(id, "PENDING").size())
                .interviewNoteCount(interviewNoteRepository.findByUserIdOrderByCreatedAtDesc(id).size())
                .statusBreakdown(statusMap)
                .recentApplications(appSummaries)
                .resumeNames(resumeNames)
                .aiUsage(rateLimitService.getUsageStats(id))
                .build());
    }

    // ── DELETE /api/admin/users/{id} ──────────────────────────────────────────
    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteUser(
            @PathVariable Long id,
            Authentication auth) {

        User target = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));

        if (target.getEmail().equalsIgnoreCase(auth.getName())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Cannot delete your own admin account"));
        }

        log.info("[Admin] Deleting user {} ({}) by admin {}", id, target.getEmail(), auth.getName());

        // Delete child records in safe order before deleting user
        interviewNoteRepository.deleteByUserId(id);
        followUpReminderRepository.deleteByUserId(id);
        coachMessageRepository.deleteByUserId(id);
        userMemoryRepository.deleteByUserId(id);
        resumeVariantRepository.deleteByUserId(id);
        gmailAccountRepository.deleteByUserId(id);
        ghostResolutionRepository.deleteAllByUserId(id);
        duplicateFlagRepository.deleteAllByUserId(id);
        applicationRepository.deleteAllByUserId(id);

        userRepository.deleteById(id);

        log.info("[Admin] User {} deleted successfully", id);
        return ResponseEntity.ok(Map.of(
                "message", "User deleted successfully",
                "deletedUserId", id,
                "email", target.getEmail()
        ));
    }

    // ── PUT /api/admin/users/{id}/role ────────────────────────────────────────
    @PutMapping("/users/{id}/role")
    public ResponseEntity<Map<String, Object>> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        User target = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));

        if (target.getEmail().equalsIgnoreCase(auth.getName())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Cannot change your own role"));
        }

        String newRole = body.getOrDefault("role", "ROLE_USER");
        if (!newRole.equals("ROLE_USER") && !newRole.equals("ROLE_ADMIN")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid role. Must be ROLE_USER or ROLE_ADMIN"));
        }

        target.setRole(newRole);
        userRepository.save(target);
        log.info("[Admin] User {} role → {} (by admin {})", id, newRole, auth.getName());

        return ResponseEntity.ok(Map.of(
                "message", "Role updated",
                "userId", id,
                "newRole", newRole
        ));
    }

    // ── POST /api/admin/users/{id}/reset-limits ───────────────────────────────
    @PostMapping("/users/{id}/reset-limits")
    public ResponseEntity<Map<String, Object>> resetUserLimits(@PathVariable Long id) {
        userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));

        rateLimitService.resetLimitsForUser(id);
        log.info("[Admin] AI rate limits reset for user {}", id);

        return ResponseEntity.ok(Map.of(
                "message", "Rate limits reset — user can now use all AI features again today",
                "userId", id
        ));
    }

    // ── GET /api/admin/applications ───────────────────────────────────────────
    @GetMapping("/applications")
    public ResponseEntity<Map<String, Object>> listAllApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String status) {

        PageRequest pageable = PageRequest.of(page, size);
        List<Application> apps = status.isBlank()
                ? applicationRepository.findAllWithUser(pageable)
                : applicationRepository.findAllWithUserByStatus(status, pageable);

        long total = status.isBlank()
                ? applicationRepository.countAllApplications()
                : applicationRepository.countByStatus(status);

        List<AdminApplicationResponse> response = apps.stream().map(a -> AdminApplicationResponse.builder()
                .id(a.getId())
                .company(a.getCompany())
                .role(a.getRole())
                .status(a.getStatus())
                .platform(a.getPlatform())
                .appliedAt(a.getAppliedAt())
                .userId(a.getUser().getId())
                .userEmail(a.getUser().getEmail())
                .userDisplayName(a.getUser().getDisplayName())
                .build()
        ).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "applications", response,
                "total", total,
                "page", page,
                "size", size
        ));
    }

    // ── POST /api/admin/repair-roles/all ─────────────────────────────────────
    @PostMapping("/repair-roles/all")
    public ResponseEntity<Map<String, Object>> repairRolesForAll() {
        List<com.crosstrack.api.model.User> users = userRepository.findAll();
        int totalRepaired = 0, totalFailed = 0, totalFound = 0;

        for (com.crosstrack.api.model.User user : users) {
            List<Application> unknowns = applicationRepository
                    .findByUserIdAndRoleAndSource(user.getId(), "Unknown Role", "EMAIL_SCAN");
            totalFound += unknowns.size();
            for (Application app : unknowns) {
                try {
                    String newRole = gmailService.repairRoleForApplication(user.getId(), app);
                    if (newRole != null && !"Unknown Role".equals(newRole)) {
                        app.setRole(newRole);
                        applicationRepository.save(app);
                        totalRepaired++;
                    }
                } catch (Exception e) {
                    totalFailed++;
                    log.warn("[Admin] Failed to repair app {} for user {}: {}", app.getId(), user.getId(), e.getMessage());
                }
            }
        }

        log.info("[Admin] Global role repair: found={}, repaired={}, failed={}", totalFound, totalRepaired, totalFailed);
        return ResponseEntity.ok(Map.of(
                "message", "Global role repair complete",
                "found", totalFound,
                "repaired", totalRepaired,
                "failed", totalFailed
        ));
    }

    // ── POST /api/admin/ghost-check ───────────────────────────────────────────
    @PostMapping("/ghost-check")
    public ResponseEntity<Map<String, Object>> triggerGhostCheck() {
        int resolved = ghostJobScheduler.processGhostApplications();
        return ResponseEntity.ok(Map.of(
                "message", "Ghost check complete",
                "resolvedCount", resolved
        ));
    }

    // ── POST /api/admin/repair-roles ──────────────────────────────────────────
    @PostMapping("/repair-roles")
    public ResponseEntity<Map<String, Object>> repairRoles(@RequestParam Long userId) {
        List<Application> unknowns = applicationRepository
                .findByUserIdAndRoleAndSource(userId, "Unknown Role", "EMAIL_SCAN");

        if (unknowns.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "No Unknown Role entries found",
                    "repaired", 0, "total", 0));
        }

        log.info("[Admin] Starting role repair for user {} — {} unknown roles", userId, unknowns.size());
        int repaired = 0, failed = 0;

        for (Application app : unknowns) {
            try {
                String newRole = gmailService.repairRoleForApplication(userId, app);
                if (newRole != null && !"Unknown Role".equals(newRole)) {
                    app.setRole(newRole);
                    applicationRepository.save(app);
                    repaired++;
                }
            } catch (Exception e) {
                failed++;
                log.warn("[Admin] Failed to repair app {}: {}", app.getId(), e.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Role repair complete",
                "repaired", repaired,
                "total", unknowns.size(),
                "failed", failed
        ));
    }
}
