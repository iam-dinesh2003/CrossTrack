import api from './api';

const aiService = {
  getMatchScore: (resumeText, jobDescription) =>
    api.post('/ai/match-score', { resumeText, jobDescription }).then(r => r.data),

  generateCoverLetter: ({ resumeText, jobDescription, company, role, tone }) =>
    api.post('/ai/cover-letter', { resumeText, jobDescription, company, role, tone }).then(r => r.data),

  generateFollowUpEmail: ({ company, role, daysSinceApplied, type, context }) =>
    api.post('/ai/follow-up-email', { company, role, daysSinceApplied, type, context }).then(r => r.data),

  getInterviewPrep: ({ company, role, resumeText }) =>
    api.post('/ai/interview-prep', { company, role, resumeText }).then(r => r.data),

  analyzeRejection: (applicationId) =>
    api.post('/ai/application-autopsy', { applicationId }).then(r => r.data),

  webSearch: (query) =>
    api.post('/ai/web-search', { query }).then(r => r.data),

  research: (query) =>
    api.post('/ai/research', { query }).then(r => r.data),

  getUsage: () =>
    api.get('/ai/usage').then(r => r.data),

  // Mock Interview
  startMockInterview: ({ company, role, interviewType, resumeText, jobDescription }) =>
    api.post('/ai/mock-interview/start', { company, role, interviewType, resumeText, jobDescription }).then(r => r.data),

  answerMockQuestion: ({ company, role, interviewType, currentQuestion, answer, questionNumber, history, jobDescription }) =>
    api.post('/ai/mock-interview/answer', { company, role, interviewType, currentQuestion, answer, questionNumber, history, jobDescription }).then(r => r.data),

  // Interview Notes
  listInterviewNotes: () =>
    api.get('/interview-notes').then(r => r.data),

  getInterviewNote: (id) =>
    api.get(`/interview-notes/${id}`).then(r => r.data),

  createInterviewNote: (data) =>
    api.post('/interview-notes', data).then(r => r.data),

  updateInterviewNote: (id, data) =>
    api.put(`/interview-notes/${id}`, data).then(r => r.data),

  summarizeInterviewNote: (id) =>
    api.post(`/interview-notes/${id}/summarize`).then(r => r.data),

  deleteInterviewNote: (id) =>
    api.delete(`/interview-notes/${id}`).then(r => r.data),
};

export default aiService;
