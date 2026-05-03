package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AdminApplicationResponse {
    private Long id;
    private String company;
    private String role;
    private String status;
    private String platform;
    private LocalDateTime appliedAt;

    // Owner info
    private Long userId;
    private String userEmail;
    private String userDisplayName;
}
