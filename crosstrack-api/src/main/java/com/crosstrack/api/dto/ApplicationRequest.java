package com.crosstrack.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApplicationRequest {
    @NotBlank(message = "Company is required")
    private String company;

    @NotBlank(message = "Role is required")
    private String role;

    private String platform;
    private String url;
    private String location;
    private String salary;
    private String notes;
    private String status;
    private String source;
    private String appliedAt;
    private String interviewDate;
}
