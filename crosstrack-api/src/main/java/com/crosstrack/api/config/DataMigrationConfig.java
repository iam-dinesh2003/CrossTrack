package com.crosstrack.api.config;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * One-time data migration to normalize existing lowercase status/platform values to UPPERCASE.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataMigrationConfig {

    private final ApplicationRepository applicationRepository;

    @Bean
    CommandLineRunner normalizeExistingData() {
        return args -> {
            List<Application> all = applicationRepository.findAll();
            int updated = 0;

            for (Application app : all) {
                boolean changed = false;

                // Normalize platform
                String platform = app.getPlatform();
                if (platform != null && !platform.equals(platform.toUpperCase())) {
                    String normalized = switch (platform.toUpperCase().trim()) {
                        case "LINKEDIN" -> "LINKEDIN";
                        case "INDEED" -> "INDEED";
                        case "HANDSHAKE" -> "HANDSHAKE";
                        case "MANUAL" -> "OTHER";
                        default -> "OTHER";
                    };
                    app.setPlatform(normalized);
                    changed = true;
                }

                // Normalize status
                String status = app.getStatus();
                if (status != null && !status.equals(status.toUpperCase())) {
                    String normalized = switch (status.toLowerCase().trim()) {
                        case "applied" -> "APPLIED";
                        case "interviewing", "interview" -> "INTERVIEW";
                        case "offered", "offer" -> "OFFER";
                        case "rejected" -> "REJECTED";
                        case "ghosted" -> "GHOSTED";
                        case "withdrawn" -> "WITHDRAWN";
                        default -> "APPLIED";
                    };
                    app.setStatus(normalized);
                    changed = true;
                }

                if (changed) {
                    applicationRepository.save(app);
                    updated++;
                }
            }

            if (updated > 0) {
                log.info("[CrossTrack] Normalized {} application(s) to UPPERCASE status/platform values", updated);
            }
        };
    }
}
