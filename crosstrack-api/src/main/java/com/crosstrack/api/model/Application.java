package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "applications",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "company", "role", "platform"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String platform; // LINKEDIN, INDEED, GREENHOUSE, WORKDAY, COMPANY_DIRECT, etc.

    @Builder.Default
    @Column(nullable = false)
    private String status = "APPLIED"; // APPLIED, INTERVIEW, OFFER, REJECTED, GHOSTED, WITHDRAWN

    private String url;

    private String location;

    private String salary;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // Ghost level: 0 = not ghosted, 1 = 28+ days, 2 = 60+ days, 3 = 120+ days
    @Builder.Default
    @Column(name = "ghost_level")
    private Integer ghostLevel = 0;

    // Source: how this application was added (EMAIL_SCAN, MANUAL, EXTENSION)
    @Builder.Default
    @Column(name = "source")
    private String source = "MANUAL";

    // Email ID that created/updated this application (to avoid re-processing)
    @Column(name = "source_email_id")
    private String sourceEmailId;

    @Column(name = "resume_file_name")
    private String resumeFileName;

    @Column(name = "resume_file_path")
    private String resumeFilePath;

    @Column(name = "cover_letter_file_name")
    private String coverLetterFileName;

    @Column(name = "cover_letter_file_path")
    private String coverLetterFilePath;

    // Interview date/time parsed from interview invitation emails
    @Column(name = "interview_date")
    private LocalDateTime interviewDate;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "last_checked")
    private LocalDateTime lastChecked;

    // When the status was last changed (used for ghost tracking)
    @Column(name = "status_changed_at")
    private LocalDateTime statusChangedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (appliedAt == null) appliedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
