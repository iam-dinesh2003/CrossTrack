import api from './api';

export const getSummary = () =>
  api.get('/analytics/summary').then(res => res.data);
