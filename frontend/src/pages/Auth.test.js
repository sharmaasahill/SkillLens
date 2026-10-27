import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Auth from './Auth';
import { useAuth } from '../contexts/AuthContext';
import { useSiteInfo } from '../lib/siteInfo';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/siteInfo', () => ({ useSiteInfo: jest.fn() }));
jest.mock('../api', () => ({
  errorMessage: (err, fallback) => err?.response?.data?.error || fallback,
}));

function renderAuth(auth, { site = { google_sign_in: false }, path = '/auth' } = {}) {
  useSiteInfo.mockReturnValue(site);
  useAuth.mockReturnValue({ user: null, loading: false, login: jest.fn(), register: jest.fn(), verifyTwoFactor: jest.fn(), ...auth });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<p>User home</p>} />
        <Route path="/admin" element={<p>Admin dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

test('has one sign-in, with no account type to choose', () => {
  renderAuth();
  expect(screen.queryByRole('group', { name: 'Account type' })).not.toBeInTheDocument();
});

test('logs in and sends regular users to the home page', async () => {
  const login = jest.fn().mockResolvedValue({ email: 'a@example.com', is_admin: false });
  renderAuth({ login });
  fillAndSubmit('a@example.com', 'password123');
  expect(await screen.findByText('User home')).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith('a@example.com', 'password123');
});

test('sends the admin account to the admin dashboard', async () => {
  const login = jest.fn().mockResolvedValue({ email: 'admin@example.com', is_admin: true });
  renderAuth({ login });
  fillAndSubmit('admin@example.com', 'password123');
  expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
});

test('asks the admin for the authenticator code when two-factor sign-in is on', async () => {
  const login = jest.fn().mockResolvedValue({ twoFactor: 'challenge-1' });
  const verifyTwoFactor = jest.fn().mockResolvedValue({ user: { email: 'admin@example.com', is_admin: true } });
  renderAuth({ login, verifyTwoFactor });
  fillAndSubmit('admin@example.com', 'password123');
  expect(await screen.findByText('Two-factor sign-in')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
  expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
  expect(verifyTwoFactor).toHaveBeenCalledWith('challenge-1', '123456');
});

test('a recovery code can be used instead of the app code', async () => {
  renderAuth({ login: jest.fn().mockResolvedValue({ twoFactor: 'challenge-1' }) });
  fillAndSubmit('admin@example.com', 'password123');
  fireEvent.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
  expect(screen.getByLabelText('Recovery code')).toBeInTheDocument();
});

test('creating an account needs the privacy box ticked', async () => {
  const register = jest.fn().mockResolvedValue({ email: 'n@example.com', is_admin: false });
  renderAuth({ register }, { path: '/auth?mode=signup' });
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Person' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'n@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'mango-river-lamp-7' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'mango-river-lamp-7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Privacy Policy');
  expect(register).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('User home')).toBeInTheDocument();
  expect(register).toHaveBeenCalledWith('n@example.com', 'mango-river-lamp-7', 'New Person', true);
});

test('shows Continue with Google only when the server has it set up', () => {
  renderAuth({}, { site: { google_sign_in: true } });
  const google = screen.getByRole('link', { name: /continue with google/i });
  expect(google.getAttribute('href')).toContain('/auth/google/start?mode=signin&consent=0');
});

test('explains why Google sent the person back', () => {
  renderAuth({}, { path: '/auth?mode=signup&error=google_consent' });
  expect(screen.getByRole('alert')).toHaveTextContent('tick the box');
});

test('shows a plain message for a wrong email or password', async () => {
  const error = { response: { status: 401, data: { error: 'Invalid email or password' } } };
  renderAuth({ login: jest.fn().mockRejectedValue(error) });
  fillAndSubmit('a@example.com', 'wrong');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
});

test('redirects visitors who are already signed in', () => {
  renderAuth({ user: { email: 'a@example.com', is_admin: false } });
  expect(screen.getByText('User home')).toBeInTheDocument();
});
