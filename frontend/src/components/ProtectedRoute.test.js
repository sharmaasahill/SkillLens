import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

function renderAt(path, { hrOnly = false } = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<p>Login page</p>} />
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/secret" element={<ProtectedRoute hrOnly={hrOnly}><p>Secret page</p></ProtectedRoute>} />
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

test('keeps regular users out of HR-only pages', () => {
  useAuth.mockReturnValue({ user: { email: 'a@example.com', is_admin: false }, loading: false });
  renderAt('/secret', { hrOnly: true });
  expect(screen.getByText('Home page')).toBeInTheDocument();
});

test('lets HR users into HR-only pages', () => {
  useAuth.mockReturnValue({ user: { email: 'hr@example.com', is_admin: true }, loading: false });
  renderAt('/secret', { hrOnly: true });
  expect(screen.getByText('Secret page')).toBeInTheDocument();
});
