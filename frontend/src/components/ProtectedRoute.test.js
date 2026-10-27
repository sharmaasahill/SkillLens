import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  __esModule: true,
  default: { put: jest.fn() },
  errorMessage: (err, fallback) => err?.response?.data?.error || fallback,
}));

function renderAt(path, { adminOnly = false } = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<p>Login page</p>} />
        <Route path="/dashboard" element={<p>Home page</p>} />
        <Route path="/secret" element={<ProtectedRoute adminOnly={adminOnly}><p>Secret page</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

test('shows a loading indicator while the session is being checked', () => {
  useAuth.mockReturnValue({ user: null, loading: true });
  renderAt('/secret');
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('redirects signed-out visitors to the login page', () => {
  useAuth.mockReturnValue({ user: null, loading: false });
  renderAt('/secret');
  expect(screen.getByText('Login page')).toBeInTheDocument();
});

test('renders the page for signed-in users', () => {
  useAuth.mockReturnValue({ user: { email: 'a@example.com', is_admin: false }, loading: false });
  renderAt('/secret');
  expect(screen.getByText('Secret page')).toBeInTheDocument();
});

test('keeps regular users out of admin-only pages', () => {
  useAuth.mockReturnValue({ user: { email: 'a@example.com', is_admin: false }, loading: false });
  renderAt('/secret', { adminOnly: true });
  expect(screen.getByText('Home page')).toBeInTheDocument();
});

test('lets the admin into admin-only pages', () => {
  useAuth.mockReturnValue({ user: { email: 'admin.skilllens@gmail.com', is_admin: true }, loading: false });
  renderAt('/secret', { adminOnly: true });
  expect(screen.getByText('Secret page')).toBeInTheDocument();
});

test('asks a user without a date of birth for it before showing the page', async () => {
  const refreshUser = jest.fn().mockResolvedValue({});
  api.put.mockResolvedValue({ data: {} });
  useAuth.mockReturnValue({ user: { email: 'g@example.com', is_admin: false, needs_date_of_birth: true }, loading: false, refreshUser, logout: jest.fn() });
  renderAt('/secret');
  expect(screen.getByText('One more thing')).toBeInTheDocument();
  expect(screen.queryByText('Secret page')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1998-05-14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  expect(api.put).toHaveBeenCalledWith('/update-profile', { date_of_birth: '1998-05-14' });
});

test('shows why a date of birth was not accepted', async () => {
  api.put.mockRejectedValue({ response: { data: { error: 'SkillLens is for people aged 18 or older' } } });
  useAuth.mockReturnValue({ user: { email: 'g@example.com', is_admin: false, needs_date_of_birth: true }, loading: false, refreshUser: jest.fn(), logout: jest.fn() });
  renderAt('/secret');
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2015-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('18 or older');
});
