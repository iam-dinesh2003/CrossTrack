import api from './api';

/** Platform-wide stats */
export const getStats = () => api.get('/admin/stats').then(r => r.data);

/** List all users, optionally filtered by search term */
export const getUsers = (search = '') =>
  api.get('/admin/users', { params: { search } }).then(r => r.data);

/** Full detail view for one user */
export const getUserDetail = (id) =>
  api.get(`/admin/users/${id}`).then(r => r.data);

/** Delete a user and all their data */
export const deleteUser = (id) =>
  api.delete(`/admin/users/${id}`).then(r => r.data);

/** Promote / demote a user (role: 'ROLE_ADMIN' | 'ROLE_USER') */
export const updateUserRole = (id, role) =>
  api.put(`/admin/users/${id}/role`, { role }).then(r => r.data);

/** Reset a user's daily AI rate limits */
export const resetUserLimits = (id) =>
  api.post(`/admin/users/${id}/reset-limits`).then(r => r.data);

/** Paginated list of all applications across all users */
export const getAllApplications = ({ page = 0, size = 50, status = '' } = {}) =>
  api.get('/admin/applications', { params: { page, size, status } }).then(r => r.data);

/** Manually trigger ghost check */
export const triggerGhostCheck = () =>
  api.post('/admin/ghost-check').then(r => r.data);

/** Repair "Unknown Role" applications for a specific user */
export const repairRoles = (userId) =>
  api.post('/admin/repair-roles', null, { params: { userId } }).then(r => r.data);

/** Repair "Unknown Role" applications across ALL users */
export const repairAllRoles = () =>
  api.post('/admin/repair-roles/all').then(r => r.data);
