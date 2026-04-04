package com.crosstrack.api.controller;

import com.crosstrack.api.dto.AnalyticsResponse;
import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;

    @GetMapping("/summary")
    public ResponseEntity<AnalyticsResponse> getSummary(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        Long userId = user.getId();

        // Platform breakdown
        Map<String, Long> platformBreakdown = new LinkedHashMap<>();
        for (Object[] row : applicationRepository.countByUserIdGroupByPlatform(userId)) {
            platformBreakdown.put((String) row[0], (Long) row[1]);
        }

        // Weekly applications
        List<Map<String, Object>> weekly = applicationRepository.countWeeklyByUserId(userId)
                .stream()
                .limit(12)
                .map(row -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("week", row[0].toString());
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        // Recent applications (last 10)
        List<ApplicationResponse> recent = applicationRepository.findByUserIdOrderByAppliedAtDesc(userId)
                .stream()
                .limit(10)
                .map(ApplicationResponse::fromEntity)
                .collect(Collectors.toList());

        AnalyticsResponse response = AnalyticsResponse.builder()
                .totalApplications(applicationRepository.countByUserId(userId))
                .applied(applicationRepository.countByUserIdAndStatus(userId, "APPLIED"))
                .interviewing(applicationRepository.countByUserIdAndStatus(userId, "INTERVIEW"))
                .offered(applicationRepository.countByUserIdAndStatus(userId, "OFFER"))
                .rejected(applicationRepository.countByUserIdAndStatus(userId, "REJECTED"))
                .ghosted(applicationRepository.countByUserIdAndStatus(userId, "GHOSTED"))
                .platformBreakdown(platformBreakdown)
                .weeklyApplications(weekly)
                .recentApplications(recent)
                .build();

        return ResponseEntity.ok(response);
    }
}
