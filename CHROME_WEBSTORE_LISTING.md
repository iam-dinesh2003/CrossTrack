# Chrome Web Store Listing

---

## Extension Name
CrossTrack - AI Job Application Tracker

## Short Description (132 chars max)
Auto-track every job you apply to on LinkedIn, Indeed & Handshake. AI-powered career coaching, analytics & ghost job detection.

## Detailed Description

CrossTrack automatically captures and tracks every job application you submit on LinkedIn, Indeed, and Handshake - so you never lose track of where you applied.

**How it works:**
1. Install the extension and create a free account
2. Apply to jobs normally on LinkedIn, Indeed, or Handshake
3. CrossTrack automatically detects when you submit an application
4. Your application is saved with company name, role, platform, and URL
5. View all your applications in the CrossTrack dashboard

**Features:**
- Auto-captures applications from LinkedIn Easy Apply, Indeed Apply, and Handshake
- Smart duplicate detection prevents the same job from being saved twice
- Quick-add form for manually tracking applications from other platforms
- Status tracking: Applied, Interview, Offer, Rejected, Ghosted
- Syncs with the CrossTrack Dashboard for advanced features

**Dashboard Features (Free):**
- Kanban board with drag-and-drop status management
- AI Career Coach powered by Google Gemini
- Mock Interview AI with real-time scoring
- Resume Match Score against job descriptions
- Interview Prep question generator
- Gmail integration to auto-detect application emails
- Ghost Job Detection (flags companies that don't respond)
- Analytics dashboard with response rates and platform comparisons
- Follow-up email generator

**Privacy First:**
- Your data is stored locally and on your own self-hosted server
- We never sell or share your data
- Gmail integration is read-only - we never send, delete, or modify emails
- No analytics or tracking cookies
- Open source - inspect the code yourself

**Tech:** Built with Manifest V3, Chrome Storage API, and Performance Observer for reliable application detection.

---

## Category
Productivity

## Language
English

---

## Privacy Policy (Required for Chrome Web Store)

### CrossTrack Privacy Policy

**Last Updated: March 2026**

**What data we collect:**
- Job application data you choose to track (company name, role, platform, URL, application date)
- Account credentials (email and hashed password) for authentication
- Gmail data (read-only) only when you explicitly connect your Gmail account

**How we use your data:**
- To display your job applications in the CrossTrack dashboard
- To provide AI-powered career coaching and interview prep
- To detect ghost jobs and generate follow-up suggestions
- To show analytics about your application activity

**Data storage:**
- All data is stored on your self-hosted server (localhost by default)
- No data is sent to third-party servers except Google Gemini API for AI features (only the text you submit for analysis)
- Gmail data is processed server-side and never stored in raw email form

**Data sharing:**
- We do NOT sell, rent, or share your personal data with any third party
- AI queries are sent to Google Gemini API but contain no personally identifiable information beyond what you type

**Gmail permissions:**
- We request Gmail read-only access
- We only scan for job application-related emails
- We NEVER send, delete, modify, or forward any emails
- You can disconnect Gmail at any time from Settings

**Data deletion:**
- You can delete your account and all associated data at any time from Settings
- Disconnecting Gmail immediately revokes access and deletes stored tokens

**Open Source:**
- CrossTrack is open source. You can inspect exactly what data we collect and how we process it on our GitHub repository.

**Contact:**
For privacy concerns, contact: dineshnannapaneni9@gmail.com

---

## Screenshots Needed for Chrome Web Store

You need 1-5 screenshots (1280x800 or 640x400):

1. **Extension popup** - Show the popup with application list and stats
2. **Auto-capture** - Show the green banner appearing after applying on LinkedIn
3. **Dashboard** - Show the CrossTrack dashboard with applications
4. **Kanban Board** - Show the drag-and-drop board
5. **AI Features** - Show the career coach or mock interview

## Store Icon
- 128x128 PNG (you already have icon128.png in the extension)

## Promotional Images (Optional but recommended)
- Small promo tile: 440x280
- Large promo tile: 920x680
- Marquee: 1400x560

---

## Steps to Publish on Chrome Web Store

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay the one-time $5 developer registration fee
3. Click "New Item"
4. Upload a ZIP of the crosstrack-extension/ folder
5. Fill in the listing details from above
6. Upload screenshots
7. Add the privacy policy
8. Submit for review (takes 1-3 business days)

**Important Notes:**
- Remove any localhost URLs from manifest.json before publishing (or make them configurable)
- Add your production API URL to the extension's host_permissions
- Make sure icon files are included in the ZIP
- The extension must work without the dashboard for basic features (local storage)
