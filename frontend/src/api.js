import { getLang } from './lang.js';

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('cart3r:unauthorized'));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && v !== null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST', body: {} }),
  changePassword: (current, next) => request('/auth/password', { method: 'POST', body: { current, next } }),
  users: () => request('/users'),
  createUser: (u) => request('/users', { method: 'POST', body: u }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),
  overview: (categories) => request(`/overview${qs({ categories: categories?.join(',') })}`),
  falsePositives: (categories) => request(`/false-positives${qs({ categories: categories?.join(',') })}`),
  analytics: (params) => request(`/analytics${qs(params)}`),
  alerts: (params) => request(`/alerts${qs(params)}`),
  setAlertStatus: (id, status) => request(`/alerts/${id}`, { method: 'PATCH', body: { status } }),
  openCase: (id) => request(`/alerts/${id}/case`, { method: 'POST', body: {} }),
  cases: (status) => request(`/cases${qs({ status })}`),
  updateCase: (id, body) => request(`/cases/${id}`, { method: 'PATCH', body }),
  rules: () => request('/rules'),
  updateRule: (id, body) => request(`/rules/${id}`, { method: 'PATCH', body }),
  accounts: () => request('/accounts'),
  transactions: (limit = 20) => request(`/transactions${qs({ limit })}`),
  evaluate: (tx) => request('/evaluate', { method: 'POST', body: tx }),
  simulate: (count) => request('/simulate', { method: 'POST', body: { count } }),
};
