import { getMyPayments, getAllPayments, recordPayment, getBalance } from './payments';

const PAYMENT = {
  id: 'p1', householdRef: 'H001', amountEur: 150, period: '2026-07',
  dateReceived: '2026-07-15', recordedAt: '2026-07-15T10:00:00Z', idempotencyKey: 'ik1',
};
const BALANCE = { label: 'YTD-2026', lines: [{ householdRef: 'H001', totalCharged: 300, totalPaid: 150, balance: 150 }] };

beforeEach(() => { (global.fetch as jest.Mock) = jest.fn(); });

test('getMyPayments calls GET /payments', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [PAYMENT] });
  const result = await getMyPayments();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/payments');
  expect(result).toEqual([PAYMENT]);
});

test('getAllPayments calls GET /payments/all', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [PAYMENT] });
  const result = await getAllPayments();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/payments/all');
  expect(result).toEqual([PAYMENT]);
});

test('recordPayment calls POST /payments', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => PAYMENT });
  const body = { householdRef: 'H001', amountEur: 150, period: '2026-07', dateReceived: '2026-07-15', idempotencyKey: 'ik1' };
  const result = await recordPayment(body);
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/payments', expect.objectContaining({ method: 'POST' }));
  expect(result).toEqual(PAYMENT);
});

test('getBalance calls GET /balance', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => BALANCE });
  const result = await getBalance();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/balance');
  expect(result).toEqual(BALANCE);
});
