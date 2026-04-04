import api from './api';

const coachService = {
  sendMessage: (message, sessionId, enableWebSearch = false) =>
    api.post('/coach/chat', { message, sessionId, enableWebSearch }).then(r => r.data),

  getHistory: (sessionId) =>
    api.get('/coach/history', { params: sessionId ? { sessionId } : {} }).then(r => r.data),

  clearHistory: () =>
    api.delete('/coach/history').then(r => r.data),

  getMemories: (category) =>
    api.get('/coach/memories', { params: category ? { category } : {} }).then(r => r.data),

  updateMemory: (id, data) =>
    api.put(`/coach/memories/${id}`, data).then(r => r.data),

  deleteMemory: (id) =>
    api.delete(`/coach/memories/${id}`).then(r => r.data),
};

export default coachService;
