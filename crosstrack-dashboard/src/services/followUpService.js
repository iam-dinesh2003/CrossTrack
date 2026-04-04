import api from './api';

const followUpService = {
  getFollowUps: (filter = 'active') =>
    api.get('/follow-ups', { params: { filter } }).then(r => r.data),

  markSent: (id) =>
    api.put(`/follow-ups/${id}/sent`).then(r => r.data),

  snooze: (id, days = 3) =>
    api.put(`/follow-ups/${id}/snooze`, { days }).then(r => r.data),

  dismiss: (id) =>
    api.delete(`/follow-ups/${id}`).then(r => r.data),
};

export default followUpService;
