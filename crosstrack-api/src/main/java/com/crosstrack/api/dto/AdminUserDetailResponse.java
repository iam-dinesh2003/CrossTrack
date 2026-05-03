package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AdminUserDetailResponse {
    private Long id;
    private String email;
    private String displayName;
    private String role;
    private LocalDateTime createdAt;
    private boolean gmailConnected;
    private int gmailAccountCount;

    // Counts
    private long applicationCount;
    private long resumeCount;
    private long memoryCount;
    private long coachMessageCount;
    private long followUpCount;
    private long interviewNoteCount;

    // Per-status breakdown for metric computation
    private Map<String, Long> statusBreakdown;

    // Applications list (last 50)
    private List<ApplicationSummary> recentApplications;

    // Resume names
    private List<String> resumeNames;

    // AI usage stats
    private Map<String, Object> aiUsage;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class ApplicationSummary {
        private Long id;
        private String company;
        private String role;
        private String status;
        private String platform;
        private String source;
        private int ghostLevel;
        private LocalDateTime appliedAt;
    }
}
