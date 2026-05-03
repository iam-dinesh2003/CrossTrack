import api from './api';

/** Search jobs — extended timeout because JSearch + Gemini scoring can take ~30s */
export const discoverJobs = ({ query = '', page = 1, location = '', remote = false, employmentType = '', publishers = '', resumeId = null } = {}) =>
  api.get('/jobs/discover', {
    params: { query, page, location, remote, employmentType, publishers, ...(resumeId != null && { resumeId }) },
    timeout: 60000,   // 60s — overrides the default 15s for this endpoint only
  }).then(r => r.data);

/** Log a job discovery application to CrossTrack */
export const quickApply = (jobData) =>
  api.post('/jobs/quick-apply', jobData).then(r => r.data);
