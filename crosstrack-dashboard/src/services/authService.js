import api from './api';

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(res => res.data);

export const register = (email, password, displayName) =>
  api.post('/auth/register', { email, password, displayName }).then(res => res.data);

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email }).then(res => res.data);

export const verifyOtp = (email, otp) =>
  api.post('/auth/verify-otp', { email, otp }).then(res => res.data);

export const resetPassword = (email, otp, newPassword) =>
  api.post('/auth/reset-password', { email, otp, newPassword }).then(res => res.data);
