package com.crosstrack.api.service;

import com.crosstrack.api.dto.ApplicationResponse;
import com.crosstrack.api.dto.DuplicateCheckResponse;
import com.crosstrack.api.model.Application;
import com.crosstrack.api.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.text.similarity.LevenshteinDistance;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DuplicateService {

    private final ApplicationRepository applicationRepository;
    private final LevenshteinDistance levenshtein = new LevenshteinDistance();

    private static final Pattern COMPANY_SUFFIXES = Pattern.compile(
            "\\b(inc|llc|corp|corporation|ltd|limited|co|company|group|holdings|plc)\\b\\.?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern PARENTHETICAL = Pattern.compile("\\s*\\(.*?\\)\\s*");

    private static final Map<String, String> ALIASES = Map.of(
            "bytedance", "tiktok",
            "alphabet", "google",
            "meta platforms", "facebook",
            "meta", "facebook"
    );

    private String normalizeCompany(String name) {
        if (name == null) return "";
        String n = name.toLowerCase().trim();
        n = PARENTHETICAL.matcher(n).replaceAll(" ");
        n = COMPANY_SUFFIXES.matcher(n).replaceAll("");
        n = n.replaceAll("[^\\w\\s]", "").replaceAll("\\s+", " ").trim();
        return ALIASES.getOrDefault(n, n);
    }

    private String normalizeRole(String title) {
        if (title == null) return "";
        String n = title.toLowerCase().trim();
        n = n.replaceAll("\\b(senior|junior|sr|jr|lead|staff|principal|intern)\\b\\.?", "");
        n = n.replaceAll("[^\\w\\s]", "").replaceAll("\\s+", " ").trim();
        return n;
    }

    private double similarity(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        int maxLen = Math.max(a.length(), b.length());
        int dist = levenshtein.apply(a, b);
        return 1.0 - ((double) dist / maxLen);
    }

    public DuplicateCheckResponse checkDuplicate(Long userId, String company, String role) {
        List<Application> apps = applicationRepository.findByUserIdOrderByAppliedAtDesc(userId);
        String normCompany = normalizeCompany(company);
        String normRole = normalizeRole(role);

        double bestScore = 0;
        Application bestMatch = null;
        List<Application> allMatches = new ArrayList<>();

        for (Application app : apps) {
            double companyScore = similarity(normCompany, normalizeCompany(app.getCompany()));
            double roleScore = similarity(normRole, normalizeRole(app.getRole()));
            double finalScore = (companyScore * 0.7) + (roleScore * 0.3);

            if (finalScore > 0.60) {
                allMatches.add(app);
            }
            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestMatch = app;
            }
        }

        boolean isDuplicate = bestScore > 0.80;

        return DuplicateCheckResponse.builder()
                .isDuplicate(isDuplicate)
                .score(bestScore)
                .bestMatch(bestMatch != null ? ApplicationResponse.fromEntity(bestMatch) : null)
                .allMatches(allMatches.stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList()))
                .build();
    }
}
