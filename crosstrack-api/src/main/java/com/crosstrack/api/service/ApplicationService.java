package com.crosstrack.api.service;

import com.crosstrack.api.dto.ApplicationRequest;
import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.model.Application;
import com.crosstrack.api.model.User;
import com.crosstrack.api.model.GmailAccount;
import com.crosstrack.api.repository.ApplicationRepository;
import com.crosstrack.api.repository.DuplicateFlagRepository;
import com.crosstrack.api.repository.GhostResolutionRepository;
import com.crosstrack.api.repository.GmailAccountRepository;
import com.crosstrack.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final GmailAccountRepository gmailAccountRepository;
    private final GhostResolutionRepository ghostResolutionRepository;
    private final DuplicateFlagRepository duplicateFlagRepository;

    @Value("${crosstrack.uploads.dir:./uploads}")
    private String uploadsDir;

    // Normalize platform to UPPERCASE standard values
    private String normalizePlatform(String platform) {
        if (platform == null || platform.isBlank()) return "OTHER";
        String upper = platform.toUpperCase().trim();
        // Accept all known platforms as-is, normalize unknowns to OTHER
        return switch (upper) {
            case "LINKEDIN", "INDEED", "HANDSHAKE", "GREENHOUSE", "LEVER",
                 "WORKDAY", "ICIMS", "SMARTRECRUITERS", "ASHBY", "JOBVITE",
                 "TALEO", "SAP_SUCCESSFACTORS", "BAMBOOHR", "BREEZY",
                 "RECRUITEE", "JAZZHR", "COMPANY_DIRECT", "OTHER" -> upper;
            case "MANUAL" -> "OTHER";
            default -> "OTHER";
        };
    }

    // Normalize status to UPPERCASE standard values
    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "APPLIED";
        String upper = status.toUpperCase().trim();
        return switch (upper) {
            case "APPLIED" -> "APPLIED";
            case "INTERVIEW", "INTERVIEWING" -> "INTERVIEW";
            case "OFFER", "OFFERED" -> "OFFER";
            case "REJECTED" -> "REJECTED";
            case "GHOSTED" -> "GHOSTED";
            case "WITHDRAWN" -> "WITHDRAWN";
            default -> "APPLIED";
        };
    }

    // Parse appliedAt from various formats (ISO with Z, ISO without Z, etc.)
    private LocalDateTime parseAppliedAt(String appliedAt) {
        if (appliedAt == null || appliedAt.isBlank()) return LocalDateTime.now();
        try {
            // Try ISO instant format first (e.g., "2026-03-13T14:30:45.123Z")
            Instant instant = Instant.parse(appliedAt);
            return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
        } catch (DateTimeParseException e1) {
            try {
                // Try LocalDateTime format (e.g., "2026-03-13T14:30:45")
                return LocalDateTime.parse(appliedAt);
            } catch (DateTimeParseException e2) {
                return LocalDateTime.now();
            }
        }
    }

    public ApplicationResponse createApplication(Long userId, ApplicationRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Application app = Application.builder()
                .user(user)
                .company(req.getCompany())
                .role(req.getRole())
                .platform(normalizePlatform(req.getPlatform()))
                .status(normalizeStatus(req.getStatus()))
                .url(req.getUrl())
                .location(req.getLocation())
                .salary(req.getSalary())
                .notes(req.getNotes())
                .source(req.getSource() != null ? req.getSource().toUpperCase() : "MANUAL")
                .appliedAt(parseAppliedAt(req.getAppliedAt()))
                .build();

        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public List<ApplicationResponse> getApplications(Long userId) {
        return applicationRepository.findByUserIdOrderByAppliedAtDesc(userId)
                .stream()
                .map(ApplicationResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public ApplicationResponse getApplicationById(Long userId, Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        return ApplicationResponse.fromEntity(app);
    }

    public ApplicationResponse updateStatus(Long userId, Long appId, String newStatus) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        app.setStatus(normalizeStatus(newStatus));
        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public ApplicationResponse updateApplication(Long userId, Long appId, ApplicationRequest req) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        if (req.getCompany() != null) app.setCompany(req.getCompany());
        if (req.getRole() != null) app.setRole(req.getRole());
        if (req.getPlatform() != null) app.setPlatform(normalizePlatform(req.getPlatform()));
        if (req.getStatus() != null) app.setStatus(normalizeStatus(req.getStatus()));
        if (req.getUrl() != null) app.setUrl(req.getUrl());
        if (req.getLocation() != null) app.setLocation(req.getLocation());
        if (req.getSalary() != null) app.setSalary(req.getSalary());
        if (req.getNotes() != null) app.setNotes(req.getNotes());

        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public void deleteApplication(Long userId, Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        applicationRepository.delete(app);
    }

    public List<ApplicationResponse> getApplicationsByStatus(Long userId, String status) {
        return applicationRepository.findByUserIdAndStatus(userId, status)
                .stream()
                .map(ApplicationResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public int deleteAllApplications(Long userId) {
        // Delete child records FIRST (FK constraints block application deletion)
        ghostResolutionRepository.deleteAllByUserId(userId);
        duplicateFlagRepository.deleteAllByUserId(userId);

        // Now bulk delete applications — single SQL statement
        int count = applicationRepository.deleteAllByUserId(userId);

        // Reset lastEmailSync so next Gmail scan goes back 90 days
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.setLastEmailSync(null);
            userRepository.save(user);
        }

        // Also reset lastSync on all Gmail accounts
        List<GmailAccount> accounts = gmailAccountRepository.findByUserId(userId);
        for (GmailAccount account : accounts) {
            account.setLastSync(null);
            gmailAccountRepository.save(account);
        }

        return count;
    }

    public ApplicationResponse uploadResume(Long userId, Long appId, MultipartFile file) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        String dir = uploadsDir + "/" + userId + "/" + appId;
        Files.createDirectories(Paths.get(dir));

        String fileName = "resume_" + file.getOriginalFilename();
        Path filePath = Paths.get(dir, fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        app.setResumeFileName(file.getOriginalFilename());
        app.setResumeFilePath(filePath.toString());
        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public ApplicationResponse uploadCoverLetter(Long userId, Long appId, MultipartFile file) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        String dir = uploadsDir + "/" + userId + "/" + appId;
        Files.createDirectories(Paths.get(dir));

        String fileName = "coverletter_" + file.getOriginalFilename();
        Path filePath = Paths.get(dir, fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        app.setCoverLetterFileName(file.getOriginalFilename());
        app.setCoverLetterFilePath(filePath.toString());
        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public byte[] getResumeFile(Long userId, Long appId) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        if (app.getResumeFilePath() == null) {
            throw new RuntimeException("No resume uploaded");
        }
        return Files.readAllBytes(Paths.get(app.getResumeFilePath()));
    }

    public byte[] getCoverLetterFile(Long userId, Long appId) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        if (app.getCoverLetterFilePath() == null) {
            throw new RuntimeException("No cover letter uploaded");
        }
        return Files.readAllBytes(Paths.get(app.getCoverLetterFilePath()));
    }

    public String getResumeFileName(Long userId, Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        return app.getResumeFileName();
    }

    public String getCoverLetterFileName(Long userId, Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        return app.getCoverLetterFileName();
    }

    public ApplicationResponse removeResume(Long userId, Long appId) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        if (app.getResumeFilePath() != null) {
            Files.deleteIfExists(Paths.get(app.getResumeFilePath()));
        }
        app.setResumeFileName(null);
        app.setResumeFilePath(null);
        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }

    public ApplicationResponse removeCoverLetter(Long userId, Long appId) throws IOException {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        if (app.getCoverLetterFilePath() != null) {
            Files.deleteIfExists(Paths.get(app.getCoverLetterFilePath()));
        }
        app.setCoverLetterFileName(null);
        app.setCoverLetterFilePath(null);
        Application saved = applicationRepository.save(app);
        return ApplicationResponse.fromEntity(saved);
    }
}
