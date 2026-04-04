package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "interview_note")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    @ToString.Exclude
    private Application application;

    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String role;

    @Column(name = "interview_type")
    private String interviewType; // PHONE_SCREEN, TECHNICAL, BEHAVIORAL, ONSITE, FINAL

    @Column(name = "interviewer_name")
    private String interviewerName;

    @Column(name = "raw_notes", columnDefinition = "LONGTEXT")
    private String rawNotes; // User's raw notes

    @Column(name = "ai_summary", columnDefinition = "LONGTEXT")
    private String aiSummary; // AI-generated summary

    @Column(name = "key_questions", columnDefinition = "LONGTEXT")
    private String keyQuestions; // JSON array of questions asked

    @Column(name = "went_well", columnDefinition = "LONGTEXT")
    private String wentWell; // JSON array

    @Column(name = "to_improve", columnDefinition = "LONGTEXT")
    private String toImprove; // JSON array

    @Column(name = "follow_up_actions", columnDefinition = "LONGTEXT")
    private String followUpActions; // JSON array

    @Column(name = "overall_feeling")
    private String overallFeeling; // GREAT, GOOD, NEUTRAL, BAD, TERRIBLE

    @Column(name = "interview_date")
    private LocalDateTime interviewDate;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
