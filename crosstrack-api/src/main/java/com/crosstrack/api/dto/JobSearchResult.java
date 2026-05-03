package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder(toBuilder = true)
@AllArgsConstructor
@NoArgsConstructor
public class JobSearchResult {
    private String jobId;
    private String title;
    private String company;
    private String companyLogo;
    private String location;
    private String city;
    private String state;
    private String country;
    private String publisher;      // "LinkedIn", "Indeed", etc.
    private String employmentType; // "FULLTIME", "PARTTIME", "INTERN", "CONTRACTOR"
    private String applyLink;
    private String applyLinkSource; // "COMPANY", "LINKEDIN", "INDEED", "OTHER"
    private boolean remote;
    private Double salaryMin;
    private Double salaryMax;
    private String salaryCurrency;
    private String salaryPeriod;   // "YEAR", "MONTH", "HOUR"
    private String postedAt;       // ISO datetime string
    private String snippet;        // first 300 chars of description for preview

    // AI match fields — null if resume not available or Gemini not configured
    private Integer matchScore;    // 0–100
    private String  matchReason;   // one-line reason
}
