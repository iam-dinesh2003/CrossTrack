package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AdminUserResponse {
    private Long id;
    private String email;
    private String displayName;
    private String role;
    private LocalDateTime createdAt;
    private long applicationCount;
    private long resumeCount;
    private boolean gmailConnected;
    // Per-status breakdown: {APPLIED: 5, INTERVIEW: 2, OFFER: 1, REJECTED: 8, GHOSTED: 3, WITHDRAWN: 0}
    private Map<String, Long> statusBreakdown;
    private LocalDateTime lastActivityAt;
}
