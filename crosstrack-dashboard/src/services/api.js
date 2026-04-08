import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crosstrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (expired/invalid token) — but NOT for AI endpoint errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Only redirect to login for actual auth failures (401),
    // NOT for 403 from rate limits or 500 from server errors
    if (status === 401 && !url.includes('/api/auth/')) {
      localStorage.removeItem('crosstrack_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
