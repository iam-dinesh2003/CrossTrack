package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ghost_resolutions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GhostResolution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    @ToString.Exclude
    private Application application;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    private String reason; // timeout, posting_removed, manual

    @Column(name = "posting_active")
    private Boolean postingActive;

    @PrePersist
    protected void onCreate() {
        if (resolvedAt == null) resolvedAt = LocalDateTime.now();
    }
}
