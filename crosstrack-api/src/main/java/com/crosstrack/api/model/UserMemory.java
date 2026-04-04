package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_memory")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String fact;

    @Column(nullable = false)
    private String category; // SKILL, PREFERENCE, EXPERIENCE, GOAL, FEEDBACK, STRENGTH, WEAKNESS

    @Builder.Default
    private String source = "CHAT"; // CHAT, RESUME_ANALYSIS, APPLICATION_PATTERN, MANUAL

    @Builder.Default
    private Double confidence = 0.8;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_relevant_at")
    private LocalDateTime lastRelevantAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        lastRelevantAt = LocalDateTime.now();
    }
}
