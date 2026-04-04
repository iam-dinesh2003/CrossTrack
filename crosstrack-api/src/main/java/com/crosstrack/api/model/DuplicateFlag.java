package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "duplicate_flags")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuplicateFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application1_id")
    @ToString.Exclude
    private Application application1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application2_id")
    @ToString.Exclude
    private Application application2;

    @Column(name = "similarity_score")
    private Double similarityScore;

    @Column(name = "flagged_at")
    private LocalDateTime flaggedAt;

    @Builder.Default
    private Boolean resolved = false;

    @PrePersist
    protected void onCreate() {
        if (flaggedAt == null) flaggedAt = LocalDateTime.now();
    }
}
