package com.crosstrack.api.controller;

import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.AiService;
import com.crosstrack.api.service.RateLimitService;
import com.crosstrack.api.service.WebSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class WebSearchController {

    private final WebSearchService webSearchService;
    private final AiService aiService;
    private final RateLimitService rateLimitService;
    private final UserRepository userRepository;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Web Search ──
    @PostMapping("/web-search")
    public ResponseEntity<Map<String, Object>> webSearch(Authentication auth,
                                                          @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.SEARCH)) {
            return ResponseEntity.status(429).body(Map.of(
                "error", "Daily search limit reached",
                "remaining", rateLimitService.remaining(user.getId(), RateLimitService.Category.SEARCH)
            ));
        }

        String query = body.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "query is required"));
        }

        List<Map<String, String>> results = webSearchService.search(query);
        return ResponseEntity.ok(Map.of("results", results, "query", query));
    }

    // ── Research (search + AI analysis) ──
    @PostMapping("/research")
    public ResponseEntity<Map<String, Object>> research(Authentication auth,
                                                          @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        // Costs both a search AND a chat
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.SEARCH)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily search limit reached"));
        }
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.CHAT)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily chat limit reached"));
        }

        String query = body.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "query is required"));
        }

        Map<String, Object> result = aiService.searchAndAnalyze(query);
        return ResponseEntity.ok(result);
    }

    // ── Get Usage Stats ──
    @GetMapping("/usage")
    public ResponseEntity<Map<String, Object>> getUsage(Authentication auth) {
        User user = getUser(auth);
        Map<String, Object> usage = new java.util.LinkedHashMap<>(rateLimitService.getUsageStats(user.getId()));
        usage.put("aiConfigured", aiService.isConfigured());
        return ResponseEntity.ok(usage);
    }
}
