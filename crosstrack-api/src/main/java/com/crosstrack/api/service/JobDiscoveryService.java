package com.crosstrack.api.service;

import com.crosstrack.api.dto.JobSearchResult;
import com.crosstrack.api.model.ResumeVariant;
import com.crosstrack.api.model.UserMemory;
import com.crosstrack.api.repository.ResumeVariantRepository;
import com.crosstrack.api.repository.UserMemoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobDiscoveryService {

    private final UserMemoryRepository userMemoryRepository;
    private final ResumeVariantRepository resumeVariantRepository;
    private final AiService aiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${rapidapi.key:}")
    private String rapidApiKey;

    @Value("${rapidapi.jsearch.host:jsearch.p.rapidapi.com}")
    private String jsearchHost;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    // Job board domains — used to detect if a link is company-direct or aggregator
    private static final Set<String> AGGREGATOR_DOMAINS = Set.of(
            "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com",
            "handshake.com", "monster.com", "careerbuilder.com", "simplyhired.com",
            "dice.com", "snagajob.com", "jobvite.com", "greenhouse.io", "lever.co",
            "workday.com", "smartrecruiters.com", "myworkdayjobs.com"
    );

    private static final Map<String, String> PUBLISHER_TO_PLATFORM = Map.of(
            "linkedin",     "LINKEDIN",
            "indeed",       "INDEED",
            "glassdoor",    "GLASSDOOR",
            "ziprecruiter", "ZIPRECRUITER",
            "handshake",    "HANDSHAKE",
            "greenhouse",   "GREENHOUSE",
            "lever",        "LEVER",
            "workday",      "WORKDAY"
    );

    /**
     * Search jobs using JSearch API.
     * — Fetches 20 results (2 pages)
     * — Only jobs posted within last 3 days
     * — Deduplicates by title+company, prefers company website links
     * — Scores each job against the user's default resume via Gemini (if available)
     */
    public List<JobSearchResult> searchJobs(Long userId, String query,
                                             int page, String location,
                                             boolean remoteOnly, String employmentType,
                                             String publishers, Long resumeId) {
        if (rapidApiKey == null || rapidApiKey.isBlank()) {
            log.warn("[JobDiscovery] RapidAPI key not configured");
            return Collections.emptyList();
        }

        String searchQuery = (query != null && !query.isBlank())
                ? query
                : buildQueryFromProfile(userId);

        if (!location.isBlank()) {
            searchQuery = searchQuery + " " + location;
        }

        log.info("[JobDiscovery] Searching: '{}' page={} remote={} type={}", searchQuery, page, remoteOnly, employmentType);

        HttpUrl.Builder urlBuilder = new HttpUrl.Builder()
                .scheme("https")
                .host(jsearchHost)
                .addPathSegments("search")
                .addQueryParameter("query", searchQuery)
                .addQueryParameter("page", String.valueOf(page))
                .addQueryParameter("num_pages", "2")         // 20 results per call
                .addQueryParameter("date_posted", "3days");  // only recent jobs

        if (remoteOnly) {
            urlBuilder.addQueryParameter("remote_jobs_only", "true");
        }
        if (employmentType != null && !employmentType.isBlank()) {
            urlBuilder.addQueryParameter("employment_types", employmentType);
        }

        Request request = new Request.Builder()
                .url(urlBuilder.build())
                .get()
                .addHeader("X-RapidAPI-Key", rapidApiKey)
                .addHeader("X-RapidAPI-Host", jsearchHost)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                log.error("[JobDiscovery] API error: {}", response.code());
                return Collections.emptyList();
            }

            String body = response.body().string();
            JsonNode root = objectMapper.readTree(body);
            JsonNode data = root.get("data");

            if (data == null || !data.isArray()) {
                return Collections.emptyList();
            }

            // Parse all jobs
            List<JobSearchResult> raw = new ArrayList<>();
            for (JsonNode job : data) {
                raw.add(parseJob(job));
            }

            // Filter by selected publishers (if any selected)
            List<JobSearchResult> filtered = filterByPublishers(raw, publishers);

            // Deduplicate: same title+company → keep best apply link
            List<JobSearchResult> deduped = deduplicateJobs(filtered);
            log.info("[JobDiscovery] {} raw → {} after dedup", raw.size(), deduped.size());

            // Sort: company-direct links first, then by recency
            deduped.sort(Comparator
                    .comparingInt((JobSearchResult j) -> linkPriority(j.getApplyLinkSource()))
                    .thenComparing(Comparator.comparing(
                            j -> j.getPostedAt() != null ? j.getPostedAt() : "",
                            Comparator.reverseOrder())));

            // AI match scoring — use specified resume if provided, else fall back to default
            Optional<ResumeVariant> resume = (resumeId != null)
                    ? resumeVariantRepository.findById(resumeId)
                    : resumeVariantRepository.findByUserIdAndIsDefaultTrue(userId);
            if (resume.isPresent() && resume.get().getParsedText() != null && aiService.isConfigured()) {
                log.info("[JobDiscovery] Scoring {} jobs against resume with Gemini", deduped.size());
                deduped = aiService.batchScoreJobs(resume.get().getParsedText(), deduped);
                // Re-sort by match score (highest first) when AI is available
                deduped.sort(Comparator.comparingInt(
                        (JobSearchResult j) -> j.getMatchScore() != null ? j.getMatchScore() : 0)
                        .reversed());
            }

            return deduped;

        } catch (Exception e) {
            log.error("[JobDiscovery] Error calling JSearch API: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Filters jobs by selected publishers.
     * "COMPANY" is a special filter meaning only company-direct links.
     * If publishers is blank or empty, returns all jobs.
     */
    private List<JobSearchResult> filterByPublishers(List<JobSearchResult> jobs, String publishers) {
        if (publishers == null || publishers.isBlank()) return jobs;

        Set<String> selected = Arrays.stream(publishers.split(","))
                .map(String::trim)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());

        return jobs.stream().filter(j -> {
            // Special "COMPANY" filter = company-direct links only
            if (selected.contains("COMPANY") && "COMPANY".equals(j.getApplyLinkSource())) return true;
            // Publisher-based filter
            String pub = j.getPublisher() != null ? j.getPublisher().toUpperCase() : "";
            return selected.stream().anyMatch(s -> !s.equals("COMPANY") && pub.contains(s));
        }).collect(Collectors.toList());
    }

    /**
     * Deduplicates jobs by normalized title + company.
     * When duplicates exist, keeps the one with the best apply link
     * (company website > LinkedIn > Indeed > other).
     */
    private List<JobSearchResult> deduplicateJobs(List<JobSearchResult> jobs) {
        // Use LinkedHashMap to preserve insertion order
        Map<String, JobSearchResult> seen = new LinkedHashMap<>();

        for (JobSearchResult job : jobs) {
            String key = normalizeText(job.getTitle()) + "|" + normalizeText(job.getCompany());

            if (!seen.containsKey(key)) {
                seen.put(key, job);
            } else {
                // Replace if new job has a better apply link
                JobSearchResult existing = seen.get(key);
                if (linkPriority(job.getApplyLinkSource()) < linkPriority(existing.getApplyLinkSource())) {
                    seen.put(key, job);
                }
            }
        }

        return new ArrayList<>(seen.values());
    }

    /**
     * Lower number = better link.
     * COMPANY(0) > LINKEDIN(1) > INDEED(2) > OTHER(3)
     */
    private int linkPriority(String source) {
        if (source == null) return 3;
        return switch (source) {
            case "COMPANY"   -> 0;
            case "LINKEDIN"  -> 1;
            case "INDEED"    -> 2;
            default          -> 3;
        };
    }

    /**
     * Normalizes text for deduplication comparison.
     * Strips punctuation, common company suffixes, extra whitespace.
     */
    private String normalizeText(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\b(inc|llc|corp|ltd|limited|company|co|technologies|tech|solutions|group)\\b", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Determines the apply link source (COMPANY, LINKEDIN, INDEED, or OTHER).
     * Company website = any link that doesn't belong to a known job aggregator.
     */
    private String computeApplyLinkSource(String url) {
        if (url == null || url.isBlank()) return "OTHER";
        String lower = url.toLowerCase();
        if (lower.contains("linkedin.com"))    return "LINKEDIN";
        if (lower.contains("indeed.com"))      return "INDEED";
        if (lower.contains("glassdoor.com"))   return "GLASSDOOR";
        if (lower.contains("ziprecruiter.com")) return "ZIPRECRUITER";
        // Check if any aggregator domain is in the URL
        boolean isAggregator = AGGREGATOR_DOMAINS.stream().anyMatch(lower::contains);
        return isAggregator ? "OTHER" : "COMPANY";
    }

    /**
     * Builds a search query from the user's AI-extracted skills.
     * Falls back to "software engineer" if no skills found.
     */
    public String buildQueryFromProfile(Long userId) {
        List<UserMemory> skills = userMemoryRepository
                .findByUserIdAndCategoryAndActiveTrue(userId, "SKILL");

        if (!skills.isEmpty()) {
            String skillStr = skills.stream()
                    .map(UserMemory::getFact)
                    .limit(4)
                    .collect(Collectors.joining(", "));
            log.info("[JobDiscovery] Auto-query from skills: {}", skillStr);
            return skillStr + " developer";
        }

        List<UserMemory> experience = userMemoryRepository
                .findByUserIdAndCategoryAndActiveTrue(userId, "EXPERIENCE");
        if (!experience.isEmpty()) {
            return experience.get(0).getFact();
        }

        return "software engineer";
    }

    /**
     * Parses a single JSearch job node into a JobSearchResult.
     */
    private JobSearchResult parseJob(JsonNode job) {
        String publisher = getString(job, "job_publisher", "");
        String normalizedPlatform = PUBLISHER_TO_PLATFORM.entrySet().stream()
                .filter(e -> publisher.toLowerCase().contains(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("OTHER");

        String description = getString(job, "job_description", "");
        String snippet = description.length() > 300
                ? description.substring(0, 300).trim() + "…"
                : description;

        String city    = getString(job, "job_city", "");
        String state   = getString(job, "job_state", "");
        String country = getString(job, "job_country", "");
        String location = Arrays.stream(new String[]{city, state, country})
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining(", "));

        String applyLink = getString(job, "job_apply_link", "");
        String applyLinkSource = computeApplyLinkSource(applyLink);

        return JobSearchResult.builder()
                .jobId(getString(job, "job_id", UUID.randomUUID().toString()))
                .title(getString(job, "job_title", "Unknown Role"))
                .company(getString(job, "employer_name", "Unknown Company"))
                .companyLogo(getString(job, "employer_logo", null))
                .location(location)
                .city(city)
                .state(state)
                .country(country)
                .publisher(publisher)
                .employmentType(getString(job, "job_employment_type", "FULLTIME"))
                .applyLink(applyLink)
                .applyLinkSource(applyLinkSource)
                .remote(getBoolean(job, "job_is_remote"))
                .salaryMin(getDouble(job, "job_min_salary"))
                .salaryMax(getDouble(job, "job_max_salary"))
                .salaryCurrency(getString(job, "job_salary_currency", "USD"))
                .salaryPeriod(getString(job, "job_salary_period", "YEAR"))
                .postedAt(getString(job, "job_posted_at_datetime_utc", null))
                .snippet(snippet)
                .build();
    }

    private String getString(JsonNode node, String field, String defaultVal) {
        JsonNode val = node.get(field);
        return (val != null && !val.isNull()) ? val.asText() : defaultVal;
    }

    private Double getDouble(JsonNode node, String field) {
        JsonNode val = node.get(field);
        return (val != null && !val.isNull() && val.isNumber()) ? val.asDouble() : null;
    }

    private boolean getBoolean(JsonNode node, String field) {
        JsonNode val = node.get(field);
        return (val != null && !val.isNull()) && val.asBoolean();
    }
}
