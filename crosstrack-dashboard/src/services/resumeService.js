import api from './api';

const resumeService = {
  upload: (file, name) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    return api.post('/resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  list: () =>
    api.get('/resumes').then(r => r.data),

  setDefault: (id) =>
    api.put(`/resumes/${id}/default`).then(r => r.data),

  remove: (id) =>
    api.delete(`/resumes/${id}`).then(r => r.data),

  getText: (id) =>
    api.get(`/resumes/${id}/text`).then(r => r.data),
};

export default resumeService;
