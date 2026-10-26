import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Auth from './Auth';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  errorMessage: (err, fallback) => err?.response?.data?.error || fallback,
}));

function renderAuth(auth) {
  useAuth.mockReturnValue({ user: null, loading: false, login: jest.fn(), register: jest.fn(), ...auth });
  render(
    <MemoryRouter initialEntries={['/auth']}>
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
  const login = jest.fn().mockResolvedValue({ email: 'admin.skilllens@gmail.com', is_admin: true });
  renderAuth({ login });
  fillAndSubmit('admin.skilllens@gmail.com', 'password123');
  expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
});

test('shows a plain message for a wrong email or password', async () => {
  const error = { response: { status: 401, data: { error: 'Invalid email or password' } } };
  renderAuth({ login: jest.fn().mockRejectedValue(error) });
  fillAndSubmit('a@example.com', 'wrong');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
});

test('shows other errors returned by the API', async () => {
  const error = { response: { status: 429, data: { error: 'Too many attempts. Try again in a minute.' } } };
  renderAuth({ login: jest.fn().mockRejectedValue(error) });
  fillAndSubmit('a@example.com', 'password123');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts'));
});

test('redirects visitors who are already signed in', () => {
  renderAuth({ user: { email: 'a@example.com', is_admin: false } });
  expect(screen.getByText('User home')).toBeInTheDocument();
});
