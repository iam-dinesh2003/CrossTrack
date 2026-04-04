package com.crosstrack.api.dto;

import com.crosstrack.api.model.Application;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@Builder
public class ApplicationResponse {
    private Long id;
    private String company;
    private String role;
    private String platform;
    private String status;
    private String url;
    private String location;
    private String salary;
    private String notes;
    private Integer ghostLevel;
    private String source;
    private LocalDateTime interviewDate;
    private LocalDateTime appliedAt;
    private LocalDateTime statusChangedAt;
    private String resumeFileName;
    private String coverLetterFileName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ApplicationResponse fromEntity(Application app) {
        return ApplicationResponse.builder()
                .id(app.getId())
                .company(app.getCompany())
                .role(app.getRole())
                .platform(app.getPlatform())
                .status(app.getStatus())
                .url(app.getUrl())
                .location(app.getLocation())
                .salary(app.getSalary())
                .notes(app.getNotes())
                .ghostLevel(app.getGhostLevel())
                .source(app.getSource())
                .interviewDate(app.getInterviewDate())
                .appliedAt(app.getAppliedAt())
                .statusChangedAt(app.getStatusChangedAt())
                .createdAt(app.getCreatedAt())
                .resumeFileName(app.getResumeFileName())
                .coverLetterFileName(app.getCoverLetterFileName())
                .updatedAt(app.getUpdatedAt())
                .build();
    }
}
