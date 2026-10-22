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
        <Route path="/" element={<p>User home</p>} />
        <Route path="/hr-dashboard" element={<p>HR dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

test('logs in and sends regular users to the home page', async () => {
  const login = jest.fn().mockResolvedValue({ email: 'a@example.com', is_admin: false });
  renderAuth({ login });
  fillAndSubmit('a@example.com', 'password123');
  expect(await screen.findByText('User home')).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith('a@example.com', 'password123');
});

test('sends HR users to the HR dashboard', async () => {
  renderAuth({ login: jest.fn().mockResolvedValue({ email: 'hr@example.com', is_admin: true }) });
  fillAndSubmit('hr@example.com', 'password123');
  expect(await screen.findByText('HR dashboard')).toBeInTheDocument();
});

test('shows the error returned by the API', async () => {
  const error = { response: { data: { error: 'Invalid email or password' } } };
  renderAuth({ login: jest.fn().mockRejectedValue(error) });
  fillAndSubmit('a@example.com', 'wrong');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
});

test('redirects visitors who are already signed in', () => {
  renderAuth({ user: { email: 'a@example.com', is_admin: false } });
  expect(screen.getByText('User home')).toBeInTheDocument();
});
