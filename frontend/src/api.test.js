import api, { csrf, errorMessage, setSessionExpiredHandler } from './api';

// Replace the network layer: each test queues the responses it wants
let responses;
let requests;

beforeEach(() => {
  localStorage.clear();
  requests = [];
  responses = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    const next = responses.shift() || { status: 200, data: {} };
    const response = { data: next.data, status: next.status, statusText: '', headers: {}, config };
    if (next.status >= 400) {
      const error = new Error(`Request failed with status ${next.status}`);
      error.config = config;
      error.response = response;
      throw error;
    }
    return response;
  };
});

test('sends cookies and attaches the CSRF token only to write requests', async () => {
  csrf.save({ csrf_access_token: 'access-csrf', csrf_refresh_token: 'refresh-csrf' });

  await api.get('/profile');
  await api.post('/predict', {});
  await api.post('/auth/refresh');

  expect(requests[0].withCredentials).toBe(true);
  expect(requests[0].headers['X-CSRF-TOKEN']).toBeUndefined();
  expect(requests[1].headers['X-CSRF-TOKEN']).toBe('access-csrf');
  expect(requests[2].headers['X-CSRF-TOKEN']).toBe('refresh-csrf');
});

test('refreshes an expired session once and retries the request', async () => {
  responses = [
    { status: 401, data: { error: 'Token has expired' } },
    { status: 200, data: { csrf_access_token: 'new-csrf' } },
    { status: 200, data: { ok: true } },
  ];

  const { data } = await api.get('/profile');

  expect(data).toEqual({ ok: true });
  expect(requests.map((r) => r.url)).toEqual(['/profile', '/auth/refresh', '/profile']);
  expect(localStorage.getItem('csrf_access_token')).toBe('new-csrf');
});

test('reports an expired session when the refresh also fails', async () => {
  const expired = jest.fn();
  setSessionExpiredHandler(expired);
  csrf.save({ csrf_access_token: 'old' });
  responses = [{ status: 401, data: {} }, { status: 401, data: {} }];

  await expect(api.get('/profile')).rejects.toThrow();
  expect(expired).toHaveBeenCalled();
  expect(localStorage.getItem('csrf_access_token')).toBeNull();
});

test('does not try to refresh after a failed login', async () => {
  responses = [{ status: 401, data: { error: 'Invalid email or password' } }];
  await expect(api.post('/auth/login', {})).rejects.toThrow();
  expect(requests).toHaveLength(1);
});

test('errorMessage prefers validation details, then the error field', () => {
  const validation = { response: { data: { error: 'Invalid input', details: [{ field: 'age', message: 'too low' }] } } };
  expect(errorMessage(validation)).toBe('age: too low');
  expect(errorMessage({ response: { data: { error: 'Nope' } } })).toBe('Nope');
  expect(errorMessage({}, 'Fallback')).toBe('Fallback');
});
