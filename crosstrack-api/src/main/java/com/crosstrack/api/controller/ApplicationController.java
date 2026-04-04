package com.crosstrack.api.controller;

import com.crosstrack.api.dto.ApplicationRequest;
import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.UserRepository;
import com.crosstrack.api.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final UserRepository userRepository;

    private Long getUserId(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @PostMapping
    public ResponseEntity<ApplicationResponse> create(Authentication auth,
                                                       @Valid @RequestBody ApplicationRequest request) {
        try {
            return ResponseEntity.ok(applicationService.createApplication(getUserId(auth), request));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Duplicate application (same company + role + platform for this user) — return 409 Conflict
            return ResponseEntity.status(409).build();
        }
    }

    @GetMapping
    public ResponseEntity<List<ApplicationResponse>> getAll(Authentication auth) {
        return ResponseEntity.ok(applicationService.getApplications(getUserId(auth)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationResponse> getById(Authentication auth, @PathVariable("id") Long id) {
        return ResponseEntity.ok(applicationService.getApplicationById(getUserId(auth), id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApplicationResponse> updateStatus(Authentication auth,
                                                             @PathVariable("id") Long id,
                                                             @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(applicationService.updateStatus(getUserId(auth), id, body.get("status")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApplicationResponse> update(Authentication auth,
                                                       @PathVariable("id") Long id,
                                                       @RequestBody ApplicationRequest request) {
        return ResponseEntity.ok(applicationService.updateApplication(getUserId(auth), id, request));
    }

    @DeleteMapping("/all")
    public ResponseEntity<Map<String, Object>> deleteAll(Authentication auth) {
        try {
            int deleted = applicationService.deleteAllApplications(getUserId(auth));
            return ResponseEntity.ok(Map.of("deleted", deleted));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Delete failed"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable("id") Long id) {
        applicationService.deleteApplication(getUserId(auth), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<ApplicationResponse>> getByStatus(Authentication auth,
                                                                  @PathVariable String status) {
        return ResponseEntity.ok(applicationService.getApplicationsByStatus(getUserId(auth), status));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ApplicationResponse> uploadResume(Authentication auth,
                                                             @PathVariable("id") Long id,
                                                             @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) return ResponseEntity.badRequest().build();
            String name = file.getOriginalFilename();
            if (name == null || (!name.toLowerCase().endsWith(".pdf") && !name.toLowerCase().endsWith(".docx") && !name.toLowerCase().endsWith(".doc"))) {
                return ResponseEntity.badRequest().build();
            }
            if (file.getSize() > 5 * 1024 * 1024) return ResponseEntity.badRequest().build(); // 5MB limit
            return ResponseEntity.ok(applicationService.uploadResume(getUserId(auth), id, file));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/cover-letter")
    public ResponseEntity<ApplicationResponse> uploadCoverLetter(Authentication auth,
                                                                   @PathVariable("id") Long id,
                                                                   @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) return ResponseEntity.badRequest().build();
            String name = file.getOriginalFilename();
            if (name == null || (!name.toLowerCase().endsWith(".pdf") && !name.toLowerCase().endsWith(".docx") && !name.toLowerCase().endsWith(".doc"))) {
                return ResponseEntity.badRequest().build();
            }
            if (file.getSize() > 5 * 1024 * 1024) return ResponseEntity.badRequest().build();
            return ResponseEntity.ok(applicationService.uploadCoverLetter(getUserId(auth), id, file));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/resume")
    public ResponseEntity<byte[]> downloadResume(Authentication auth, @PathVariable("id") Long id) {
        try {
            byte[] data = applicationService.getResumeFile(getUserId(auth), id);
            String fileName = applicationService.getResumeFileName(getUserId(auth), id);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/cover-letter")
    public ResponseEntity<byte[]> downloadCoverLetter(Authentication auth, @PathVariable("id") Long id) {
        try {
            byte[] data = applicationService.getCoverLetterFile(getUserId(auth), id);
            String fileName = applicationService.getCoverLetterFileName(getUserId(auth), id);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}/resume")
    public ResponseEntity<ApplicationResponse> removeResume(Authentication auth, @PathVariable("id") Long id) {
        try {
            return ResponseEntity.ok(applicationService.removeResume(getUserId(auth), id));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}/cover-letter")
    public ResponseEntity<ApplicationResponse> removeCoverLetter(Authentication auth, @PathVariable("id") Long id) {
        try {
            return ResponseEntity.ok(applicationService.removeCoverLetter(getUserId(auth), id));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
