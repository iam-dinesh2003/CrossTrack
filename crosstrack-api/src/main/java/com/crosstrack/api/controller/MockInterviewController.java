package com.crosstrack.api.controller;

import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.AiService;
import com.crosstrack.api.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/mock-interview")
@RequiredArgsConstructor
public class MockInterviewController {

    private final AiService aiService;
    private final RateLimitService rateLimitService;
    private final UserRepository userRepository;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Start Mock Interview ──
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startInterview(Authentication auth,
                                                                @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.CHAT)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily chat limit reached"));
        }

        String company = body.get("company");
        String role = body.get("role");
        String interviewType = body.getOrDefault("interviewType", "BEHAVIORAL");
        String resumeText = body.get("resumeText");
        String jobDescription = body.get("jobDescription");

        if (company == null || role == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "company and role are required"));
        }

        Map<String, Object> result = aiService.startMockInterview(company, role, interviewType, resumeText, jobDescription);
        return ResponseEntity.ok(result);
    }

    // ── Submit Answer & Get Next Question ──
    @SuppressWarnings("unchecked")
    @PostMapping("/answer")
    public ResponseEntity<Map<String, Object>> submitAnswer(Authentication auth,
                                                              @RequestBody Map<String, Object> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.CHAT)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily chat limit reached"));
        }

        String company = (String) body.get("company");
        String role = (String) body.get("role");
        String interviewType = (String) body.getOrDefault("interviewType", "BEHAVIORAL");
        String currentQuestion = (String) body.get("currentQuestion");
        String answer = (String) body.get("answer");
        String jobDescription = (String) body.get("jobDescription");
        int questionNumber = body.get("questionNumber") != null ? ((Number) body.get("questionNumber")).intValue() : 1;
        List<Map<String, String>> history = (List<Map<String, String>>) body.getOrDefault("history", List.of());

        if (answer == null || answer.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "answer is required"));
        }

        Map<String, Object> result = aiService.answerMockQuestion(
            company, role, interviewType, currentQuestion, answer, questionNumber, history, jobDescription
        );
        return ResponseEntity.ok(result);
    }
}
