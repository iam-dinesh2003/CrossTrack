package com.crosstrack.api.controller;

import com.crosstrack.api.model.CoachMessage;
import com.crosstrack.api.model.User;
import com.crosstrack.api.model.UserMemory;
import com.crosstrack.api.repository.CoachMessageRepository;
import com.crosstrack.api.repository.UserMemoryRepository;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.AiService;
import com.crosstrack.api.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/coach")
@RequiredArgsConstructor
public class CoachController {

    private final AiService aiService;
    private final UserRepository userRepository;
    private final CoachMessageRepository coachMessageRepository;
    private final UserMemoryRepository memoryRepository;
    private final RateLimitService rateLimitService;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Chat with Career Coach ──
    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(Authentication auth,
                                                     @RequestBody Map<String, Object> body) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.CHAT)) {
            return ResponseEntity.status(429).body(Map.of(
                "error", "Daily chat limit reached (30/day). Resets at midnight.",
                "remaining", "0"
            ));
        }

        String sessionId = body.containsKey("sessionId") ? (String) body.get("sessionId") : UUID.randomUUID().toString();
        String message = (String) body.get("message");
        boolean enableWebSearch = body.containsKey("enableWebSearch") && Boolean.TRUE.equals(body.get("enableWebSearch"));

        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "message is required"));
        }

        String response = aiService.chat(user, sessionId, message, enableWebSearch);
        return ResponseEntity.ok(Map.of("response", response, "sessionId", sessionId));
    }

    // ── Get Chat History ──
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(Authentication auth,
                                                                  @RequestParam(value = "sessionId", required = false) String sessionId) {
        User user = getUser(auth);
        List<CoachMessage> messages;
        if (sessionId != null) {
            messages = coachMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtAsc(user.getId(), sessionId);
        } else {
            messages = coachMessageRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        }

        List<Map<String, Object>> result = messages.stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("sessionId", m.getSessionId());
            map.put("role", m.getRole());
            map.put("content", m.getContent());
            map.put("createdAt", m.getCreatedAt().toString());
            return map;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // ── Clear Chat History ──
    @DeleteMapping("/history")
    @Transactional
    public ResponseEntity<Map<String, String>> clearHistory(Authentication auth) {
        User user = getUser(auth);
        coachMessageRepository.deleteByUserId(user.getId());
        return ResponseEntity.ok(Map.of("message", "Chat history cleared"));
    }

    // ── Get User Memories ──
    @GetMapping("/memories")
    public ResponseEntity<List<Map<String, Object>>> getMemories(Authentication auth,
                                                                   @RequestParam(value = "category", required = false) String category) {
        User user = getUser(auth);
        List<UserMemory> memories;
        if (category != null) {
            memories = memoryRepository.findByUserIdAndCategoryAndActiveTrue(user.getId(), category.toUpperCase());
        } else {
            memories = memoryRepository.findByUserIdAndActiveTrueOrderByLastRelevantAtDesc(user.getId());
        }

        List<Map<String, Object>> result = memories.stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("fact", m.getFact());
            map.put("category", m.getCategory());
            map.put("source", m.getSource());
            map.put("confidence", m.getConfidence());
            map.put("createdAt", m.getCreatedAt().toString());
            return map;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // ── Update a Memory ──
    @PutMapping("/memories/{id}")
    public ResponseEntity<Map<String, String>> updateMemory(Authentication auth,
                                                              @PathVariable("id") Long id,
                                                              @RequestBody Map<String, String> body) {
        User user = getUser(auth);
        UserMemory memory = memoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Memory not found"));

        if (!memory.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your memory"));
        }

        if (body.containsKey("fact")) memory.setFact(body.get("fact"));
        if (body.containsKey("category")) memory.setCategory(body.get("category"));
        memory.setLastRelevantAt(LocalDateTime.now());
        memoryRepository.save(memory);

        return ResponseEntity.ok(Map.of("message", "Memory updated"));
    }

    // ── Delete a Memory ──
    @DeleteMapping("/memories/{id}")
    public ResponseEntity<Map<String, String>> deleteMemory(Authentication auth,
                                                              @PathVariable("id") Long id) {
        User user = getUser(auth);
        UserMemory memory = memoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Memory not found"));

        if (!memory.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your memory"));
        }

        memory.setActive(false);
        memoryRepository.save(memory);
        return ResponseEntity.ok(Map.of("message", "Memory deleted"));
    }
}
