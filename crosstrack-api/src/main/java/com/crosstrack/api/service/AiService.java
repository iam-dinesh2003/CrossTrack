package com.crosstrack.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.crosstrack.api.model.*;
import com.crosstrack.api.repository.*;
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
public class AiService {

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final UserMemoryRepository memoryRepo;
    private final CoachMessageRepository coachRepo;
    private final ApplicationRepository appRepo;
    private final WebSearchService webSearchService;

    @Value("${crosstrack.ai.api-key}")
    private String apiKey;

    @Value("${crosstrack.ai.provider:gemini}")
    private String provider;

    @Value("${crosstrack.ai.model:gemini-2.0-flash}")
    private String model;

    @Value("${crosstrack.ai.max-tokens:1000}")
    private int maxTokens;

    @Value("${crosstrack.ai.temperature:0.7}")
    private double temperature;

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    public AiService(UserMemoryRepository memoryRepo, CoachMessageRepository coachRepo,
                     ApplicationRepository appRepo, WebSearchService webSearchService) {
        this.memoryRepo = memoryRepo;
        this.coachRepo = coachRepo;
        this.appRepo = appRepo;
        this.webSearchService = webSearchService;
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    // ════════════════════════════════════════════
    //  RESUME-JOB MATCH SCORE
    // ════════════════════════════════════════════

    public Map<String, Object> getMatchScore(String resumeText, String jobDescription) {
        String systemPrompt = """
            You are an expert career advisor and ATS (Applicant Tracking System) analyst.
            Analyze the resume against the job description and provide a detailed match analysis.

            Respond in EXACTLY this JSON format (no markdown, no code blocks):
            {
              "score": <number 0-100>,
              "verdict": "<STRONG_MATCH|GOOD_MATCH|MODERATE_MATCH|WEAK_MATCH>",
              "matchingSkills": ["skill1", "skill2"],
              "missingSkills": ["skill1", "skill2"],
              "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
              "summary": "One-line summary of the match"
            }

            Be realistic with scoring:
            - 85-100: Nearly perfect match
            - 70-84: Strong match with minor gaps
            - 50-69: Moderate match, some key skills missing
            - Below 50: Weak match, significant gaps
            """;

        String userPrompt = "RESUME:\n" + resumeText + "\n\nJOB DESCRIPTION:\n" + jobDescription;

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "score", 0, "verdict", "ERROR",
            "summary", response != null ? response : "AI service unavailable — check your API key",
            "matchingSkills", List.of(), "missingSkills", List.of(), "suggestions", List.of()
        ));
    }

    // ════════════════════════════════════════════
    //  COVER LETTER GENERATOR
    // ════════════════════════════════════════════

    public String generateCoverLetter(String resumeText, String jobDescription, String companyName, String roleName, String tone) {
        String systemPrompt = """
            You are an expert career writer who creates compelling, personalized cover letters.
            Write a professional cover letter that:
            - Opens with a strong, unique hook (not "I am writing to apply for...")
            - Connects the candidate's experience to the specific role requirements
            - Shows genuine knowledge/interest in the company
            - Ends with a confident call to action
            - Is concise (3-4 paragraphs, under 400 words)
            - Tone: """ + (tone != null ? tone : "professional but warm") + """

            Output ONLY the cover letter text, no metadata or labels.
            """;

        String userPrompt = String.format(
            "Write a cover letter for %s at %s.\n\nRESUME:\n%s\n\nJOB DESCRIPTION:\n%s",
            roleName, companyName, resumeText, jobDescription
        );

        return callLlm(systemPrompt, userPrompt);
    }

    // ════════════════════════════════════════════
    //  FOLLOW-UP EMAIL GENERATOR
    // ════════════════════════════════════════════

    public String generateFollowUpEmail(String company, String role, int daysSinceApplied, String followUpType, String additionalContext) {
        String systemPrompt = """
            You are an expert at professional job search communication.
            Write a follow-up email that is:
            - Professional but not stiff
            - Brief (under 150 words)
            - Shows continued interest without being desperate
            - Appropriate for the follow-up stage (gentle, second, or final)

            Output ONLY the email body (no subject line, no "Dear...", no signature — just the body text).
            """;

        String userPrompt = String.format(
            "Write a %s follow-up email.\nCompany: %s\nRole: %s\nDays since applied: %d\n%s",
            followUpType.toLowerCase(), company, role, daysSinceApplied,
            additionalContext != null ? "Context: " + additionalContext : ""
        );

        return callLlm(systemPrompt, userPrompt);
    }

    // ════════════════════════════════════════════
    //  CAREER COACH CHAT
    // ════════════════════════════════════════════

    public String chat(User user, String sessionId, String userMessage) {
        return chat(user, sessionId, userMessage, false);
    }

    public String chat(User user, String sessionId, String userMessage, boolean enableWebSearch) {
        // 1. Get user's career memories
        List<UserMemory> memories = memoryRepo.findByUserIdAndActiveTrueOrderByLastRelevantAtDesc(user.getId());
        String memoryContext = memories.stream()
                .limit(15)  // Limit to 15 to save tokens
                .map(m -> "- [" + m.getCategory() + "] " + m.getFact())
                .collect(Collectors.joining("\n"));

        // 2. Get recent application stats (summary only — saves tokens)
        List<Application> apps = appRepo.findByUserIdOrderByAppliedAtDesc(user.getId());
        long total = apps.size();
        long interviews = apps.stream().filter(a -> "INTERVIEW".equals(a.getStatus())).count();
        long offers = apps.stream().filter(a -> "OFFER".equals(a.getStatus())).count();
        long rejected = apps.stream().filter(a -> "REJECTED".equals(a.getStatus())).count();
        long ghosted = apps.stream().filter(a -> "GHOSTED".equals(a.getStatus())).count();

        String appContext = String.format(
            "Application stats: %d total, %d interviews, %d offers, %d rejected, %d ghosted",
            total, interviews, offers, rejected, ghosted
        );

        // 3. Web search if enabled or auto-detected
        String webContext = "";
        boolean didSearch = false;
        if (enableWebSearch || webSearchService.needsWebSearch(userMessage)) {
            webContext = webSearchService.searchForContext(userMessage);
            didSearch = !webContext.isEmpty();
            log.info("[Coach] Web search triggered for: '{}'", userMessage);
        }

        // 4. Get recent chat history (last 8 messages to save tokens)
        List<CoachMessage> history = coachRepo.findByUserIdAndSessionIdOrderByCreatedAtAsc(user.getId(), sessionId);
        List<Map<String, String>> chatMessages = new ArrayList<>();

        String systemPrompt = """
            You are CrossTrack AI, a personal career coach. You help job seekers with their job search
            strategy, application improvements, interview preparation, and career decisions.

            You have access to the user's career profile and application history. Use this context
            to give personalized, actionable advice. Be encouraging but honest.

            KEY RULES:
            - Reference their specific data when relevant (e.g., "I see you've applied to 15 companies...")
            - Give concrete, actionable suggestions
            - If they share new information about themselves, acknowledge it
            - Be concise — aim for 2-3 paragraphs unless they need more detail
            - Use their name if you know it
            """ + (didSearch ? """

            WEB SEARCH RESULTS (use these to give accurate, up-to-date answers):
            """ + webContext + """

            When using web search data, cite the source naturally (e.g., "According to Glassdoor...").
            """ : "") + """

            USER'S CAREER MEMORY:
            """ + (memoryContext.isEmpty() ? "No memories yet — this is a new user." : memoryContext) + """

            APPLICATION HISTORY:
            """ + appContext;

        // Add history (last 8 to save tokens)
        int startIdx = Math.max(0, history.size() - 8);
        for (int i = startIdx; i < history.size(); i++) {
            CoachMessage msg = history.get(i);
            chatMessages.add(Map.of("role", msg.getRole().toLowerCase(), "content", msg.getContent()));
        }

        // Add current message
        chatMessages.add(Map.of("role", "user", "content", userMessage));

        String response = callLlmWithHistory(systemPrompt, chatMessages);

        // 5. Save messages
        coachRepo.save(CoachMessage.builder()
                .user(user).sessionId(sessionId).role("user").content(userMessage).build());
        coachRepo.save(CoachMessage.builder()
                .user(user).sessionId(sessionId).role("assistant").content(response).build());

        // 6. Extract memories (skip if message is too short — saves an API call)
        if (userMessage.length() > 20) {
            extractMemories(user, userMessage);
        }

        return response;
    }

    // ════════════════════════════════════════════
    //  SEARCH AND ANALYZE (web search + AI)
    // ════════════════════════════════════════════

    public Map<String, Object> searchAndAnalyze(String query) {
        String webContext = webSearchService.searchForContext(query);
        if (webContext.isEmpty()) {
            return Map.of("analysis", "No web results found for: " + query, "sources", List.of());
        }

        String systemPrompt = """
            You are a career research analyst. Analyze the web search results and provide a clear,
            concise summary relevant to job seekers. Be factual and cite sources.
            Keep your response under 200 words.
            """;

        String userPrompt = "Research query: " + query + "\n\nWeb results:\n" + webContext;
        String analysis = callLlm(systemPrompt, userPrompt);

        var sources = webSearchService.search(query).stream()
                .filter(r -> !r.get("url").isEmpty())
                .map(r -> Map.of("title", r.get("title"), "url", r.get("url")))
                .toList();

        return Map.of("analysis", analysis, "sources", sources, "query", query);
    }

    // ════════════════════════════════════════════
    //  MEMORY EXTRACTION
    // ════════════════════════════════════════════

    private void extractMemories(User user, String userMessage) {
        try {
            String systemPrompt = """
                Extract career-relevant facts from the user's message. Return a JSON array of objects.
                Each object should have:
                - "fact": the extracted fact as a clear statement
                - "category": one of SKILL, PREFERENCE, EXPERIENCE, GOAL, FEEDBACK, STRENGTH, WEAKNESS
                - "confidence": 0.0 to 1.0 (how certain you are this is a real fact)

                Only extract clear, factual information. If there's nothing to extract, return [].
                Respond with ONLY the JSON array, no other text.

                Examples:
                User: "I just got my AWS certification" -> [{"fact": "Has AWS certification", "category": "SKILL", "confidence": 0.95}]
                User: "What's the weather?" -> []
                User: "I really want to work at a startup" -> [{"fact": "Prefers working at startups", "category": "PREFERENCE", "confidence": 0.85}]
                """;

            String response = callLlm(systemPrompt, userMessage);
            if (response != null && response.trim().startsWith("[")) {
                JsonNode facts = objectMapper.readTree(response);
                for (JsonNode fact : facts) {
                    String factText = fact.get("fact").asText();
                    String category = fact.get("category").asText();
                    double confidence = fact.has("confidence") ? fact.get("confidence").asDouble() : 0.8;

                    if (confidence >= 0.6) {
                        memoryRepo.save(UserMemory.builder()
                                .user(user)
                                .fact(factText)
                                .category(category)
                                .source("CHAT")
                                .confidence(confidence)
                                .build());
                        log.info("[Memory] Extracted: [{}] {} (confidence: {})", category, factText, confidence);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Memory extraction failed (non-critical): {}", e.getMessage());
        }
    }

    // ════════════════════════════════════════════
    //  APPLICATION AUTOPSY
    // ════════════════════════════════════════════

    public Map<String, Object> analyzeRejection(User user, Application app) {
        List<UserMemory> memories = memoryRepo.findByUserIdAndActiveTrue(user.getId());
        String skills = memories.stream()
                .filter(m -> "SKILL".equals(m.getCategory()))
                .map(UserMemory::getFact)
                .collect(Collectors.joining(", "));

        // Get all rejected apps for pattern analysis
        List<Application> rejections = appRepo.findByUserIdOrderByAppliedAtDesc(user.getId()).stream()
                .filter(a -> "REJECTED".equals(a.getStatus()))
                .toList();

        String systemPrompt = """
            You are a career analyst. Analyze why this application might have been rejected
            and identify patterns in the user's rejection history.

            Respond in EXACTLY this JSON format:
            {
              "possibleReasons": ["reason1", "reason2"],
              "patterns": ["pattern1", "pattern2"],
              "improvements": ["actionable improvement 1", "actionable improvement 2"],
              "encouragement": "A brief encouraging message"
            }
            """;

        String userPrompt = String.format(
            "REJECTED APPLICATION:\nCompany: %s\nRole: %s\nPlatform: %s\n\nUSER SKILLS: %s\n\nTOTAL REJECTIONS: %d\nREJECTED FROM: %s",
            app.getCompany(), app.getRole(), app.getPlatform(),
            skills.isEmpty() ? "Not yet analyzed" : skills,
            rejections.size(),
            rejections.stream().map(a -> a.getCompany() + " (" + a.getRole() + ")").collect(Collectors.joining(", "))
        );

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "possibleReasons", List.of("Unable to analyze — check your AI API key"),
            "patterns", List.of(), "improvements", List.of(),
            "encouragement", "Keep going! Set up your Gemini API key to unlock AI analysis."
        ));
    }

    // ════════════════════════════════════════════
    //  INTERVIEW PREP
    // ════════════════════════════════════════════

    public Map<String, Object> generateInterviewPrep(String company, String role, String resumeText) {
        String systemPrompt = """
            You are an expert interview coach. Generate comprehensive interview preparation materials.

            Respond in EXACTLY this JSON format:
            {
              "companyOverview": "2-3 sentences about the company",
              "behavioralQuestions": ["question1", "question2", "question3", "question4", "question5"],
              "technicalQuestions": ["question1", "question2", "question3"],
              "starStories": [
                {"question": "Tell me about a time...", "suggestion": "Use your experience at X to discuss..."}
              ],
              "questionsToAsk": ["question1", "question2", "question3"],
              "tips": ["tip1", "tip2", "tip3"]
            }
            """;

        String userPrompt = String.format(
            "Generate interview prep for:\nCompany: %s\nRole: %s\n\nCANDIDATE RESUME:\n%s",
            company, role, resumeText != null ? resumeText : "Not provided"
        );

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "companyOverview", "Unable to generate — check your AI API key",
            "behavioralQuestions", List.of(), "technicalQuestions", List.of(),
            "starStories", List.of(), "questionsToAsk", List.of(), "tips", List.of()
        ));
    }

    // ════════════════════════════════════════════
    //  MOCK INTERVIEW AI
    // ════════════════════════════════════════════

    public Map<String, Object> startMockInterview(String company, String role, String interviewType, String resumeText, String jobDescription) {
        String jdSection = (jobDescription != null && !jobDescription.isBlank())
            ? "\n\nIMPORTANT — Here is the actual job description. Base your questions on the specific skills, requirements, and responsibilities listed:\n" + jobDescription
            : "";

        String systemPrompt = ("""
            You are an expert interviewer conducting a realistic mock interview.
            You are interviewing for the role of %s at %s.
            Interview type: %s.
            """ + jdSection + """

            Start the interview with a brief, warm greeting and your FIRST question.
            Ask ONE question at a time. Be realistic and professional.
            If a job description is provided, tailor questions to the specific skills and requirements mentioned.

            Respond in EXACTLY this JSON format:
            {
              "greeting": "Your warm opening greeting",
              "question": "Your first interview question",
              "questionNumber": 1,
              "questionType": "BEHAVIORAL or TECHNICAL or SITUATIONAL",
              "tips": "Brief hint about what the interviewer is looking for (shown after user answers)"
            }
            """).formatted(role, company, interviewType);

        String userPrompt = "Start the mock interview.";
        if (resumeText != null && !resumeText.isBlank()) {
            userPrompt += "\n\nCandidate's resume:\n" + resumeText;
        }

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "greeting", "Welcome! Let's begin your mock interview for " + role + " at " + company + ".",
            "question", "Tell me about yourself and why you're interested in this role.",
            "questionNumber", 1,
            "questionType", "BEHAVIORAL",
            "tips", "Focus on your relevant experience and motivation."
        ));
    }

    public Map<String, Object> answerMockQuestion(String company, String role, String interviewType,
                                                   String currentQuestion, String userAnswer,
                                                   int questionNumber, List<Map<String, String>> history,
                                                   String jobDescription) {
        String jdContext = (jobDescription != null && !jobDescription.isBlank())
            ? "\n\nJob description for context (tailor follow-up questions to these requirements):\n" + jobDescription
            : "";

        String systemPrompt = String.format("""
            You are an expert interviewer conducting a mock interview for %s at %s (%s interview).
            The candidate just answered question #%d.
            """ + jdContext + """

            Evaluate their answer and then ask the NEXT question.
            If this is question 5+, you may wrap up the interview instead.

            Respond in EXACTLY this JSON format:
            {
              "feedback": "Specific, constructive feedback on their answer (2-3 sentences). What was good, what could improve.",
              "score": 7,
              "nextQuestion": "Your next interview question (or null if wrapping up)",
              "questionNumber": %d,
              "questionType": "BEHAVIORAL or TECHNICAL or SITUATIONAL",
              "isComplete": false,
              "wrapUp": null
            }

            If the interview is complete (after 5-7 questions), set isComplete=true and provide:
            {
              "feedback": "Final feedback on last answer",
              "score": 8,
              "nextQuestion": null,
              "questionNumber": %d,
              "questionType": "CLOSING",
              "isComplete": true,
              "wrapUp": {
                "overallScore": 75,
                "strengths": ["strength1", "strength2"],
                "improvements": ["area1", "area2"],
                "overallFeedback": "2-3 sentence overall assessment"
              }
            }

            Score each answer 1-10.
            """, role, company, interviewType, questionNumber, questionNumber + 1, questionNumber + 1);

        // Build conversation history
        List<Map<String, String>> messages = new ArrayList<>(history);
        messages.add(Map.of("role", "user", "content",
            "Question asked: " + currentQuestion + "\n\nMy answer: " + userAnswer));

        String response = callLlmWithHistory(systemPrompt, messages);
        return parseJsonResponse(response, Map.of(
            "feedback", "Good answer. Let's continue.",
            "score", 6,
            "nextQuestion", "Can you tell me about a challenging project you've worked on?",
            "questionNumber", questionNumber + 1,
            "questionType", "BEHAVIORAL",
            "isComplete", false
        ));
    }

    // ════════════════════════════════════════════
    //  INTERVIEW NOTES AI SUMMARY
    // ════════════════════════════════════════════

    public Map<String, Object> summarizeInterviewNotes(String rawNotes, String company, String role, String interviewType) {
        String systemPrompt = """
            You are a career coach helping a candidate process their interview experience.
            Analyze their raw notes from an interview and generate a structured summary.

            Respond in EXACTLY this JSON format:
            {
              "summary": "2-3 sentence concise summary of how the interview went",
              "keyQuestions": ["Question they were asked 1", "Question 2", "Question 3"],
              "wentWell": ["What went well 1", "What went well 2"],
              "toImprove": ["Area to improve 1", "Area to improve 2"],
              "followUpActions": ["Send thank-you email to interviewer", "Review X topic before next round"]
            }
            """;

        String userPrompt = String.format(
            "Summarize my interview notes:\nCompany: %s\nRole: %s\nType: %s\n\nRAW NOTES:\n%s",
            company, role, interviewType != null ? interviewType : "General",
            rawNotes
        );

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "summary", "Interview notes recorded.",
            "keyQuestions", List.of(), "wentWell", List.of(),
            "toImprove", List.of(), "followUpActions", List.of()
        ));
    }

    // ════════════════════════════════════════════
    //  EMAIL JOB DETAILS EXTRACTION (LLM LAYER 7)
    // ════════════════════════════════════════════

    /**
     * Last-resort extraction: called when all 6 rule-based layers in EmailClassifier
     * fail to identify company and role. Sends the email to Gemini for semantic extraction.
     *
     * @param emailBody    Full email body text (will be truncated to 2000 chars)
     * @param emailSubject Subject line
     * @param senderFrom   From header (e.g. "Cisco Careers <hiring@cisco.com>")
     * @return Map with keys: company, role, status, confidence (0.0-1.0), reasoning
     */
    public Map<String, Object> extractJobDetailsFromEmail(String emailBody, String emailSubject, String senderFrom) {
        String systemPrompt = """
            You are a job application email parser. Extract the company name and job role from a job-related email.

            Rules:
            - Only extract what is explicitly stated in the email. Do NOT guess or infer.
            - If you cannot determine a field with high confidence (>0.7), set it to null.
            - company: The hiring company name (not a job board like LinkedIn/Indeed/Greenhouse)
            - role: The specific job title (e.g. "Software Engineer", "Product Manager")
            - status: One of APPLIED, INTERVIEW, OFFER, REJECTED — based on email content
            - confidence: Your overall confidence score between 0.0 and 1.0

            Respond in EXACTLY this JSON format (no markdown, no code blocks):
            {
              "company": "<company name or null>",
              "role": "<job title or null>",
              "status": "<APPLIED|INTERVIEW|OFFER|REJECTED|null>",
              "confidence": <0.0-1.0>,
              "reasoning": "<one sentence explanation>"
            }
            """;

        // Truncate body to 2000 chars to control token cost
        String truncatedBody = emailBody != null && emailBody.length() > 2000
            ? emailBody.substring(0, 2000)
            : (emailBody != null ? emailBody : "");

        String userPrompt = String.format(
            "FROM: %s\nSUBJECT: %s\n\nEMAIL BODY:\n%s",
            senderFrom != null ? senderFrom : "",
            emailSubject != null ? emailSubject : "",
            truncatedBody
        );

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "company", (Object) null,
            "role", (Object) null,
            "status", (Object) null,
            "confidence", 0.0,
            "reasoning", "LLM extraction failed"
        ));
    }

    // ════════════════════════════════════════════
    //  RESUME BULLET TAILORING (for extension sidebar)
    // ════════════════════════════════════════════

    /**
     * Rewrites specific resume bullets to include keywords from the job description.
     * If no targetBullets provided, extracts and rewrites the top 3 most relevant bullets.
     *
     * @param resumeText     Full parsed resume text
     * @param jobDescription Job description to tailor toward
     * @param targetBullets  Specific bullets to rewrite (empty = auto-select from resume)
     * @return Map with key "tailoredBullets" containing rewritten bullet list
     */
    public Map<String, Object> tailorResumeBullets(String resumeText, String jobDescription, List<String> targetBullets) {
        String bulletsContext = (targetBullets != null && !targetBullets.isEmpty())
            ? "Rewrite ONLY these specific resume bullets:\n" + String.join("\n", targetBullets.stream().map(b -> "• " + b).toList())
            : "Select and rewrite the 3 most relevant bullet points from the resume below.";

        String systemPrompt = """
            You are an expert resume writer who tailors resumes for specific job descriptions.

            Rules:
            - Use keywords from the job description naturally — do NOT keyword-stuff or make it awkward.
            - Do NOT fabricate experience, tools, or achievements not implied by the original bullet.
            - Keep each bullet to 1-2 lines, starting with a strong action verb.
            - Maintain the same general meaning but improve keyword alignment with the JD.

            Respond in EXACTLY this JSON format (no markdown, no code blocks):
            {
              "tailoredBullets": ["rewritten bullet 1", "rewritten bullet 2", "rewritten bullet 3"],
              "keywordsAdded": ["keyword1", "keyword2"],
              "tip": "One short tip for further improvement"
            }
            """;

        String userPrompt = String.format(
            "%s\n\nJOB DESCRIPTION:\n%s\n\nFULL RESUME:\n%s",
            bulletsContext, jobDescription,
            resumeText.length() > 3000 ? resumeText.substring(0, 3000) : resumeText
        );

        String response = callLlm(systemPrompt, userPrompt);
        return parseJsonResponse(response, Map.of(
            "tailoredBullets", List.of(),
            "keywordsAdded", List.of(),
            "tip", "Unable to tailor bullets at this time."
        ));
    }

    // ════════════════════════════════════════════
    //  JSON RESPONSE PARSING HELPER
    // ════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonResponse(String response, Map<String, Object> fallback) {
        if (response == null || response.isBlank()) {
            log.warn("LLM returned null/blank response");
            return fallback;
        }

        // Strip markdown code blocks (```json ... ``` or ``` ... ```)
        String cleaned = response.trim();
        if (cleaned.startsWith("```")) {
            // Remove opening ```json or ```
            int firstNewline = cleaned.indexOf('\n');
            if (firstNewline > 0) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
            // Remove closing ```
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
            }
        }

        // Must start with { to be valid JSON object
        if (!cleaned.startsWith("{")) {
            log.warn("LLM response is not JSON: {}", cleaned.substring(0, Math.min(cleaned.length(), 80)));
            return fallback;
        }

        try {
            return objectMapper.readValue(cleaned, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse LLM JSON response: {}", cleaned.substring(0, Math.min(cleaned.length(), 200)), e);
            return fallback;
        }
    }

    // ════════════════════════════════════════════
    //  LLM API CALL (Gemini + OpenAI support)
    // ════════════════════════════════════════════

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.equals("sk-placeholder");
    }

    private String callLlm(String systemPrompt, String userPrompt) {
        return callLlmWithHistory(systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
    }

    private String callLlmWithHistory(String systemPrompt, List<Map<String, String>> messages) {
        if (!isConfigured()) {
            log.warn("[AI] No API key configured. Set AI_API_KEY environment variable.");
            return "⚠️ AI is not configured yet. To enable AI features, get a free Gemini API key from https://aistudio.google.com/apikey and start the server with: AI_API_KEY=your-key-here ./mvnw spring-boot:run";
        }
        if ("gemini".equalsIgnoreCase(provider)) {
            return callGemini(systemPrompt, messages);
        } else {
            return callOpenAi(systemPrompt, messages);
        }
    }

    // ── Google Gemini API (FREE tier) ──
    private String callGemini(String systemPrompt, List<Map<String, String>> messages) {
        try {
            ObjectNode body = objectMapper.createObjectNode();

            // System instruction
            ObjectNode sysInstruction = body.putObject("systemInstruction");
            ObjectNode sysPart = sysInstruction.putArray("parts").addObject();
            sysPart.put("text", systemPrompt);

            // Contents (chat messages)
            ArrayNode contents = body.putArray("contents");
            for (Map<String, String> msg : messages) {
                ObjectNode content = contents.addObject();
                String role = msg.get("role");
                // Gemini uses "model" instead of "assistant"
                content.put("role", "assistant".equals(role) ? "model" : "user");
                ObjectNode part = content.putArray("parts").addObject();
                part.put("text", msg.get("content"));
            }

            // Generation config
            ObjectNode genConfig = body.putObject("generationConfig");
            genConfig.put("maxOutputTokens", maxTokens);
            genConfig.put("temperature", temperature);

            String url = GEMINI_URL + model + ":generateContent?key=" + apiKey;

            RequestBody requestBody = RequestBody.create(
                objectMapper.writeValueAsString(body),
                MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .post(requestBody)
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    log.error("[Gemini] API error {}: {}", response.code(), responseBody);
                    return "I'm having trouble connecting to my AI brain right now. Please try again in a moment.";
                }

                JsonNode json = objectMapper.readTree(responseBody);
                JsonNode candidates = json.get("candidates");
                if (candidates != null && candidates.isArray() && candidates.size() > 0) {
                    JsonNode parts = candidates.get(0).path("content").path("parts");
                    if (parts.isArray() && parts.size() > 0) {
                        return parts.get(0).get("text").asText();
                    }
                }
                log.error("[Gemini] Unexpected response format: {}", responseBody);
                return "I received an unexpected response. Please try again.";
            }
        } catch (IOException e) {
            log.error("[Gemini] API call failed", e);
            return "I'm having trouble connecting right now. Please try again.";
        }
    }

    // ── OpenAI API ──
    private String callOpenAi(String systemPrompt, List<Map<String, String>> messages) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", maxTokens);
            body.put("temperature", temperature);

            ArrayNode messagesArray = body.putArray("messages");

            // System message
            ObjectNode sysMsg = messagesArray.addObject();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);

            // History + user messages
            for (Map<String, String> msg : messages) {
                ObjectNode m = messagesArray.addObject();
                m.put("role", msg.get("role"));
                m.put("content", msg.get("content"));
            }

            RequestBody requestBody = RequestBody.create(
                objectMapper.writeValueAsString(body),
                MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                .url(OPENAI_URL)
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .post(requestBody)
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "No body";
                    log.error("[OpenAI] API error {}: {}", response.code(), errorBody);
                    return "I'm having trouble connecting to my AI brain right now. Please try again in a moment.";
                }

                String responseBody = response.body().string();
                JsonNode json = objectMapper.readTree(responseBody);
                return json.get("choices").get(0).get("message").get("content").asText();
            }
        } catch (IOException e) {
            log.error("[OpenAI] API call failed", e);
            return "I'm having trouble connecting right now. Please try again.";
        }
    }
}
