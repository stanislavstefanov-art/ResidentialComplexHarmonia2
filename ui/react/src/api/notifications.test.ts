import { getHistory, sendAnnouncement } from './notifications';

const NOTIFICATION = { id: 'n1', title: 'Test notice', sentAt: '2026-07-17T10:00:00Z', channel: 'web-push' };

beforeEach(() => { (global.fetch as jest.Mock) = jest.fn(); });

test('getHistory calls GET /notifications', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [NOTIFICATION] });
  const result = await getHistory();
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/notifications');
  expect(result).toEqual([NOTIFICATION]);
});

test('sendAnnouncement calls POST /notifications/announce', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  await sendAnnouncement({ title: 'Test', body: 'Body' });
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/notifications/announce',
    expect.objectContaining({ method: 'POST' }),
  );
});
