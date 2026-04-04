# CrossTrack — Complete Job Cycle Platform: Implementation Plan

## Vision
Transform CrossTrack from a job application tracker into an **AI-powered personal career coach** that owns the entire job search lifecycle — from preparation to offer negotiation.

---

## Architecture Overview

```
+------------------+     +------------------+     +------------------+
|  Chrome Extension|     |  React Dashboard |     |  Mobile (Future) |
|  (Manifest V3)   |     |  (React 19)      |     |                  |
+--------+---------+     +--------+---------+     +--------+---------+
         |                         |                        |
         +------------+------------+------------------------+
                      |
              +-------v--------+
              |  Spring Boot   |
              |  REST API      |
              |  (Java 17)     |
              +-------+--------+
                      |
         +------------+------------+
         |            |            |
   +-----v-----+ +---v----+ +----v-----+
   |   MySQL    | | Qdrant | | Claude/  |
   | (Relational| | (Vector| | OpenAI   |
   |  Data)     | | Search)| | (LLM)    |
   +-----------+ +--------+ +----------+
```

### Tech Stack Additions

| Component | Technology | Purpose |
|-----------|-----------|---------|
| LLM API | Claude API (Anthropic SDK) | Resume analysis, coaching, email gen |
| Vector DB | Qdrant (Docker) | Semantic search, memory retrieval |
| Embeddings | all-MiniLM-L6-v2 (ONNX) | Local embeddings, zero API cost |
| Memory | Custom Mem0-like system | Personal career facts + preferences |
| Scheduler | Spring @Scheduled (enhanced) | Follow-up reminders, weekly digest |
| AI Framework | Spring AI 1.0+ | Unified LLM + VectorStore abstraction |

### Why Qdrant + MySQL (Not PostgreSQL/pgvector)

- MySQL is already working and has all data — no risky migration
- Qdrant runs in Docker alongside the app, has a great dashboard UI
- Separation of concerns: relational data in MySQL, vector data in Qdrant
- Spring AI abstracts the vector store — can swap to pgvector later if needed
- Qdrant's web UI at localhost:6333/dashboard is visually impressive for demos

---

## Memory System Design (Personal Career Coach)

### Concept: "Career Memory" (Inspired by Mem0)

The system automatically extracts and remembers facts about the user:

```
User chats: "I'm really interested in fintech companies, especially in NYC"
    |
    v
Memory extraction:
  - PREFERENCE: "Interested in fintech companies"
  - PREFERENCE: "Prefers NYC location"
  - Updated: 2026-03-27
```

### UserMemory Entity

```java
@Entity
public class UserMemory {
    Long id;
    Long userId;
    String fact;           // "User has 2 years experience in Python"
    String category;       // SKILL, PREFERENCE, EXPERIENCE, GOAL, FEEDBACK
    String source;         // CHAT, RESUME_ANALYSIS, APPLICATION_PATTERN, MANUAL
    Double confidence;     // 0.0 - 1.0
    LocalDateTime createdAt;
    LocalDateTime lastRelevantAt;
    Boolean active;        // Can be invalidated
}
// Vector embedding stored in Qdrant, linked by memory ID
```

### Memory Categories

| Category | Examples | Source |
|----------|---------|--------|
| SKILL | "Knows Java, Python, React" | Resume analysis |
| PREFERENCE | "Prefers remote roles" | Chat, application patterns |
| EXPERIENCE | "2 years at Google as SDE" | Resume analysis |
| GOAL | "Wants to transition to ML" | Chat |
| FEEDBACK | "Got rejected for lacking system design" | Application autopsy |
| STRENGTH | "Strong at behavioral interviews" | Interview feedback |
| WEAKNESS | "Needs to improve SQL skills" | Skill gap analysis |

### Memory Retrieval (RAG Pattern)

```
User: "What should I focus on for my next application?"
    |
    v
1. Search Qdrant for relevant memories (semantic)
2. Pull recent application history from MySQL
3. Combine into context prompt
4. LLM generates personalized advice
    |
    v
"Based on your goal to move into ML engineering and your recent
 rejection from DeepMind (they cited 'limited ML project experience'),
 I'd suggest: (1) Add your Kaggle projects to your resume..."
```

---

## Feature Implementation Phases

### Phase 1: AI Foundation (Current Sprint)

#### 1.1 Spring AI + LLM Integration
**Files to create/modify:**
- `pom.xml` — Add Spring AI, Anthropic SDK, Qdrant dependencies
- `application.properties` — LLM API key, Qdrant connection
- `AiService.java` — Core LLM interaction service
- `MemoryService.java` — Career memory CRUD + search
- `EmbeddingService.java` — Text-to-vector conversion

#### 1.2 New Entities
- `UserMemory` — Career facts and preferences
- `ResumeVariant` — Multiple resume versions per user
- `FollowUpReminder` — Scheduled follow-up actions
- `CareerCoachSession` — Chat history with the AI coach
- `JobDescription` — Parsed JD data for matching

#### 1.3 Resume-Job Match Score
**How it works:**
1. Extension captures JD text from LinkedIn/Indeed page
2. Sends to API: `POST /api/ai/match-score`
3. API sends resume + JD to LLM
4. Returns: match score (0-100), matching skills, gaps, suggestions
5. Extension shows score overlay on the job page

**API Response:**
```json
{
  "score": 78,
  "matchingSkills": ["Java", "Spring Boot", "REST APIs"],
  "missingSkills": ["Kubernetes", "AWS"],
  "suggestions": [
    "Add your Docker experience — it's closely related to their K8s requirement",
    "Mention your cloud projects even if they weren't AWS-specific"
  ],
  "verdict": "STRONG_MATCH"
}
```

#### 1.4 AI Cover Letter Generator
**Endpoint:** `POST /api/ai/cover-letter`
**Input:** Resume text + Job description + Optional tone/style preference
**Output:** Tailored cover letter draft

#### 1.5 AI Follow-Up Email Generator
**Endpoint:** `POST /api/ai/follow-up-email`
**Input:** Application details + days since applied + context
**Output:** Professional follow-up email draft

---

### Phase 2: Smart Follow-Up Engine (Current Sprint)

#### 2.1 Follow-Up Reminder Scheduler
**Cron job runs daily:**
```
For each APPLIED application:
  - Day 7: Create "gentle follow-up" reminder
  - Day 14: Create "second follow-up" reminder
  - Day 21: Create "final follow-up" reminder
  - Day 28+: Escalate to ghost detection (existing)
```

#### 2.2 Notification System Enhancement
- Dashboard notification bell shows pending follow-ups
- Each reminder includes AI-drafted email ready to send
- User can dismiss, snooze, or mark as sent

#### 2.3 Follow-Up Tracking
- Track which follow-ups were actually sent
- Correlate follow-up timing with response rates
- "Applications where you followed up within 7 days had a 3x higher response rate"

---

### Phase 3: Career Coach Chat (Current Sprint)

#### 3.1 Chat Interface
New dashboard page: `/coach`
- Full chat interface with the AI career coach
- Context-aware: knows your applications, resume, preferences
- Persistent chat history

#### 3.2 Memory-Augmented Responses
Every chat query triggers:
1. Semantic search of user memories (Qdrant)
2. Retrieval of relevant application history (MySQL)
3. RAG-enhanced LLM response

#### 3.3 Automatic Memory Extraction
After each chat, LLM extracts new facts:
```
User: "I just finished my AWS Solutions Architect cert"
    |
    v
New memory: {
  category: "SKILL",
  fact: "Has AWS Solutions Architect certification",
  confidence: 0.95
}
```

---

### Phase 4: Interview Prep Hub (Next Sprint)

#### 4.1 Auto-Triggered Prep
When application status changes to INTERVIEW:
- Generate company overview
- Create role-specific practice questions
- Suggest STAR stories from resume
- Generate "questions to ask them"

#### 4.2 Mock Interview
- Text-based mock interview with AI interviewer
- Behavioral + technical questions based on the role
- Real-time feedback on answers
- Track weak areas across sessions

---

### Phase 5: Advanced Analytics & Intelligence (Next Sprint)

#### 5.1 Application Autopsy
On rejection: LLM analyzes job requirements vs profile, identifies patterns

#### 5.2 Skill Gap Analyzer
Aggregate required skills across all applied jobs, find gaps, suggest resources

#### 5.3 Smart Recommendations
"Based on your 3x higher response rate at Series B startups, here are similar companies hiring"

---

### Phase 6: Offer & Negotiation (Future)

#### 6.1 Offer Comparison Dashboard
Side-by-side multi-offer comparison with total comp calculator

#### 6.2 Salary Negotiation Coach
Market data + AI-generated negotiation scripts

---

## New API Endpoints

### AI Endpoints
```
POST   /api/ai/match-score        — Resume-JD match analysis
POST   /api/ai/cover-letter       — Generate cover letter
POST   /api/ai/follow-up-email    — Generate follow-up email
POST   /api/ai/tailor-resume      — Tailor resume for specific JD
POST   /api/ai/interview-prep     — Generate interview prep material
POST   /api/ai/application-autopsy — Analyze rejection reasons
```

### Career Coach Endpoints
```
POST   /api/coach/chat            — Send message to career coach
GET    /api/coach/history         — Get chat history
DELETE /api/coach/history         — Clear chat history
GET    /api/coach/memories        — Get extracted memories
PUT    /api/coach/memories/:id    — Update/correct a memory
DELETE /api/coach/memories/:id    — Delete a memory
```

### Follow-Up Endpoints
```
GET    /api/follow-ups            — Get pending follow-ups
PUT    /api/follow-ups/:id/sent   — Mark follow-up as sent
PUT    /api/follow-ups/:id/snooze — Snooze a follow-up
DELETE /api/follow-ups/:id        — Dismiss a follow-up
```

### Resume Management Endpoints
```
POST   /api/resumes               — Upload a resume variant
GET    /api/resumes               — List resume variants
PUT    /api/resumes/:id/default   — Set as default resume
DELETE /api/resumes/:id           — Delete a resume variant
GET    /api/resumes/:id/text      — Get parsed resume text
```

---

## New Database Tables

### user_memory
```sql
CREATE TABLE user_memory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    fact TEXT NOT NULL,
    category ENUM('SKILL','PREFERENCE','EXPERIENCE','GOAL','FEEDBACK','STRENGTH','WEAKNESS'),
    source ENUM('CHAT','RESUME_ANALYSIS','APPLICATION_PATTERN','MANUAL'),
    confidence DOUBLE DEFAULT 0.8,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_relevant_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### resume_variant
```sql
CREATE TABLE resume_variant (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    parsed_text TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### follow_up_reminder
```sql
CREATE TABLE follow_up_reminder (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    type ENUM('GENTLE','SECOND','FINAL') NOT NULL,
    status ENUM('PENDING','SENT','SNOOZED','DISMISSED') DEFAULT 'PENDING',
    due_date DATE NOT NULL,
    ai_draft_email TEXT,
    snoozed_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### coach_message
```sql
CREATE TABLE coach_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    role ENUM('USER','ASSISTANT') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Docker Compose (Production Setup)

```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: crosstrack_db
      MYSQL_USER: crosstrack_user
      MYSQL_PASSWORD: CrossTrack2024!
      MYSQL_ROOT_PASSWORD: rootpass
    ports: ["3306:3306"]
    volumes: ["mysql_data:/var/lib/mysql"]

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes: ["qdrant_data:/qdrant/storage"]

  crosstrack-api:
    build: ./crosstrack-api
    ports: ["8080:8080"]
    depends_on: [mysql, qdrant]
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/crosstrack_db
      QDRANT_HOST: qdrant
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

  crosstrack-dashboard:
    build: ./crosstrack-dashboard
    ports: ["5173:80"]
    depends_on: [crosstrack-api]

volumes:
  mysql_data:
  qdrant_data:
```

---

## What Makes This Unique (Competitive Advantages)

| Feature | Simplify | JobRight | Teal | **CrossTrack** |
|---------|----------|----------|------|----------------|
| Application Tracking | Basic | Basic | Yes | Full Cycle + AI |
| Resume Tailoring | No | No | No | LLM per-job |
| Match Scoring | No | Basic | No | Real-time in extension |
| Career Memory | No | No | No | Mem0-like personal AI |
| Follow-up Engine | No | No | No | AI-drafted emails |
| Interview Prep | No | No | No | Company-specific AI |
| Rejection Analysis | No | No | No | Application Autopsy |
| Career Coach Chat | No | No | No | RAG-powered personal coach |
| Ghost Detection | No | No | No | Multi-level detection |
| Gmail Auto-Scan | No | No | No | Multi-account scanning |

---

## Milestones

### Sprint 1 (Current) — AI Foundation
- [x] UI Redesign (completed)
- [ ] LLM integration (Spring AI + Claude API)
- [ ] UserMemory + ResumeVariant entities
- [ ] Resume-Job Match Score endpoint
- [ ] Cover Letter Generator
- [ ] Follow-Up Email Generator
- [ ] Career Coach chat endpoint
- [ ] Follow-Up Reminder scheduler
- [ ] Frontend: Coach page, Match Score UI, Follow-up dashboard

### Sprint 2 — Intelligence Layer
- [ ] Qdrant integration for vector search
- [ ] Embedding pipeline (all-MiniLM-L6-v2)
- [ ] Memory-augmented coaching (RAG)
- [ ] Application Autopsy
- [ ] Skill Gap Analyzer
- [ ] Enhanced Kanban (full job cycle stages)

### Sprint 3 — Interview & Offers
- [ ] Interview Prep Hub
- [ ] Mock Interview AI
- [ ] Offer Comparison Dashboard
- [ ] Salary Negotiation Coach

### Sprint 4 — Production & Polish
- [ ] Docker Compose deployment
- [ ] Rate limiting & API key management
- [ ] Chrome Web Store preparation
- [ ] Performance optimization
- [ ] Mobile-responsive dashboard
