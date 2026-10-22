import { lpa, money, signedPercent } from './format';

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
