package com.crosstrack.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@Slf4j
public class WebSearchService {

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String TAVILY_URL = "https://api.tavily.com/search";

    @Value("${tavily.api-key}")
    private String tavilyApiKey;

    @Value("${tavily.search-depth:basic}")
    private String searchDepth;

    @Value("${tavily.max-results:3}")
    private int maxResults;

    public WebSearchService() {
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    /**
     * Search the web using Tavily API.
     * Returns a list of search results with title, url, and content snippet.
     */
    public List<Map<String, String>> search(String query) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("query", query);
            body.put("search_depth", searchDepth);
            body.put("max_results", maxResults);
            body.put("include_answer", true);

            RequestBody requestBody = RequestBody.create(
                objectMapper.writeValueAsString(body),
                MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                .url(TAVILY_URL)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer " + tavilyApiKey)
                .post(requestBody)
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "No body";
                    log.error("[WebSearch] Tavily API error {}: {}", response.code(), errorBody);
                    return List.of();
                }

                String responseBody = response.body().string();
                JsonNode json = objectMapper.readTree(responseBody);

                List<Map<String, String>> results = new ArrayList<>();

                // Include the AI-generated answer if available
                if (json.has("answer") && !json.get("answer").isNull()) {
                    results.add(Map.of(
                        "title", "AI Summary",
                        "url", "",
                        "content", json.get("answer").asText()
                    ));
                }

                // Parse individual results
                if (json.has("results")) {
                    for (JsonNode result : json.get("results")) {
                        results.add(Map.of(
                            "title", result.has("title") ? result.get("title").asText() : "",
                            "url", result.has("url") ? result.get("url").asText() : "",
                            "content", result.has("content") ? result.get("content").asText() : ""
                        ));
                    }
                }

                log.info("[WebSearch] Query: '{}' → {} results", query, results.size());
                return results;
            }
        } catch (IOException e) {
            log.error("[WebSearch] Failed to search: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Search and format results as a context string ready for LLM injection.
     */
    public String searchForContext(String query) {
        List<Map<String, String>> results = search(query);
        if (results.isEmpty()) return "";

        return results.stream()
                .map(r -> {
                    String title = r.get("title");
                    String url = r.get("url");
                    String content = r.get("content");
                    // Truncate content to save tokens (max 300 chars per result)
                    if (content.length() > 300) content = content.substring(0, 300) + "...";
                    return String.format("- %s%s\n  %s",
                            title,
                            url.isEmpty() ? "" : " (" + url + ")",
                            content);
                })
                .collect(Collectors.joining("\n\n"));
    }

    /**
     * Detect if a user message likely needs web search.
     */
    public boolean needsWebSearch(String message) {
        String lower = message.toLowerCase();
        String[] triggers = {
            "salary", "compensation", "pay", "how much",
            "company", "culture", "glassdoor", "review",
            "latest", "recent", "current", "2024", "2025", "2026",
            "market", "trend", "demand", "hiring",
            "average", "median", "range",
            "news", "layoff", "funding",
            "best", "top", "popular",
            "vs", "compare", "versus",
            "remote", "hybrid", "on-site",
            "search", "look up", "find out", "what is"
        };
        for (String trigger : triggers) {
            if (lower.contains(trigger)) return true;
        }
        return false;
    }
}
