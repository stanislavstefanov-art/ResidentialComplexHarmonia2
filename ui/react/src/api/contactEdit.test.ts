import { updateMyContact, updateContact, updateNotes } from './contactEdit';

beforeEach(() => { (global.fetch as jest.Mock) = jest.fn(); });

test('updateMyContact calls PUT /directory/contact', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  await updateMyContact({ displayName: 'Ada Lovelace', phone: '+1234' });
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/contact',
    expect.objectContaining({ method: 'PUT' }),
  );
});

test('updateContact calls PUT /directory/board/contact with ref in query', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  await updateContact('H001', { displayName: 'Board Edit' });
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/board/contact?householdRef=H001',
    expect.objectContaining({ method: 'PUT' }),
  );
});

test('updateNotes calls PUT /directory/board/notes with ref in query', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  await updateNotes('H001', 'Some note');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/board/notes?householdRef=H001',
    expect.objectContaining({ method: 'PUT' }),
  );
});
