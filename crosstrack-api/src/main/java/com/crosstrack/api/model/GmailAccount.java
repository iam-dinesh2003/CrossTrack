package com.crosstrack.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "gmail_accounts",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "gmail_email"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GmailAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(name = "gmail_email", nullable = false)
    private String gmailEmail;

    // A label to help user identify the account (e.g., "Personal", "College", "Work")
    @Column(name = "label")
    private String label;

    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    @Column(name = "refresh_token", columnDefinition = "TEXT")
    private String refreshToken;

    @Column(name = "token_expiry")
    private LocalDateTime tokenExpiry;

    @Column(name = "connected")
    @Builder.Default
    private Boolean connected = true;

    @Column(name = "last_sync")
    private LocalDateTime lastSync;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
