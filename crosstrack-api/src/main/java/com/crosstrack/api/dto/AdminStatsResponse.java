package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AdminStatsResponse {

    // ── Core counts ──────────────────────────────────────────────────────────
    private long totalUsers;
    private long totalApplications;

    // ── Growth ───────────────────────────────────────────────────────────────
    private long newUsersThisWeek;
    private long newUsersThisMonth;
    private long newAppsThisWeek;
    private long newAppsThisMonth;

    // ── Rates (0–100 doubles) ─────────────────────────────────────────────────
    private double offerRate;       // offers / totalApps * 100
    private double responseRate;    // (offers + interviews) / totalApps * 100
    private double ghostingRate;    // ghosted / totalApps * 100

    // ── Status & platform breakdowns ─────────────────────────────────────────
    private Map<String, Long> statusBreakdown;
    private Map<String, Long> platformBreakdown;

    // ── Platform success (offers per platform) ───────────────────────────────
    private Map<String, Long> platformOfferBreakdown;

    // ── Source breakdown (EMAIL_SCAN / MANUAL / EXTENSION) ───────────────────
    private Map<String, Long> sourceBreakdown;

    // ── Feature adoption ─────────────────────────────────────────────────────
    private long gmailConnectedUsers;
    private long usersWithResumes;
    private long usersWithCoachHistory;

    // ── Data health ───────────────────────────────────────────────────────────
    private long unknownRoleCount;
    private Map<String, Long> ghostLevelBreakdown;  // "1","2","3" → count
    private long activeDuplicateFlags;
}
