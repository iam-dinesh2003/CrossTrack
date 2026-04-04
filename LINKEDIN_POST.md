# LinkedIn Post (Copy-paste this)

---

## Short Post (For LinkedIn Feed)

I got tired of losing track of job applications across LinkedIn, Indeed, Handshake, and 10 other platforms.

So I built CrossTrack - a full-stack AI career platform from scratch.

What it does:
- Chrome Extension auto-captures every job you apply to
- Gmail Integration scans your inbox for application confirmations
- AI Career Coach gives advice based on YOUR actual application data
- Mock Interview AI scores your answers in real-time
- Resume Match Score tells you how well you fit a job description
- Ghost Job Detection flags companies that ghosted you
- Kanban Board to visually track your pipeline
- Analytics Dashboard shows which platforms work best for you

Tech Stack:
- Backend: Java 17, Spring Boot 3.2, MySQL, JWT Auth, WebSocket
- Frontend: React 19, Tailwind CSS, TanStack Query, Recharts
- AI: Google Gemini API (completely free - 500 requests/day)
- Extension: Chrome Manifest V3 with Performance Observer
- Gmail API for email parsing with multi-account support

The entire AI layer runs on Gemini's free tier. Zero cost.

I built this because the job search process in 2025 is genuinely overwhelming. You apply to 50+ companies and can't remember which ones you heard back from, which ones ghosted you, or which platforms give you the best results.

CrossTrack fixes that.

Open source on GitHub: [link]
Chrome Extension: [link]

#SoftwareEngineering #OpenSource #JobSearch #React #SpringBoot #AI #ChromeExtension #FullStack #CareerDevelopment #JobHunting

---

## Long-form LinkedIn Article

### Title: I Built an AI-Powered Job Tracker Because the Job Search Process is Broken

---

The modern job search is a mess.

You apply on LinkedIn. Then Indeed. Then Handshake. Then directly on company sites through Workday, Greenhouse, Lever, and iCIMS. Before you know it, you've applied to 50+ positions and can't remember half of them.

Sound familiar?

I built CrossTrack to fix this.

### What is CrossTrack?

CrossTrack is a full-stack AI career platform with three components:

1. **A Chrome Extension** that automatically captures every job you apply to on LinkedIn, Indeed, and Handshake
2. **A React Dashboard** with analytics, Kanban board, AI coaching, and mock interviews
3. **A Spring Boot API** that ties everything together with Gmail integration and AI-powered insights

### The AI That Actually Helps

Every AI feature runs on Google Gemini's free tier (500 requests/day, zero cost):

**AI Career Coach** - Not just generic advice. It knows your actual application history. If you've applied to 50 jobs with a 2% response rate, it'll tell you exactly what to fix.

**Mock Interview AI** - Pick a company and role, and it runs you through 5-7 questions. Each answer gets scored 1-10 with specific feedback. At the end, you get an overall assessment.

**Resume Match Score** - Upload your resume, paste a job description. It scores compatibility, identifies missing keywords, and suggests improvements.

**Ghost Job Detection** - A 3-level system that flags applications with no response after 28, 60, and 120 days. Because knowing you've been ghosted is better than wondering.

### Technical Architecture

The backend is Java 17 with Spring Boot 3.2, MySQL, and JWT authentication. The AI layer uses OkHttp to call Gemini's API with carefully crafted prompts for each feature.

The Chrome Extension uses Manifest V3 with a Performance Observer that detects actual HTTP requests when you submit an application - much more reliable than watching for DOM changes.

Gmail integration uses Google's OAuth 2.0 and Gmail API to scan for application confirmation emails. It parses HTML emails with Jsoup and uses regex patterns to extract company names, roles, and platforms from hundreds of different email formats.

Resume uploads automatically extract text using Apache PDFBox (PDF) and Apache POI (DOCX), so you never have to copy-paste your resume text.

### Why I Built This

I'm actively job searching, and I was frustrated. I had a spreadsheet that was always outdated, I forgot to follow up on promising leads, and I had no idea which platforms were actually working for me.

Now I use CrossTrack every day. It runs locally on my machine, my data stays private, and the AI features are genuinely useful - not gimmicky.

### Open Source

CrossTrack is fully open source. The entire codebase - API, dashboard, and Chrome extension - is available on GitHub.

If you're job searching and want to build something similar, or if you want to contribute, check it out.

GitHub: [link]
Chrome Extension: [link]

---

What tools do you use to manage your job search? I'd love to hear what works for you.

#SoftwareEngineering #OpenSource #JobSearch #AI #FullStack #React #SpringBoot #ChromeExtension #CareerDevelopment
