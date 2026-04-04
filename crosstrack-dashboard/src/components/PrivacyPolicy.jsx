export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#222' }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> April 4, 2026</p>

      <h2>1. What is CrossTrack?</h2>
      <p>CrossTrack is a job application tracker that automatically detects applications submitted on LinkedIn, Indeed, and Handshake via a Chrome Extension, and stores them in your personal dashboard.</p>

      <h2>2. Data We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> Email address and password (stored as a bcrypt hash) when you register.</li>
        <li><strong>Job application data:</strong> Company name, job title, platform, and application date — captured from job sites when you apply.</li>
        <li><strong>Gmail data (optional):</strong> If you connect Gmail, we read email subjects and senders to detect interview invites and rejections. We do not store email content.</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>To display your job application history in your personal dashboard.</li>
        <li>To send follow-up reminders for applications with no response.</li>
        <li>To provide AI-powered career coaching based on your application history.</li>
      </ul>

      <h2>4. Data Sharing</h2>
      <p>We do not sell, rent, or share your data with any third parties. Your data is only used to provide CrossTrack features to you.</p>

      <h2>5. Data Storage</h2>
      <p>Your data is stored securely in a MySQL database hosted on Railway. Authentication tokens are stored locally in your browser using localStorage.</p>

      <h2>6. Chrome Extension Permissions</h2>
      <ul>
        <li><strong>activeTab / scripting:</strong> To detect job applications on the current job listing page.</li>
        <li><strong>storage:</strong> To store your login token locally.</li>
        <li><strong>tabs:</strong> To identify which job site you are on.</li>
        <li><strong>alarms:</strong> To trigger follow-up reminders.</li>
      </ul>

      <h2>7. Your Rights</h2>
      <p>You can delete your account and all associated data at any time from the Settings page. You can also disconnect Gmail access from Settings.</p>

      <h2>8. Contact</h2>
      <p>If you have any questions about this privacy policy, contact us at: <a href="mailto:dineshnannapaneni9@gmail.com">dineshnannapaneni9@gmail.com</a></p>
    </div>
  );
}
