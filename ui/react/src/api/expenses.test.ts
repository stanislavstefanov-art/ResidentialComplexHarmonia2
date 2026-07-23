import { getExpenses, recordExpense } from './expenses';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getExpenses fetches GET /expenses', async () => {
  mockFetch([]);
  await getExpenses();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/expenses`);
});

test('recordExpense posts to POST /expenses', async () => {
  const dto = {
    id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
    expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik1',
  };
  mockFetch(dto, 201);
  const body = {
    amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
    expenseDate: '2026-07-10', idempotencyKey: 'ik1',
  };
  const result = await recordExpense(body);
  expect(fetch).toHaveBeenCalledWith(`${BASE}/expenses`, expect.objectContaining({
    method: 'POST',
  }));
  expect(result).toEqual(dto);
});

test('recordExpense handles 200 duplicate response', async () => {
  const dto = {
    id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
    expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik1',
  };
  mockFetch(dto, 200);
  const result = await recordExpense({
    amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
    expenseDate: '2026-07-10', idempotencyKey: 'ik1',
  });
  expect(result).toEqual(dto);
});
