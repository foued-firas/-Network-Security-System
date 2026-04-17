import axios from 'axios';

const BASE = 'http://localhost:8000';

export const http = axios.create({ baseURL: BASE });

// Intercept to always resolve (don't throw on 4xx/5xx for predictable error handling)
http.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

// ─── Versions ───────────────────────────────────────────────────
export const getVersions = () => http.get('/versions').then(r => r.data);

// ─── Metrics History ────────────────────────────────────────────
export const getMetricsHistory = () => http.get('/metrics/history').then(r => r.data);

// ─── Compare two versions ────────────────────────────────────────
export const compareVersions = (v1, v2) =>
  http.get('/compare', { params: { v1, v2 } }).then(r => r.data);

// ─── Audit log ──────────────────────────────────────────────────
export const getAuditLog = (limit = 50) =>
  http.get('/audit', { params: { limit } }).then(r => r.data);

// ─── Predict ────────────────────────────────────────────────────
export const predict = (file) => {
  const form = new FormData();
  form.append('file', file);
  return http.post('/predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ─── Train pipeline ─────────────────────────────────────────────
export const runTrain = () => http.get('/train').then(r => r.data);

// ─── Rollback ───────────────────────────────────────────────────
export const rollback = (version) =>
  http.get(`/rollback/${version}`, { maxRedirects: 0 }).catch(e => {
    // 303 redirect → treat as success
    if (e.response?.status === 303) return { ok: true };
    throw e;
  });
