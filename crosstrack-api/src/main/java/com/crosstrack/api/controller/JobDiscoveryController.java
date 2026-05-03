package com.crosstrack.api.controller;

import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.dto.JobSearchResult;
import com.crosstrack.api.dto.QuickApplyRequest;
import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.JobDiscoveryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
@Slf4j
public class JobDiscoveryController {

    private final JobDiscoveryService jobDiscoveryService;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;

    @Value("${rapidapi.key:}")
    private String rapidApiKey;

    // ── GET /api/jobs/discover ────────────────────────────────────────────────
    @GetMapping("/discover")
    public ResponseEntity<?> discoverJobs(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "false") boolean remote,
            @RequestParam(defaultValue = "") String employmentType,
            @RequestParam(defaultValue = "") String publishers,
            @RequestParam(required = false) Long resumeId,
            Authentication auth) {

        if (rapidApiKey == null || rapidApiKey.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "jobs", List.of(),
                    "apiKeyMissing", true,
                    "message", "Add your RapidAPI key to enable job discovery. Get it free at rapidapi.com/jsearch"
            ));
        }

        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<JobSearchResult> jobs = jobDiscoveryService.searchJobs(
                user.getId(), query, page, location, remote, employmentType, publishers, resumeId);

        // Build the auto-query so frontend can show what was used
        String usedQuery = (query == null || query.isBlank())
                ? jobDiscoveryService.buildQueryFromProfile(user.getId())
                : query;

        return ResponseEntity.ok(Map.of(
                "jobs", jobs,
                "usedQuery", usedQuery,
                "apiKeyMissing", false,
                "page", page
        ));
    }

    // ── POST /api/jobs/quick-apply ────────────────────────────────────────────
    // Creates an Application record from a job discovery card + returns it
    @PostMapping("/quick-apply")
    public ResponseEntity<Map<String, Object>> quickApply(
            @RequestBody QuickApplyRequest req,
            Authentication auth) {

        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check for duplicates
        boolean exists = applicationRepository.existsByUserIdAndCompanyAndRole(
                user.getId(), req.getCompany(), req.getRole());

        if (exists) {
            return ResponseEntity.ok(Map.of(
                    "duplicate", true,
                    "message", "You've already tracked an application to " + req.getCompany() + " for this role"
            ));
        }

        // Normalize platform
        String platform = normalizePlatform(req.getPlatform());

        Application app = Application.builder()
                .user(user)
                .company(req.getCompany())
                .role(req.getRole())
                .platform(platform)
                .status("APPLIED")
                .url(req.getUrl())
                .location(req.getLocation())
                .notes(req.getSalaryRange() != null && !req.getSalaryRange().isBlank()
                        ? "Salary: " + req.getSalaryRange()
                        : null)
                .source("JOB_DISCOVERY")
                .appliedAt(LocalDateTime.now())
                .build();

        Application saved = applicationRepository.save(app);
        log.info("[JobDiscovery] Quick-applied: user={} company={} role={}", user.getId(), req.getCompany(), req.getRole());

        return ResponseEntity.ok(Map.of(
                "duplicate", false,
                "application", ApplicationResponse.fromEntity(saved),
                "message", "Application tracked! Good luck at " + req.getCompany()
        ));
    }

    private String normalizePlatform(String raw) {
        if (raw == null || raw.isBlank()) return "OTHER";
        String upper = raw.toUpperCase().replace(" ", "_");
        return switch (upper) {
            case "LINKEDIN"     -> "LINKEDIN";
            case "INDEED"       -> "INDEED";
            case "GLASSDOOR"    -> "INDEED"; // map glassdoor to INDEED
            case "ZIPRECRUITER" -> "OTHER";
            case "HANDSHAKE"    -> "HANDSHAKE";
            case "GREENHOUSE"   -> "GREENHOUSE";
            case "LEVER"        -> "LEVER";
            case "WORKDAY"      -> "WORKDAY";
            default             -> "OTHER";
        };
    }
}
