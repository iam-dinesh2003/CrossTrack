package com.crosstrack.api.service;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.GhostResolution;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.GhostResolutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class GhostJobScheduler {

    private final ApplicationRepository applicationRepository;
    private final GhostResolutionRepository ghostResolutionRepository;
    private final NotificationService notificationService;

    @Value("${ghost.timeout.days}")
    private int timeoutDays;

    @Scheduled(cron = "${ghost.check.cron}")
    public void resolveGhostApplications() {
        log.info("Starting ghost job resolution check...");
        processGhostApplications();
    }

    public int processGhostApplications() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(timeoutDays);
        List<Application> staleApps = applicationRepository.findByStatusAndAppliedAtBefore("APPLIED", cutoff);

        int resolved = 0;
        for (Application app : staleApps) {
            boolean postingActive = checkPostingActive(app.getUrl());
            String reason;

            if (!postingActive) {
                reason = "posting_removed";
            } else if (app.getAppliedAt().isBefore(LocalDateTime.now().minusDays(30))) {
                reason = "timeout";
            } else {
                continue; // Still within 30-day window and posting is active
            }

            app.setStatus("GHOSTED");
            app.setLastChecked(LocalDateTime.now());
            applicationRepository.save(app);

            GhostResolution resolution = GhostResolution.builder()
                    .application(app)
                    .reason(reason)
                    .postingActive(postingActive)
                    .build();
            ghostResolutionRepository.save(resolution);

            // Send notification
            try {
                notificationService.sendGhostNotification(app.getUser().getId(), app);
            } catch (Exception e) {
                log.warn("Failed to send ghost notification for app {}: {}", app.getId(), e.getMessage());
            }

            resolved++;
            log.info("Ghosted: {} - {} (reason: {})", app.getCompany(), app.getRole(), reason);
        }

        log.info("Ghost check complete: {} applications resolved out of {} checked", resolved, staleApps.size());
        return resolved;
    }

    private boolean checkPostingActive(String urlString) {
        if (urlString == null || urlString.isBlank()) return false;
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            conn.disconnect();
            return code >= 200 && code < 400;
        } catch (Exception e) {
            return false;
        }
    }
}
