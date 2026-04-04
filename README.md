<div align="center">

# CrossTrack - AI-Powered Job Application Tracker

### Stop Losing Track of Applications. Start Landing Interviews.

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-6DB33F?style=for-the-badge&logo=spring-boot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/Gemini%20AI-Free-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=google-chrome)](https://developer.chrome.com/docs/extensions)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A full-stack AI career platform that automatically tracks every job you apply to, provides AI-powered career coaching, mock interviews, resume matching, and smart email parsing — all from one dashboard.**

[Features](#features) | [Screenshots](#screenshots) | [Tech Stack](#tech-stack) | [Architecture](#architecture) | [Getting Started](#getting-started) | [Chrome Extension](#chrome-extension)

</div>

---

## The Problem

Job searching in 2025+ is broken:
- You apply to **50+ jobs** across LinkedIn, Indeed, Handshake, Workday, and company sites
- You lose track of which companies you applied to and when
- You forget to follow up, missing critical interview windows
- You have no idea which platforms give you the best response rates
- You waste hours copy-pasting job descriptions into ChatGPT for interview prep

## The Solution

**CrossTrack** is an all-in-one AI career platform that:
- **Auto-captures** every application via Chrome Extension (LinkedIn, Indeed, Handshake)
- **Scans your Gmail** to detect application confirmations and status changes
- **AI Career Coach** gives personalized advice using your actual application data
- **Mock Interviews** with AI that scores your answers and provides feedback
- **Ghost Job Detection** flags applications with no response after 28/60/120 days
- **Analytics Dashboard** shows response rates, platform success rates, and trends

---

## Features

### Core Platform
| Feature | Description |
|---------|-------------|
| **Smart Dashboard** | Real-time overview with stat cards, weekly charts, status donut, platform breakdown, and upcoming interviews |
| **Application Manager** | Full CRUD with search, filter by status/platform, inline status updates, document uploads |
| **Kanban Board** | Drag-and-drop board with Applied, Interview, Offer, Rejected, Ghosted columns |
| **Gmail Auto-Sync** | Connects multiple Gmail accounts, parses application confirmation emails, auto-detects company and role |
| **Chrome Extension** | One-click capture from LinkedIn, Indeed, Handshake with duplicate detection |

### AI-Powered Tools (Google Gemini - 100% Free)
| Feature | Description |
|---------|-------------|
| **AI Career Coach** | Chat-based coach that remembers your history, gives personalized advice based on your actual applications |
| **Resume Match Score** | Analyzes your resume against a job description, gives compatibility %, keyword gaps, and improvement tips |
| **Interview Prep Generator** | Generates role-specific technical and behavioral questions with sample answers |
| **Mock Interview AI** | Interactive mock interview — AI asks questions, you answer, get scored per question + overall assessment |
| **Interview Notes + AI Summary** | Capture raw interview notes, AI structures them into key questions, strengths, improvements, and action items |
| **Follow-Up Email Generator** | Auto-generates gentle/firm follow-up emails based on days since application |
| **Application Autopsy** | AI analyzes rejected applications to identify patterns and suggest improvements |

### Analytics & Intelligence
| Feature | Description |
|---------|-------------|
| **Response Rate Tracking** | See which platforms give you callbacks vs ghosting |
| **Platform Success Rates** | Compare LinkedIn vs Indeed vs Handshake vs Direct applications |
| **Weekly Trend Charts** | Track your application velocity over 8 weeks |
| **Ghost Job Detection** | 3-level alert system (28/60/120 days) flags stale applications |

---

## Screenshots

> **To add screenshots:** Take screenshots of your running app and save them to a `screenshots/` folder, then update the paths below.

### Dashboard
![Dashboard](screenshots/dashboard.png)
*Real-time overview with stats, charts, recent applications, and platform breakdown*

### Kanban Board
![Kanban](screenshots/kanban.png)
*Drag-and-drop board to visually manage your application pipeline*

### AI Career Coach
![Coach](screenshots/coach.png)
*AI-powered career coaching with persistent memory of your application history*

### Analytics
![Analytics](screenshots/analytics.png)
*Response rates, application trends, platform comparisons, and success metrics*

### Chrome Extension
![Extension](screenshots/extension.png)
*Auto-captures applications from LinkedIn, Indeed, and Handshake*

---

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Java 17** | Core language |
| **Spring Boot 3.2.5** | REST API framework |
| **Spring Security + JWT** | Authentication (30-day tokens) |
| **Spring Data JPA** | ORM / Data access |
| **MySQL** | Primary database |
| **WebSocket (STOMP)** | Real-time notifications |
| **Google Gmail API** | Email scanning & parsing |
| **Google Gemini API** | AI features (free tier - 500 req/day) |
| **OkHttp** | HTTP client for LLM calls |
| **Apache PDFBox 3.0** | PDF text extraction |
| **Apache POI 5.2** | DOCX text extraction |
| **Jsoup** | HTML email parsing |
| **Commons Text** | Fuzzy matching for deduplication |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework |
| **Vite** | Build tool |
| **Tailwind CSS 4** | Styling |
| **TanStack React Query** | Server state management |
| **Recharts** | Charts & data visualization |
| **@dnd-kit** | Drag-and-drop (Kanban) |
| **Lucide React** | Icon library |
| **Axios** | HTTP client |
| **React Router 7** | Client-side routing |
| **React Hot Toast** | Notifications |

### Chrome Extension
| Technology | Purpose |
|-----------|---------|
| **Manifest V3** | Chrome extension framework |
| **Content Scripts** | Job detection on LinkedIn/Indeed/Handshake |
| **Performance Observer** | Detect actual "Apply" network requests |
| **Levenshtein Distance** | Fuzzy duplicate detection |

---

## Architecture

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Chrome Extension| --> |  Spring Boot API  | <-- |  React Dashboard |
|  (Manifest V3)   |     |  (Port 8080)      |     |  (Port 5173)     |
|                  |     |                   |     |                  |
|  - LinkedIn      |     |  - JWT Auth       |     |  - Dashboard     |
|  - Indeed        |     |  - REST APIs      |     |  - Kanban Board  |
|  - Handshake     |     |  - WebSocket      |     |  - AI Tools      |
|  - Auto-detect   |     |  - Gmail API      |     |  - Analytics     |
|                  |     |  - Gemini AI      |     |  - Settings      |
+------------------+     |  - Schedulers     |     +------------------+
                         |                   |
                         +--------+----------+
                                  |
                         +--------v----------+
                         |                   |
                         |      MySQL        |
                         |   (crosstrack_db) |
                         |                   |
                         +-------------------+
```

### API Endpoints (30+)

```
Auth:        POST /api/auth/login, /api/auth/register
Apps:        GET/POST/PUT/DELETE /api/applications
Kanban:      PATCH /api/applications/{id}/status
AI Coach:    POST /api/coach/chat, GET /api/coach/history
AI Tools:    POST /api/ai/match-score, /api/ai/interview-prep
             POST /api/ai/generate-followup, /api/ai/analyze-rejection
Mock:        POST /api/ai/mock-interview/start, /api/ai/mock-interview/answer
Notes:       CRUD /api/interview-notes, POST /api/interview-notes/{id}/summarize
Gmail:       GET /api/gmail/status, POST /api/gmail/scan
Resumes:     CRUD /api/resumes (with PDF/DOCX text extraction)
Analytics:   GET /api/analytics/summary
Follow-Ups:  GET /api/follow-ups, POST /api/follow-ups/{id}/snooze
Ghost:       GET /api/ghost-jobs/summary
```

---

## Getting Started

### Prerequisites
- Java 17+
- Node.js 18+
- MySQL 8+
- Google Cloud Console account (for Gmail API)
- Google AI Studio account (for Gemini API key - free)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/CrossTrack.git
cd CrossTrack
```

### 2. Database Setup
```sql
CREATE DATABASE crosstrack_db;
CREATE USER 'crosstrack_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON crosstrack_db.* TO 'crosstrack_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Backend Setup
```bash
cd crosstrack-api

# Update application.properties with your credentials:
# - MySQL username/password
# - Google OAuth client ID/secret (from Google Cloud Console)
# - Gemini API key (from https://aistudio.google.com/apikey)

./mvnw spring-boot:run
```
Server starts on `http://localhost:8080`

### 4. Frontend Setup
```bash
cd crosstrack-dashboard
npm install
npm run dev
```
Dashboard starts on `http://localhost:5173`

### 5. Chrome Extension
```bash
# In Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the crosstrack-extension/ folder
# 5. Click the extension icon and log in
```

### 6. Gmail Integration
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:8080/api/gmail/callback` as a redirect URI
5. Copy the Client ID and Client Secret to `application.properties`
6. In the dashboard, go to Settings > Gmail Sync > Connect

### 7. AI Features (Free!)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a free API key
3. Set it as `AI_API_KEY` environment variable or in `application.properties`
4. Gemini 2.5 Flash gives you **500 free requests/day**

---

## Chrome Extension

The CrossTrack Chrome Extension automatically captures job applications as you apply:

### Supported Platforms
- **LinkedIn** - Detects Easy Apply submissions
- **Indeed** - Captures application confirmations
- **Handshake** - Tracks university job board applications

### How It Works
1. You browse jobs normally on LinkedIn/Indeed/Handshake
2. When you click "Submit Application", the extension detects it via Performance Observer
3. It extracts company name, role, URL, and platform
4. Checks for duplicates using fuzzy matching (Levenshtein distance)
5. Syncs to your CrossTrack dashboard instantly
6. Shows a green confirmation banner

### Features
- Auto-detection of application submissions
- Fuzzy duplicate prevention (won't add the same job twice)
- Quick-add form for manual tracking
- Status management from the popup
- Sync all local data to dashboard
- Works offline (stores locally, syncs when connected)

---

## AI Features Deep Dive

All AI features are powered by **Google Gemini 2.5 Flash** on the free tier (500 requests/day).

### Career Coach
- Chat-based AI coach with persistent memory
- Knows your application history, platforms, response rates
- Gives personalized advice: "You've applied to 50 jobs but only 2% response rate - let's fix your resume targeting"

### Mock Interview
- Choose company, role, and interview type (Technical/Behavioral/System Design)
- AI asks 5-7 questions progressively
- Each answer gets scored (1-10) with detailed feedback
- Final overall assessment with strengths and improvement areas

### Resume Match Score
- Upload your resume (PDF/DOCX - auto text extraction)
- Paste a job description
- AI scores compatibility (0-100%), identifies keyword gaps, suggests improvements

### Ghost Job Detection
- **Level 1 (Yellow):** 28+ days, no response - "Possibly Ghosted"
- **Level 2 (Orange):** 60+ days, no response - "Likely Ghosted"
- **Level 3 (Red):** 120+ days - "Dead Application"
- Automatic promotion via scheduled background jobs

---

## Project Structure

```
CrossTrack/
├── crosstrack-api/              # Spring Boot REST API
│   ├── src/main/java/.../
│   │   ├── controller/          # 14 REST controllers
│   │   ├── service/             # 12 service classes
│   │   ├── model/               # 10 JPA entities
│   │   ├── repository/          # 10 Spring Data repos
│   │   ├── dto/                 # 8 request/response DTOs
│   │   ├── security/            # JWT auth (filter, util, userdetails)
│   │   └── config/              # Security, WebSocket, migration configs
│   └── src/main/resources/
│       └── application.properties
│
├── crosstrack-dashboard/        # React + Vite frontend
│   └── src/
│       ├── components/          # 28 React components
│       │   ├── ai/              # Match Score, Interview Prep, Mock Interview, Notes
│       │   ├── applications/    # Table view, Add modal, Kanban board
│       │   ├── dashboard/       # Stat cards, charts, recent apps
│       │   ├── analytics/       # Charts, metrics, platform breakdown
│       │   ├── coach/           # AI career coach chat
│       │   ├── ghost/           # Ghost job detection
│       │   ├── followups/       # Follow-up reminders
│       │   ├── resumes/         # Resume management
│       │   ├── settings/        # Profile, Gmail, Notifications, Security
│       │   └── layout/          # Sidebar, Header, Layout
│       ├── services/            # 9 API service modules
│       ├── context/             # Auth context
│       └── utils/               # Platform utilities
│
└── crosstrack-extension/        # Chrome Extension (Manifest V3)
    ├── manifest.json
    ├── background.js            # Service worker, API sync, ghost checker
    ├── content.js               # Job detection, save triggers
    ├── injector.js              # Main world, Performance Observer
    ├── popup.html/js/css        # Extension popup UI
    └── icons/                   # Extension icons
```

---

## Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| **Gemini over OpenAI** | Free tier (500 req/day) vs paid. Perfect for a portfolio project and real daily use. |
| **JWT with 30-day expiry** | Balances security with UX. Users don't want to re-login daily. |
| **Performance Observer** | More reliable than DOM mutation observers for detecting actual API calls when applying. |
| **Levenshtein Distance** | Prevents duplicate applications with fuzzy matching (handles "Google" vs "Google LLC"). |
| **In-memory Rate Limiting** | Simple, no Redis dependency. 30 chats + 15 searches + 10 generations per day per user. |
| **Apache PDFBox + POI** | Auto-extracts text from uploaded resumes so users don't have to copy-paste. |
| **React Query** | Eliminates manual loading/error/cache state management. Auto-refetch on focus. |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Author

**Dinesh Nannapaneni**

- LinkedIn: [linkedin.com/in/dineshnannapaneni](https://linkedin.com/in/dineshnannapaneni)
- GitHub: [github.com/dineshnannapaneni](https://github.com/dineshnannapaneni)
- Email: dineshnannapaneni9@gmail.com

---

<div align="center">

**If CrossTrack helped you land your next role, give it a star!**

</div>
