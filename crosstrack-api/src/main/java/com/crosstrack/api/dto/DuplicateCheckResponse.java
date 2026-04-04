package com.crosstrack.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@AllArgsConstructor
@Builder
public class DuplicateCheckResponse {
    private boolean isDuplicate;
    private double score;
    private ApplicationResponse bestMatch;
    private List<ApplicationResponse> allMatches;
}
