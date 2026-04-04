package com.crosstrack.api.service;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Ghost Level Scheduler — runs daily and promotes ghost levels.
 *
 * Ghost Level System:
 *   Level 0: Normal — less than 28 days since applied
 *   Level 1: "Possibly Ghosted" — 28+ days, no response (Yellow)
 *   Level 2: "Likely Ghosted" — 60+ days, no response (Orange)
 *   Level 3: "Dead" — 120+ days, prompt user to clean up (Red)
 *
 * Only apps with status APPLIED get ghost-leveled.
 * If status changes (INTERVIEW, OFFER, REJECTED), ghost level resets to 0.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GhostScheduler {

    private final ApplicationRepository applicationRepository;

    private static final int GHOST_L1_DAYS = 28;
    private static final int GHOST_L2_DAYS = 60;
    private static final int GHOST_L3_DAYS = 120;

    /**
     * Run every day at midnight to check and update ghost levels.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void checkGhostLevels() {
        log.info("[GhostScheduler] Running daily ghost level check...");

        List<Application> allApps = applicationRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        int promoted = 0;

        for (Application app : allApps) {
            // Only ghost-check APPLIED status applications
            if (!"APPLIED".equals(app.getStatus())) {
                // If status changed from APPLIED to something else, reset ghost level
                if (app.getGhostLevel() != null && app.getGhostLevel() > 0) {
                    app.setGhostLevel(0);
                    applicationRepository.save(app);
                }
                continue;
            }

            // Calculate days since applied
            LocalDateTime appliedDate = app.getAppliedAt() != null ? app.getAppliedAt() : app.getCreatedAt();
            if (appliedDate == null) continue;

            long daysSinceApplied = ChronoUnit.DAYS.between(appliedDate, now);
            int currentLevel = app.getGhostLevel() != null ? app.getGhostLevel() : 0;
            int newLevel = currentLevel;

            if (daysSinceApplied >= GHOST_L3_DAYS) {
                newLevel = 3;
            } else if (daysSinceApplied >= GHOST_L2_DAYS) {
                newLevel = 2;
            } else if (daysSinceApplied >= GHOST_L1_DAYS) {
                newLevel = 1;
            } else {
                newLevel = 0;
            }

            if (newLevel != currentLevel) {
                app.setGhostLevel(newLevel);
                applicationRepository.save(app);
                promoted++;
                log.info("[GhostScheduler] {} - {} promoted to Ghost L{} ({} days)",
                    app.getCompany(), app.getRole(), newLevel, daysSinceApplied);
            }
        }

        log.info("[GhostScheduler] Done. Promoted {} application(s)", promoted);
    }

    /**
     * Manual trigger — can be called from API endpoint.
     * Returns summary of ghost levels.
     */
    public GhostSummary getGhostSummary(Long userId) {
        List<Application> apps = applicationRepository.findByUserIdOrderByAppliedAtDesc(userId);
        LocalDateTime now = LocalDateTime.now();

        int level1 = 0, level2 = 0, level3 = 0;

        for (Application app : apps) {
            if (!"APPLIED".equals(app.getStatus())) continue;

            LocalDateTime appliedDate = app.getAppliedAt() != null ? app.getAppliedAt() : app.getCreatedAt();
            if (appliedDate == null) continue;

            long days = ChronoUnit.DAYS.between(appliedDate, now);

            // Update ghost level in real-time
            int newLevel = 0;
            if (days >= GHOST_L3_DAYS) { newLevel = 3; level3++; }
            else if (days >= GHOST_L2_DAYS) { newLevel = 2; level2++; }
            else if (days >= GHOST_L1_DAYS) { newLevel = 1; level1++; }

            if (app.getGhostLevel() == null || app.getGhostLevel() != newLevel) {
                app.setGhostLevel(newLevel);
                applicationRepository.save(app);
            }
        }

        return new GhostSummary(level1, level2, level3, GHOST_L1_DAYS, GHOST_L2_DAYS, GHOST_L3_DAYS);
    }

    /**
     * Bulk delete all Level 3 ghost applications for a user.
     */
    public int cleanupDeadApplications(Long userId) {
        List<Application> apps = applicationRepository.findByUserIdOrderByAppliedAtDesc(userId);
        int deleted = 0;

        for (Application app : apps) {
            if (app.getGhostLevel() != null && app.getGhostLevel() == 3) {
                applicationRepository.delete(app);
                deleted++;
                log.info("[GhostScheduler] Deleted dead app: {} - {}", app.getCompany(), app.getRole());
            }
        }

        return deleted;
    }

    public record GhostSummary(
        int level1Count,
        int level2Count,
        int level3Count,
        int level1Days,
        int level2Days,
        int level3Days
    ) {}
}
