package com.crosstrack.api.controller;

import com.crosstrack.api.model.FollowUpReminder;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.FollowUpReminderRepository;
import com.crosstrack.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/follow-ups")
@RequiredArgsConstructor
public class FollowUpController {

    private final FollowUpReminderRepository reminderRepository;
    private final UserRepository userRepository;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Get All Follow-Ups (pending + snoozed) ──
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getFollowUps(Authentication auth,
                                                                    @RequestParam(value = "filter", defaultValue = "active") String filter) {
        User user = getUser(auth);
        List<FollowUpReminder> reminders;

        if ("all".equals(filter)) {
            reminders = reminderRepository.findByUserIdAndStatusInOrderByDueDateAsc(
                user.getId(), List.of("PENDING", "SNOOZED", "SENT", "DISMISSED"));
        } else {
            reminders = reminderRepository.findByUserIdAndStatusInOrderByDueDateAsc(
                user.getId(), List.of("PENDING", "SNOOZED"));
        }

        List<Map<String, Object>> result = reminders.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", r.getId());
            map.put("applicationId", r.getApplication().getId());
            map.put("company", r.getApplication().getCompany());
            map.put("role", r.getApplication().getRole());
            map.put("type", r.getType());
            map.put("status", r.getStatus());
            map.put("dueDate", r.getDueDate().toString());
            map.put("aiDraftEmail", r.getAiDraftEmail());
            map.put("snoozedUntil", r.getSnoozedUntil() != null ? r.getSnoozedUntil().toString() : null);
            map.put("createdAt", r.getCreatedAt().toString());
            return map;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // ── Mark as Sent ──
    @PutMapping("/{id}/sent")
    public ResponseEntity<Map<String, String>> markSent(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        FollowUpReminder reminder = reminderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found"));

        if (!reminder.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your follow-up"));
        }

        reminder.setStatus("SENT");
        reminderRepository.save(reminder);
        return ResponseEntity.ok(Map.of("message", "Marked as sent"));
    }

    // ── Snooze ──
    @PutMapping("/{id}/snooze")
    public ResponseEntity<Map<String, String>> snooze(Authentication auth,
                                                        @PathVariable("id") Long id,
                                                        @RequestBody(required = false) Map<String, Integer> body) {
        User user = getUser(auth);
        FollowUpReminder reminder = reminderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found"));

        if (!reminder.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your follow-up"));
        }

        int days = body != null && body.containsKey("days") ? body.get("days") : 3;
        reminder.setStatus("SNOOZED");
        reminder.setSnoozedUntil(LocalDate.now().plusDays(days));
        reminderRepository.save(reminder);
        return ResponseEntity.ok(Map.of("message", "Snoozed for " + days + " days"));
    }

    // ── Dismiss ──
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> dismiss(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        FollowUpReminder reminder = reminderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found"));

        if (!reminder.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your follow-up"));
        }

        reminder.setStatus("DISMISSED");
        reminderRepository.save(reminder);
        return ResponseEntity.ok(Map.of("message", "Follow-up dismissed"));
    }
}
