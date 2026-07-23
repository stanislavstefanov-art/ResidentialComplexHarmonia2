import { getPeriodSummary, getMyCharges, getMyPayments } from './financial';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getPeriodSummary fetches /financial-summary?period=', async () => {
  mockFetch({ period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 });
  await getPeriodSummary('2026-07');
  expect(fetch).toHaveBeenCalledWith(`${BASE}/financial-summary?period=2026-07`);
});

test('getMyCharges fetches /maintenance-fees/charges', async () => {
  mockFetch([]);
  await getMyCharges();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/maintenance-fees/charges`);
});

test('getMyPayments fetches /payments', async () => {
  mockFetch([]);
  await getMyPayments();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/payments`);
});
