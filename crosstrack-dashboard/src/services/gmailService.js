import api from './api';

// Get Google OAuth authorization URL
export const getAuthUrl = () =>
  api.get('/gmail/auth-url').then(res => res.data);

// Send auth code to backend (SPA flow)
export const sendAuthCode = (code) =>
  api.post('/gmail/callback-code', { code }).then(res => res.data);

// Check Gmail connection status (includes all accounts)
export const getGmailStatus = () =>
  api.get('/gmail/status').then(res => res.data);

// Trigger email scan (scans ALL connected accounts)
export const scanEmails = () =>
  api.post('/gmail/scan').then(res => res.data);

// Disconnect ALL Gmail accounts
export const disconnectGmail = () =>
  api.post('/gmail/disconnect').then(res => res.data);

// Disconnect a SPECIFIC Gmail account
export const disconnectAccount = (accountId) =>
  api.post(`/gmail/disconnect/${accountId}`).then(res => res.data);

// Update label for a Gmail account
export const updateAccountLabel = (accountId, label) =>
  api.put(`/gmail/accounts/${accountId}/label`, { label }).then(res => res.data);

// Request developer to add this user as a Google OAuth test user
export const requestGmailAccess = () =>
  api.post('/gmail/request-access').then(res => res.data);

// Get ghost level summary
export const getGhostSummary = () =>
  api.get('/gmail/ghost-summary').then(res => res.data);

// Cleanup Level 3 (dead) ghost applications
export const cleanupGhosts = () =>
  api.post('/gmail/ghost-cleanup').then(res => res.data);
