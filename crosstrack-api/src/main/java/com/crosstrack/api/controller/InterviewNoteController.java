package com.crosstrack.api.controller;

import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.InterviewNote;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.InterviewNoteRepository;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.AiService;
import com.crosstrack.api.service.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/interview-notes")
@RequiredArgsConstructor
@Slf4j
public class InterviewNoteController {

    private final InterviewNoteRepository noteRepository;
    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── List All Notes ──
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listNotes(Authentication auth) {
        User user = getUser(auth);
        List<InterviewNote> notes = noteRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<Map<String, Object>> result = notes.stream().map(this::toMap).toList();
        return ResponseEntity.ok(result);
    }

    // ── Get Single Note ──
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getNote(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        InterviewNote note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your note"));
        }
        return ResponseEntity.ok(toMap(note));
    }

    // ── Create Note ──
    @PostMapping
    public ResponseEntity<Map<String, Object>> createNote(Authentication auth,
                                                            @RequestBody Map<String, Object> body) {
        User user = getUser(auth);

        Application app = null;
        if (body.get("applicationId") != null) {
            Long appId = ((Number) body.get("applicationId")).longValue();
            app = applicationRepository.findById(appId).orElse(null);
        }

        InterviewNote note = InterviewNote.builder()
                .user(user)
                .application(app)
                .company((String) body.get("company"))
                .role((String) body.get("role"))
                .interviewType((String) body.getOrDefault("interviewType", "GENERAL"))
                .interviewerName((String) body.get("interviewerName"))
                .rawNotes((String) body.get("rawNotes"))
                .overallFeeling((String) body.getOrDefault("overallFeeling", "NEUTRAL"))
                .interviewDate(body.get("interviewDate") != null ?
                    LocalDateTime.parse((String) body.get("interviewDate")) : LocalDateTime.now())
                .build();

        noteRepository.save(note);
        return ResponseEntity.ok(toMap(note));
    }

    // ── Update Note ──
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateNote(Authentication auth,
                                                            @PathVariable("id") Long id,
                                                            @RequestBody Map<String, Object> body) {
        User user = getUser(auth);
        InterviewNote note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your note"));
        }

        if (body.containsKey("rawNotes")) note.setRawNotes((String) body.get("rawNotes"));
        if (body.containsKey("interviewerName")) note.setInterviewerName((String) body.get("interviewerName"));
        if (body.containsKey("interviewType")) note.setInterviewType((String) body.get("interviewType"));
        if (body.containsKey("overallFeeling")) note.setOverallFeeling((String) body.get("overallFeeling"));

        noteRepository.save(note);
        return ResponseEntity.ok(toMap(note));
    }

    // ── AI Summarize Notes ──
    @PostMapping("/{id}/summarize")
    public ResponseEntity<Map<String, Object>> summarizeNote(Authentication auth,
                                                               @PathVariable("id") Long id) {
        User user = getUser(auth);
        if (!rateLimitService.allowRequest(user.getId(), RateLimitService.Category.GENERATION)) {
            return ResponseEntity.status(429).body(Map.of("error", "Daily generation limit reached"));
        }

        InterviewNote note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your note"));
        }

        if (note.getRawNotes() == null || note.getRawNotes().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No raw notes to summarize"));
        }

        Map<String, Object> summary = aiService.summarizeInterviewNotes(
            note.getRawNotes(), note.getCompany(), note.getRole(), note.getInterviewType()
        );

        // Save AI-generated fields
        try {
            note.setAiSummary((String) summary.get("summary"));
            note.setKeyQuestions(objectMapper.writeValueAsString(summary.get("keyQuestions")));
            note.setWentWell(objectMapper.writeValueAsString(summary.get("wentWell")));
            note.setToImprove(objectMapper.writeValueAsString(summary.get("toImprove")));
            note.setFollowUpActions(objectMapper.writeValueAsString(summary.get("followUpActions")));
            noteRepository.save(note);
        } catch (Exception e) {
            log.error("Failed to save AI summary", e);
        }

        return ResponseEntity.ok(toMap(note));
    }

    // ── Delete Note ──
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNote(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        InterviewNote note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your note"));
        }
        noteRepository.delete(note);
        return ResponseEntity.ok(Map.of("message", "Note deleted"));
    }

    // ── Map helper ──
    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(InterviewNote note) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", note.getId());
        map.put("applicationId", note.getApplication() != null ? note.getApplication().getId() : null);
        map.put("company", note.getCompany());
        map.put("role", note.getRole());
        map.put("interviewType", note.getInterviewType());
        map.put("interviewerName", note.getInterviewerName());
        map.put("rawNotes", note.getRawNotes());
        map.put("aiSummary", note.getAiSummary());
        map.put("overallFeeling", note.getOverallFeeling());
        map.put("interviewDate", note.getInterviewDate() != null ? note.getInterviewDate().toString() : null);
        map.put("createdAt", note.getCreatedAt() != null ? note.getCreatedAt().toString() : null);

        // Parse JSON arrays
        try {
            map.put("keyQuestions", note.getKeyQuestions() != null ? objectMapper.readValue(note.getKeyQuestions(), List.class) : List.of());
            map.put("wentWell", note.getWentWell() != null ? objectMapper.readValue(note.getWentWell(), List.class) : List.of());
            map.put("toImprove", note.getToImprove() != null ? objectMapper.readValue(note.getToImprove(), List.class) : List.of());
            map.put("followUpActions", note.getFollowUpActions() != null ? objectMapper.readValue(note.getFollowUpActions(), List.class) : List.of());
        } catch (Exception e) {
            map.put("keyQuestions", List.of());
            map.put("wentWell", List.of());
            map.put("toImprove", List.of());
            map.put("followUpActions", List.of());
        }

        return map;
    }
}
