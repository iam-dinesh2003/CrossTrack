package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "follow_up_reminder")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FollowUpReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(nullable = false)
    private String type; // GENTLE, SECOND, FINAL

    @Builder.Default
    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, SENT, SNOOZED, DISMISSED

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "ai_draft_email", columnDefinition = "TEXT")
    private String aiDraftEmail;

    @Column(name = "snoozed_until")
    private LocalDate snoozedUntil;

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
