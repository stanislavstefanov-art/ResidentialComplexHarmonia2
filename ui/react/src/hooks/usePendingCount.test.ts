import { renderHook, waitFor, act } from '@testing-library/react';
import { usePendingCount } from './usePendingCount';
import * as api from '../api/adminPending';

jest.mock('../api/adminPending');
const mockListPending = api.listPending as jest.Mock;

/** jsdom exposes visibilityState as a getter, so it has to be redefined rather than assigned. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function becomeVisible() {
  setVisibility('visible');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setVisibility('visible');
  mockListPending.mockResolvedValue([{}, {}]);
});

afterEach(() => {
  jest.useRealTimers();
});

test('does not call the API at all for a non-admin', () => {
  renderHook(() => usePendingCount(false));
  expect(mockListPending).not.toHaveBeenCalled();
});

test('fetches the count once on mount for an admin', async () => {
  const { result } = renderHook(() => usePendingCount(true));
  await waitFor(() => expect(result.current.count).toBe(2));
  expect(mockListPending).toHaveBeenCalledTimes(1);
});

test('never polls on a timer', async () => {
  renderHook(() => usePendingCount(true));
  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));

  // The old implementation ran setInterval(poll, 60_000). A timer-driven poll
  // reset the database's 60-minute auto-pause countdown forever, so it never slept.
  act(() => { jest.advanceTimersByTime(10 * 60_000); });

  expect(mockListPending).toHaveBeenCalledTimes(1);
});

test('refreshes when the admin returns to the tab', async () => {
  renderHook(() => usePendingCount(true));
  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));

  act(() => { jest.advanceTimersByTime(61_000); });
  becomeVisible();

  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(2));
});

test('ignores a tab switch that lands inside the throttle window', async () => {
  renderHook(() => usePendingCount(true));
  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));

  // Flipping between tabs must not turn into a request per flip.
  act(() => { jest.advanceTimersByTime(5_000); });
  becomeVisible();
  becomeVisible();

  expect(mockListPending).toHaveBeenCalledTimes(1);
});

test('does not refresh when the tab is merely hidden', async () => {
  renderHook(() => usePendingCount(true));
  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));

  act(() => { jest.advanceTimersByTime(61_000); });
  setVisibility('hidden');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });

  expect(mockListPending).toHaveBeenCalledTimes(1);
});

test('stops listening once unmounted', async () => {
  const { unmount } = renderHook(() => usePendingCount(true));
  await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));

  unmount();
  act(() => { jest.advanceTimersByTime(61_000); });
  becomeVisible();

  expect(mockListPending).toHaveBeenCalledTimes(1);
});

test('exposes setCount so a screen can report a fresh count without another request', async () => {
  const { result } = renderHook(() => usePendingCount(true));
  await waitFor(() => expect(result.current.count).toBe(2));

  act(() => { result.current.setCount(0); });

  expect(result.current.count).toBe(0);
  expect(mockListPending).toHaveBeenCalledTimes(1);
});
