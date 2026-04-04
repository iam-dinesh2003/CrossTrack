package com.crosstrack.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DuplicateCheckRequest {
    @NotBlank
    private String company;
    @NotBlank
    private String role;
}
