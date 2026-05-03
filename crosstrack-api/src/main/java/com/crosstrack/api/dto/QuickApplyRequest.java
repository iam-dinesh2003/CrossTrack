package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class QuickApplyRequest {
    private String company;
    private String role;
    private String platform;   // normalized platform name (LINKEDIN, INDEED, etc.)
    private String url;        // apply link
    private String location;
    private String salaryRange; // e.g. "$120k – $160k"
}
