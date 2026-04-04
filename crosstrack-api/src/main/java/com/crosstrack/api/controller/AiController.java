package com.crosstrack.api.controller;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.AiService;
import com.crosstrack.api.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final RateLimitService rateLimitService;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Resume-JD Match Score ──
    @PostMapping("/match-score")
    public ResponseEntity<Map<String, Object>> matchScore(Authentication auth,
                                                           @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached. Resets at midnight."));
        }
        String resume = body.get("resumeText");
        String jd = body.get("jobDescription");
        if (resume == null || jd == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "resumeText and jobDescription are required"));
        }
        return ResponseEntity.ok(aiService.getMatchScore(resume, jd));
    }

    // ── Cover Letter Generator ──
    @PostMapping("/cover-letter")
    public ResponseEntity<Map<String, String>> coverLetter(Authentication auth,
                                                            @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached. Resets at midnight."));
        }
        String letter = aiService.generateCoverLetter(
            body.get("resumeText"),
            body.get("jobDescription"),
            body.get("company"),
            body.get("role"),
            body.getOrDefault("tone", "professional but warm")
        );
        return ResponseEntity.ok(Map.of("coverLetter", letter));
    }

    // ── Follow-Up Email Generator ──
    @PostMapping("/follow-up-email")
    public ResponseEntity<Map<String, String>> followUpEmail(Authentication auth,
                                                              @RequestBody Map<String, Object> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached. Resets at midnight."));
        }
        String email = aiService.generateFollowUpEmail(
            (String) body.get("company"),
            (String) body.get("role"),
            body.get("daysSinceApplied") != null ? ((Number) body.get("daysSinceApplied")).intValue() : 7,
            (String) body.getOrDefault("type", "GENTLE"),
            (String) body.get("context")
        );
        return ResponseEntity.ok(Map.of("email", email));
    }

    // ── Interview Prep ──
    @PostMapping("/interview-prep")
    public ResponseEntity<Map<String, Object>> interviewPrep(Authentication auth,
                                                              @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached. Resets at midnight."));
        }
        return ResponseEntity.ok(aiService.generateInterviewPrep(
            body.get("company"),
            body.get("role"),
            body.get("resumeText")
        ));
    }

    // ── Application Autopsy ──
    @PostMapping("/application-autopsy")
    public ResponseEntity<Map<String, Object>> applicationAutopsy(Authentication auth,
                                                                    @RequestBody Map<String, Long> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached. Resets at midnight."));
        }
        Long appId = body.get("applicationId");
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        return ResponseEntity.ok(aiService.analyzeRejection(user, app));
    }
}
