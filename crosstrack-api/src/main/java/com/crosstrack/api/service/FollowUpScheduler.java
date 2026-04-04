package com.crosstrack.api.service;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.FollowUpReminder;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.FollowUpReminderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class FollowUpScheduler {

    private final ApplicationRepository applicationRepository;
    private final FollowUpReminderRepository reminderRepository;
    private final AiService aiService;

    @Value("${followup.gentle.days:7}")
    private int gentleDays;

    @Value("${followup.second.days:14}")
    private int secondDays;

    @Value("${followup.final.days:21}")
    private int finalDays;

    @Scheduled(cron = "${followup.check.cron:0 0 9 * * *}")
    public void checkFollowUps() {
        log.info("[FollowUp] Running daily follow-up check...");
        List<Application> appliedApps = applicationRepository.findByStatusAndAppliedAtIsNotNull("APPLIED");

        int created = 0;
        for (Application app : appliedApps) {
            long daysSince = ChronoUnit.DAYS.between(app.getAppliedAt().toLocalDate(), LocalDate.now());

            if (daysSince >= gentleDays) {
                created += createReminderIfNeeded(app, "GENTLE", daysSince);
            }
            if (daysSince >= secondDays) {
                created += createReminderIfNeeded(app, "SECOND", daysSince);
            }
            if (daysSince >= finalDays) {
                created += createReminderIfNeeded(app, "FINAL", daysSince);
            }
        }

        log.info("[FollowUp] Check complete. Created {} new reminders from {} applied applications.", created, appliedApps.size());
    }

    private int createReminderIfNeeded(Application app, String type, long daysSince) {
        if (reminderRepository.existsByApplicationIdAndType(app.getId(), type)) {
            return 0;
        }

        try {
            String draftEmail = aiService.generateFollowUpEmail(
                app.getCompany(),
                app.getRole(),
                (int) daysSince,
                type,
                null
            );

            FollowUpReminder reminder = FollowUpReminder.builder()
                    .application(app)
                    .user(app.getUser())
                    .type(type)
                    .dueDate(LocalDate.now())
                    .aiDraftEmail(draftEmail)
                    .build();

            reminderRepository.save(reminder);
            log.info("[FollowUp] Created {} reminder for {} at {} (day {})",
                    type, app.getRole(), app.getCompany(), daysSince);
            return 1;
        } catch (Exception e) {
            log.error("[FollowUp] Failed to create reminder for app {}: {}", app.getId(), e.getMessage());
            return 0;
        }
    }
}
