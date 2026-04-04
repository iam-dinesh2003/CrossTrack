import api from './api';

export const getApplications = () =>
  api.get('/applications').then(res => res.data);

export const createApplication = (data) =>
  api.post('/applications', data).then(res => res.data);

export const updateStatus = (id, status) =>
  api.put(`/applications/${id}/status`, { status }).then(res => res.data);

export const updateApplication = (id, data) =>
  api.put(`/applications/${id}`, data).then(res => res.data);

export const deleteApplication = (id) =>
  api.delete(`/applications/${id}`);

export const checkDuplicate = (company, role) =>
  api.post('/duplicates/check', { company, role }).then(res => res.data);

export const deleteAllApplications = () =>
  api.delete('/applications/all').then(res => res.data);

export const uploadResume = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/applications/${id}/resume`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const uploadCoverLetter = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/applications/${id}/cover-letter`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const downloadResume = (id) =>
  api.get(`/applications/${id}/resume`, { responseType: 'blob' });

export const downloadCoverLetter = (id) =>
  api.get(`/applications/${id}/cover-letter`, { responseType: 'blob' });

export const removeResume = (id) =>
  api.delete(`/applications/${id}/resume`).then(res => res.data);

export const removeCoverLetter = (id) =>
  api.delete(`/applications/${id}/cover-letter`).then(res => res.data);
