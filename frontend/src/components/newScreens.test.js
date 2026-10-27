/* Tests for the newer screens: offer checker, city comparison, score trend, error log, cover letter
   and admin two-factor setup. The API is replaced with a fake that answers instantly. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import OfferChecker from './salary/OfferChecker';
import CityCompare from './salary/CityCompare';
import ScoreTrend from './dashboard/ScoreTrend';
import ErrorLog from './admin/ErrorLog';
import CoverLetter from './resume/CoverLetter';
import TwoFactorSetup from './admin/TwoFactorSetup';
import { reportError } from '../lib/errorReporter';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  errorMessage: (err, fallback) => err?.response?.data?.error || fallback,
}));
jest.mock('./ui/overlays', () => {
  const notify = jest.fn();
  return {
    useFeedback: () => ({ notify, confirm: jest.fn().mockResolvedValue(true) }),
    Modal: ({ open, children, footer }) => (open ? <div role="dialog">{children}{footer}</div> : null),
  };
});

beforeEach(() => jest.clearAllMocks());

const REQUEST = { job_title: 'Data Analyst', years_of_experience: 3, city: 'Pune', work_mode: 'On-site', skills: ['SQL'] };

test('offer checker places an offer and suggests what to ask for', async () => {
  api.post.mockResolvedValue({ data: {
    offer: 600000, percentile: 34, below_range: false, above_range: false, median: 700000,
    likely_range: { min: 550000, max: 900000 }, wide_range: { min: 400000, max: 1200000 },
    verdict: 'fair_low', headline: 'Fair, but on the low side.', ask_for: 700000, advice: 'Ask for the middle.',
  } });
  render(<OfferChecker request={REQUEST} />);
  fireEvent.change(screen.getByLabelText('Offer in lakhs per annum'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check it' }));
  expect(await screen.findByText('Fair, but on the low side.')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/salary/offer-check', { ...REQUEST, offer_lpa: 6 });
  expect(screen.getByText('34%')).toBeInTheDocument();
  expect(screen.getAllByText('₹7.0 LPA').length).toBeGreaterThan(0);
});

test('offer checker asks for a number first', () => {
  render(<OfferChecker request={REQUEST} />);
  fireEvent.click(screen.getByRole('button', { name: 'Check it' }));
  expect(screen.getByRole('alert')).toHaveTextContent('lakhs per annum');
  expect(api.post).not.toHaveBeenCalled();
});

test('city comparison lists cities with the difference from yours', async () => {
  api.post.mockResolvedValue({ data: { cities: [
    { city: 'Bengaluru', predicted_salary: 760000, salary_range: { min: 600000, max: 950000 } },
    { city: 'Pune', predicted_salary: 640000, salary_range: { min: 500000, max: 800000 } },
  ] } });
  render(<CityCompare request={REQUEST} allCities={['Bengaluru', 'Pune', 'Jaipur']} />);
  expect(await screen.findByText('Bengaluru')).toBeInTheDocument();
  expect(screen.getByText('yours')).toBeInTheDocument();
  expect(screen.getByText('+₹1.2 LPA vs Pune')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/salary/cities', { ...REQUEST, cities: [] });
});

test('score trend shows how the score moved', () => {
  const points = [58, 71, 82].map((score, i) => ({ score, filename: `v${i}.pdf`, created_at: `2026-10-0${i + 1}T10:00:00` }));
  render(<ScoreTrend points={points} />);
  expect(screen.getByText('+24 points')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'ATS score history from 58 to 82' })).toBeInTheDocument();
});

test('score trend explains itself before the first upload', () => {
  render(<ScoreTrend points={[]} />);
  expect(screen.getByText(/after your first upload/)).toBeInTheDocument();
});

test('error log groups repeats and marks errors fixed', () => {
  const onResolve = jest.fn();
  const data = {
    open_total: 1, open_counts: { server: 1, client: 0, service: 0 },
    errors: [{ id: 7, kind: 'server', level: 'error', source: 'GET /profile', message: 'RuntimeError: boom', count: 3,
      detail: 'Traceback...', first_seen: '2026-10-26T10:00:00', last_seen: '2026-10-27T10:00:00', path: '/profile', user_id: 4 }],
  };
  render(<ErrorLog data={data} view="open" kind="" onView={jest.fn()} onKind={jest.fn()} onResolve={onResolve} onResolveAll={jest.fn()} onClearFixed={jest.fn()} />);
  expect(screen.getByText('RuntimeError: boom')).toBeInTheDocument();
  expect(screen.getByText('3 times')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark fixed' }));
  expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
});

test('error log has a calm empty state', () => {
  render(<ErrorLog data={{ errors: [], open_total: 0, open_counts: {} }} view="open" kind="" onView={jest.fn()} onKind={jest.fn()} />);
  expect(screen.getByText('No errors.')).toBeInTheDocument();
});

const AI_ON = { enabled: true, remaining_today: 3, daily_limit: 10 };

test('cover letter is hidden without AI and asks for a job description first', () => {
  const { container, unmount } = render(<MemoryRouter><CoverLetter resumeId={1} jd={null} status={{ enabled: false }} /></MemoryRouter>);
  expect(container).toBeEmptyDOMElement();
  unmount();
  render(<MemoryRouter><CoverLetter resumeId={1} jd={null} status={AI_ON} /></MemoryRouter>);
  expect(screen.getByText(/Add the job description above/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Write cover letter' })).not.toBeInTheDocument();
});

test('cover letter is written for the job and marks placeholders', async () => {
  api.post.mockResolvedValue({ data: {
    model: 'gemini', cached: false, ai: AI_ON, text: 'Dear Hiring Manager,',
    letter: { role: 'Backend Engineer', company: 'Paytm', greeting: 'Dear Hiring Manager,', sign_off: 'Regards,', signature: '[Your name]',
      paragraphs: ['I built payment services for [N] years.'], dropped: 1 },
  } });
  render(<MemoryRouter><CoverLetter resumeId={5} jd={{ text: 'Backend Engineer at Paytm, payments in Python.' }} status={AI_ON} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Write cover letter' }));
  expect(await screen.findByText('Backend Engineer · Paytm')).toBeInTheDocument();
  expect(screen.getByText('[N]')).toBeInTheDocument();
  expect(screen.getByText(/1 sentence was removed/)).toBeInTheDocument();
  expect(api.post.mock.calls[0][0]).toBe('/resumes/5/cover-letter');
});

test('two-factor setup walks through scan, code and recovery codes', async () => {
  api.get.mockResolvedValue({ data: { enabled: false, enabled_at: null, recovery_codes_left: 0 } });
  api.post
    .mockResolvedValueOnce({ data: { qr: 'data:image/svg+xml,abc', secret: 'ABCD EFGH', otpauth_uri: 'otpauth://totp/x' } })
    .mockResolvedValueOnce({ data: { enabled: true, enabled_at: '2026-10-27T10:00:00', recovery_codes_left: 8, recovery_codes: ['aaaaa-11111', 'bbbbb-22222'] } });
  const onChange = jest.fn();
  render(<TwoFactorSetup onChange={onChange} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Set up two-factor sign-in' }));
  expect(await screen.findByAltText(/QR code/)).toHaveAttribute('src', 'data:image/svg+xml,abc');
  expect(screen.getByText('ABCD EFGH')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Code from the app'), { target: { value: '12a3456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
  expect(await screen.findByText('aaaaa-11111')).toBeInTheDocument();
  expect(api.post).toHaveBeenLastCalledWith('/api/admin/2fa/enable', { code: '123456' });
  await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true })));
});

test('browser errors are reported once and noise is ignored', () => {
  api.post.mockResolvedValue({});
  reportError(new Error('x is undefined'));
  reportError(new Error('x is undefined'));
  reportError(new Error('ResizeObserver loop limit exceeded'));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe('/api/client-errors');
});
