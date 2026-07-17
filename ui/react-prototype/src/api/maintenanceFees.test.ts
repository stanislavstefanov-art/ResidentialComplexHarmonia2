import { getMyCharges, getAllCharges, recordCharge } from './maintenanceFees';

const CHARGE = {
  id: 'c1', householdRef: 'H001', amountEur: 150, description: 'Monthly fee',
  period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1',
};

beforeEach(() => { (global.fetch as jest.Mock) = jest.fn(); });

test('getMyCharges calls GET /maintenance-fees/charges', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [CHARGE] });
  const result = await getMyCharges();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/maintenance-fees/charges');
  expect(result).toEqual([CHARGE]);
});

test('getAllCharges calls GET /maintenance-fees/charges/all', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [CHARGE] });
  const result = await getAllCharges();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/maintenance-fees/charges/all');
  expect(result).toEqual([CHARGE]);
});

test('recordCharge calls POST /maintenance-fees/charges/{householdRef}', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => CHARGE });
  const body = { amountEur: 150, description: 'Monthly fee', period: '2026-07', idempotencyKey: 'ik1' };
  const result = await recordCharge('H001', body);
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/maintenance-fees/charges/H001',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(result).toEqual(CHARGE);
});
