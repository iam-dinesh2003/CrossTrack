package com.crosstrack.api.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory rate limiter to prevent surprise API bills.
 * Tracks daily usage per user per category.
 * Resets automatically at midnight (on next request).
 */
@Service
@Slf4j
public class RateLimitService {

    @Value("${crosstrack.ai.daily-chat-limit:30}")
    private int dailyChatLimit;

    @Value("${crosstrack.ai.daily-search-limit:15}")
    private int dailySearchLimit;

    @Value("${crosstrack.ai.daily-generation-limit:10}")
    private int dailyGenerationLimit;

    @Value("${crosstrack.ai.daily-email-parse-limit:20}")
    private int dailyEmailParseLimit;

    // Key: "userId:category:date" → count
    private final ConcurrentHashMap<String, Integer> counters = new ConcurrentHashMap<>();

    public enum Category {
        CHAT(30),          // Coach chat messages
        SEARCH(15),        // Web searches
        GENERATION(10),    // Cover letters, follow-up emails, interview prep
        EMAIL_PARSE(20);   // LLM fallback for unknown role/company in email scan

        final int defaultLimit;
        Category(int defaultLimit) { this.defaultLimit = defaultLimit; }
    }

    /**
     * Check if the user can make a request. Returns true if allowed.
     * Increments the counter if allowed.
     */
    public boolean allowRequest(Long userId, Category category) {
        String key = userId + ":" + category.name() + ":" + LocalDate.now();
        int limit = getLimit(category);
        int current = counters.getOrDefault(key, 0);

        if (current >= limit) {
            log.warn("[RateLimit] User {} hit daily {} limit ({}/{})", userId, category, current, limit);
            return false;
        }

        counters.put(key, current + 1);

        // Cleanup old entries (older than today)
        String todayPrefix = ":" + LocalDate.now();
        counters.keySet().removeIf(k -> !k.contains(todayPrefix));

        return true;
    }

    /**
     * Get remaining requests for a user in a category.
     */
    public int remaining(Long userId, Category category) {
        String key = userId + ":" + category.name() + ":" + LocalDate.now();
        int current = counters.getOrDefault(key, 0);
        return Math.max(0, getLimit(category) - current);
    }

    /**
     * Get all usage stats for a user.
     */
    public Map<String, Object> getUsageStats(Long userId) {
        return Map.of(
            "chat", Map.of("used", getUsed(userId, Category.CHAT), "limit", getLimit(Category.CHAT), "remaining", remaining(userId, Category.CHAT)),
            "search", Map.of("used", getUsed(userId, Category.SEARCH), "limit", getLimit(Category.SEARCH), "remaining", remaining(userId, Category.SEARCH)),
            "generation", Map.of("used", getUsed(userId, Category.GENERATION), "limit", getLimit(Category.GENERATION), "remaining", remaining(userId, Category.GENERATION))
        );
    }

    private int getUsed(Long userId, Category category) {
        String key = userId + ":" + category.name() + ":" + LocalDate.now();
        return counters.getOrDefault(key, 0);
    }

    /**
     * Admin operation: clear all today's counters for a specific user so they can use AI again.
     */
    public void resetLimitsForUser(Long userId) {
        String userPrefix = userId + ":";
        counters.keySet().removeIf(k -> k.startsWith(userPrefix));
        log.info("[RateLimit] All limits reset for user {}", userId);
    }

    private int getLimit(Category category) {
        return switch (category) {
            case CHAT -> dailyChatLimit;
            case SEARCH -> dailySearchLimit;
            case GENERATION -> dailyGenerationLimit;
            case EMAIL_PARSE -> dailyEmailParseLimit;
        };
    }
}
