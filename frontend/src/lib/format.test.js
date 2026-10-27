import { birthDateBounds, birthDateLabel, lpa, money, signedPercent, yearsAgo } from './format';

test('money uses rupees with Indian digit grouping', () => {
  expect(money(1823000)).toBe('₹18,23,000');
  expect(money(99999)).toBe('₹99,999');
  expect(money(null)).toBe('-');
});

test('lpa quotes annual salary in lakhs, and crores above 100 lakh', () => {
  expect(lpa(1586000)).toBe('₹15.9 LPA');
  expect(lpa(390000)).toBe('₹3.9 LPA');
  expect(lpa(25000000)).toBe('₹2.50 Cr');
  expect(lpa(undefined)).toBe('-');
});

test('signedPercent shows the direction of an effect', () => {
  expect(signedPercent(73.6)).toBe('+74%');
  expect(signedPercent(-8.1)).toBe('\u22128%');
  expect(signedPercent(0)).toBe('0%');
});

test('a date of birth shows the same day in every time zone', () => {
  expect(birthDateLabel('1998-05-14')).toBe(new Date(1998, 4, 14).toLocaleDateString('en-IN'));
  expect(birthDateLabel(null)).toBe('-');
});

test('date-of-birth limits allow ages 18 to 100', () => {
  const today = new Date(2026, 9, 22);
  expect(yearsAgo(18, today)).toBe('2008-10-22');
  expect(birthDateBounds(today)).toEqual({ min: '1926-10-22', max: '2008-10-22' });
});
