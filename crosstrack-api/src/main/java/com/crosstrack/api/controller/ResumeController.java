package com.crosstrack.api.controller;

import com.crosstrack.api.model.ResumeVariant;
import com.crosstrack.api.model.User;
import com.crosstrack.api.repository.ResumeVariantRepository;
import com.crosstrack.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/resumes")
@RequiredArgsConstructor
@Slf4j
public class ResumeController {

    private final ResumeVariantRepository resumeRepository;
    private final UserRepository userRepository;

    @Value("${crosstrack.uploads.dir:./uploads}")
    private String uploadsDir;

    private User getUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Upload Resume ──
    @PostMapping
    public ResponseEntity<Map<String, Object>> upload(Authentication auth,
                                                        @RequestParam("file") MultipartFile file,
                                                        @RequestParam("name") String name,
                                                        @RequestParam(value = "parsedText", required = false) String parsedText) {
        User user = getUser(auth);
        try {
            Path uploadPath = Paths.get(uploadsDir, "resumes", user.getId().toString());
            Files.createDirectories(uploadPath);

            String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Auto-extract text from file if no parsedText provided
            if (parsedText == null || parsedText.isBlank()) {
                parsedText = extractTextFromFile(file);
            }

            // If this is first resume, make it default
            boolean isDefault = resumeRepository.findByUserId(user.getId()).isEmpty();

            ResumeVariant resume = ResumeVariant.builder()
                    .user(user)
                    .name(name)
                    .fileName(file.getOriginalFilename())
                    .filePath(filePath.toString())
                    .parsedText(parsedText)
                    .isDefault(isDefault)
                    .build();

            resumeRepository.save(resume);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", resume.getId());
            result.put("name", resume.getName());
            result.put("fileName", resume.getFileName());
            result.put("isDefault", resume.getIsDefault());
            result.put("hasParsedText", parsedText != null && !parsedText.isBlank());
            result.put("createdAt", resume.getCreatedAt().toString());
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }
    }

    // ── Auto-extract text from PDF or DOCX ──
    private String extractTextFromFile(MultipartFile file) {
        String originalName = file.getOriginalFilename();
        if (originalName == null) return null;

        String lower = originalName.toLowerCase();
        try {
            if (lower.endsWith(".pdf")) {
                return extractFromPdf(file);
            } else if (lower.endsWith(".docx")) {
                return extractFromDocx(file);
            }
        } catch (Exception e) {
            log.warn("[Resume] Failed to extract text from {}: {}", originalName, e.getMessage());
        }
        return null;
    }

    private String extractFromPdf(MultipartFile file) throws IOException {
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            return text != null ? text.trim() : null;
        }
    }

    private String extractFromDocx(MultipartFile file) throws IOException {
        try (InputStream is = file.getInputStream();
             XWPFDocument document = new XWPFDocument(is)) {
            return document.getParagraphs().stream()
                    .map(XWPFParagraph::getText)
                    .filter(t -> t != null && !t.isBlank())
                    .collect(Collectors.joining("\n"))
                    .trim();
        }
    }

    // ── List Resumes ──
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(Authentication auth) {
        User user = getUser(auth);
        List<ResumeVariant> resumes = resumeRepository.findByUserId(user.getId());

        List<Map<String, Object>> result = resumes.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", r.getId());
            map.put("name", r.getName());
            map.put("fileName", r.getFileName());
            map.put("isDefault", r.getIsDefault());
            map.put("hasParsedText", r.getParsedText() != null && !r.getParsedText().isEmpty());
            map.put("createdAt", r.getCreatedAt().toString());
            return map;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // ── Get Default Resume (for extension sidebar) ──
    @GetMapping("/default")
    public ResponseEntity<?> getDefault(Authentication auth) {
        User user = getUser(auth);
        Optional<ResumeVariant> defaultResume = resumeRepository.findByUserIdAndIsDefaultTrue(user.getId());
        if (defaultResume.isEmpty()) {
            // Fall back to most recently uploaded resume
            List<ResumeVariant> all = resumeRepository.findByUserId(user.getId());
            if (all.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "No resume found. Please upload one in CrossTrack."));
            }
            ResumeVariant last = all.get(all.size() - 1);
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", last.getId());
            map.put("name", last.getName());
            map.put("parsedText", last.getParsedText() != null ? last.getParsedText() : "");
            map.put("isDefault", false);
            return ResponseEntity.ok(map);
        }
        ResumeVariant r = defaultResume.get();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId());
        map.put("name", r.getName());
        map.put("parsedText", r.getParsedText() != null ? r.getParsedText() : "");
        map.put("isDefault", true);
        return ResponseEntity.ok(map);
    }

    // ── Set Default Resume ──
    @PutMapping("/{id}/default")
    public ResponseEntity<Map<String, String>> setDefault(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);

        // Unset all defaults first
        resumeRepository.findByUserId(user.getId()).forEach(r -> {
            r.setIsDefault(false);
            resumeRepository.save(r);
        });

        // Set new default
        ResumeVariant resume = resumeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resume not found"));
        if (!resume.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your resume"));
        }
        resume.setIsDefault(true);
        resumeRepository.save(resume);

        return ResponseEntity.ok(Map.of("message", "Default resume updated"));
    }

    // ── Delete Resume ──
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        ResumeVariant resume = resumeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resume not found"));
        if (!resume.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your resume"));
        }

        // Delete file
        try {
            if (resume.getFilePath() != null) {
                Files.deleteIfExists(Paths.get(resume.getFilePath()));
            }
        } catch (IOException ignored) {}

        resumeRepository.delete(resume);
        return ResponseEntity.ok(Map.of("message", "Resume deleted"));
    }

    // ── Get Parsed Text ──
    @GetMapping("/{id}/text")
    public ResponseEntity<Map<String, String>> getText(Authentication auth, @PathVariable("id") Long id) {
        User user = getUser(auth);
        ResumeVariant resume = resumeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resume not found"));
        if (!resume.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your resume"));
        }

        return ResponseEntity.ok(Map.of(
            "text", resume.getParsedText() != null ? resume.getParsedText() : "",
            "name", resume.getName()
        ));
    }
}
