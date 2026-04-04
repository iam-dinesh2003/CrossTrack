package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@Builder
public class AnalyticsResponse {
    private long totalApplications;
    private long applied;
    private long interviewing;
    private long offered;
    private long rejected;
    private long ghosted;
    private Map<String, Long> platformBreakdown;
    private List<Map<String, Object>> weeklyApplications;
    private List<ApplicationResponse> recentApplications;
}
