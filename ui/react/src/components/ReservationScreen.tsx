import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Snackbar, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { getSlots, claimSlot } from '../api/reservations';
import { Slot, SlotState } from '../types';

// ── Timeline constants ────────────────────────────────────────────────────────
const TZ = 'Europe/Sofia';
const H_START = 8;
const H_END = 23;
const EVENING_START = 17;
const EVENING_END = 23;
const STRIP_DAYS = 14;
const DURATIONS = [1, 2, 3, 4] as const;

// ── Timeline types ────────────────────────────────────────────────────────────
type HourState = 'free' | 'occupied' | 'past' | 'sel' | 'sel-start';
interface DayCell { date: Date; abbr: string; num: number; isPast: boolean; isToday: boolean; isSelected: boolean; key: string; }
interface HourCell { hour: number; slotKey: string; state: HourState; }
interface UpcomingEntry { sortKey: string; label: string; range: string; }

// ── Pure helpers ──────────────────────────────────────────────────────────────
function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function todayString(): string { return new Date().toISOString().slice(0, 10); }

function dateKey(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sofiaHourNow(): number {
  const s = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false });
  return parseInt(s.slice(0, 2), 10);
}

function parseHour(k: string): number {
  if (/^\d{4}$/.test(k)) return Math.floor(parseInt(k, 10) / 100);
  const m = k.match(/^(\d{1,2})/);
  return m ? parseInt(m[1], 10) : -1;
}

function fmtHour(h: number): string { return String(h).padStart(2, '0') + ':00'; }
function fmtDate(d: Date): string { return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; }

interface Feedback { msg: string; severity: 'success' | 'warning' | 'error'; }

// ── Main component ────────────────────────────────────────────────────────────
export default function ReservationScreen() {
  const { t } = useTranslation();

  // ── View mode ───────────────────────────────────────────────────────────────
  const [viewMode, setViewModeState] = useState<'timeline' | 'cards'>(() =>
    (localStorage.getItem('harmonia-reservation-view') as 'timeline' | 'cards') ?? 'cards'
  );
  const setViewMode = (mode: 'timeline' | 'cards') => {
    localStorage.setItem('harmonia-reservation-view', mode);
    setViewModeState(mode);
  };

  // ── Cards-mode state ────────────────────────────────────────────────────────
  const [day, setDay] = useState(todayString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [claimInFlight, setClaimInFlight] = useState<string>('');
  const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);

  // ── Timeline-mode state ────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(() => addDays(todayDate(), -1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [slotsMap, setSlotsMap] = useState<Map<string, Slot[]>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [slotError, setSlotError] = useState<string | null>(null);
  const [tlBooking, setTlBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const slotsCache = useRef<Set<string>>(new Set());

  // ── Cards handlers ──────────────────────────────────────────────────────────
  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getSlots(day);
      setSlots(r.slots);
    } catch {
      setError(t('reservation.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [day, t]);

  useEffect(() => { if (viewMode === 'cards') loadSlots(); }, [loadSlots, viewMode]);

  const handleClaim = async (slotKey: string) => {
    setClaimInFlight(slotKey);
    try {
      const r = await claimSlot(day, slotKey);
      if (r.outcome === 'confirmed-yours') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-mine' as SlotState } : s));
        setFeedback({ msg: t('reservation.confirmed', { slotKey }), severity: 'success' });
      } else if (r.outcome === 'refused-already-taken') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' as SlotState } : s));
        setFeedback({ msg: t('reservation.errTaken'), severity: 'warning' });
      } else {
        setFeedback({ msg: t('reservation.errConfirm'), severity: 'error' });
      }
    } catch {
      setFeedback({ msg: t('reservation.errNetwork'), severity: 'error' });
    } finally {
      setClaimInFlight('');
    }
  };

  // ── Timeline computed ──────────────────────────────────────────────────────
  const currentSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slotsMap.get(dateKey(selectedDate)) ?? [];
  }, [selectedDate, slotsMap]);

  const visibleDays = useMemo<DayCell[]>(() => {
    const today = todayDate();
    const todayStr = dateKey(today);
    const selStr = selectedDate ? dateKey(selectedDate) : null;
    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = dateKey(date);
      return {
        date,
        abbr: date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2).toUpperCase(),
        num: date.getDate(),
        isPast: date < today,
        isToday: key === todayStr,
        isSelected: key === selStr,
        key,
      };
    });
  }, [weekStart, selectedDate]);

  const hourCells = useMemo<HourCell[]>(() => {
    const isToday = selectedDate ? dateKey(selectedDate) === dateKey(todayDate()) : false;
    const nowH = isToday ? sofiaHourNow() : -1;
    const hourSlot = new Map<number, Slot>();
    for (const s of currentSlots) {
      const h = parseHour(s.slotKey);
      if (h >= H_START && h <= H_END) hourSlot.set(h, s);
    }
    return Array.from({ length: H_END - H_START + 1 }, (_, i) => {
      const hour = H_START + i;
      const slot = hourSlot.get(hour);
      let state: HourState = 'free';
      if (slot && slot.state !== 'free') state = 'occupied';
      if (isToday && hour < nowH) state = 'past';
      if (state === 'free') {
        if (startHour !== null && endHour !== null && hour >= startHour && hour < endHour) {
          state = hour === startHour ? 'sel-start' : 'sel';
        } else if (startHour !== null && endHour === null && hour === startHour) {
          state = 'sel-start';
        }
      }
      return { hour, slotKey: slot?.slotKey ?? String(hour), state };
    });
  }, [currentSlots, startHour, endHour, selectedDate]);

  const bookSummary = useMemo<string | null>(() => {
    if (!selectedDate || startHour === null || endHour === null) return null;
    return `${fmtDate(selectedDate)} · ${fmtHour(startHour)} – ${fmtHour(endHour)}`;
  }, [selectedDate, startHour, endHour]);

  const upcoming = useMemo<UpcomingEntry[]>(() => {
    const today = todayDate();
    const entries: UpcomingEntry[] = [];
    slotsMap.forEach((daySlots, key) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (date < today) return;
      const myHours = daySlots
        .filter(s => s.state === 'taken-mine')
        .map(s => parseHour(s.slotKey))
        .filter(h => h >= H_START && h <= H_END)
        .sort((a, b) => a - b);
      if (!myHours.length) return;
      let gs = myHours[0], ge = myHours[0] + 1;
      for (let i = 1; i < myHours.length; i++) {
        if (myHours[i] === ge) { ge++; }
        else {
          entries.push({ sortKey: key + fmtHour(gs), label: fmtDate(date), range: `${fmtHour(gs)} – ${fmtHour(ge)}` });
          gs = myHours[i]; ge = myHours[i] + 1;
        }
      }
      entries.push({ sortKey: key + fmtHour(gs), label: fmtDate(date), range: `${fmtHour(gs)} – ${fmtHour(ge)}` });
    });
    return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [slotsMap]);

  // ── Timeline handlers ──────────────────────────────────────────────────────
  const loadDay = useCallback(async (key: string, force = false) => {
    if (!force && slotsCache.current.has(key)) return;
    slotsCache.current.add(key);
    setLoadingKeys(prev => { const n = new Set(prev); n.add(key); return n; });
    setSlotError(null);
    try {
      const r = await getSlots(key);
      setSlotsMap(prev => new Map([...prev, [key, r.slots]]));
    } catch {
      slotsCache.current.delete(key);
      setSlotError(t('reservation.errLoad'));
    } finally {
      setLoadingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [t]);

  const selectDayCell = (day: DayCell) => {
    if (day.isPast) return;
    setSelectedDate(day.date);
    setStartHour(null);
    setEndHour(null);
    setBookError(null);
    setSlotError(null);
    loadDay(day.key);
  };

  const onHourTap = (cell: HourCell) => {
    if (cell.state === 'occupied' || cell.state === 'past') return;
    setBookError(null);
    if (startHour === null) {
      setStartHour(cell.hour);
    } else if (cell.hour === startHour) {
      setStartHour(null);
      setEndHour(null);
    } else if (cell.hour < startHour) {
      setStartHour(cell.hour);
      setEndHour(null);
    } else {
      setEndHour(cell.hour);
    }
  };

  const setDuration = (hours: number) => {
    if (startHour === null) return;
    setEndHour(Math.min(startHour + hours, H_END));
    setBookError(null);
  };

  const setWholeEvening = () => {
    setStartHour(EVENING_START);
    setEndHour(EVENING_END);
    setBookError(null);
  };

  const book = async () => {
    if (!selectedDate || startHour === null || endHour === null) return;
    const blockedCells = hourCells.filter(c => c.hour >= startHour! && c.hour < endHour! && c.state === 'occupied');
    if (blockedCells.length) { setBookError(t('reservation.errOccupied')); return; }
    const key = dateKey(selectedDate);
    const rangeCells = hourCells.filter(c => c.hour >= startHour! && c.hour < endHour!);
    setTlBooking(true);
    setBookError(null);
    try {
      const results = await Promise.all(
        rangeCells.map(c => claimSlot(key, c.slotKey).then(r => ({ slotKey: c.slotKey, outcome: r.outcome })).catch(() => ({ slotKey: c.slotKey, outcome: 'network-error' as const })))
      );
      const failed = results.filter(r => r.outcome !== 'confirmed-yours');
      if (!failed.length) {
        setSlotsMap(prev => {
          const newMap = new Map(prev);
          const daySlots = [...(newMap.get(key) ?? [])];
          for (const r of results) {
            const idx = daySlots.findIndex(s => s.slotKey === r.slotKey);
            if (idx >= 0) daySlots[idx] = { ...daySlots[idx], state: 'taken-mine' };
            else daySlots.push({ slotKey: r.slotKey, state: 'taken-mine' });
          }
          newMap.set(key, daySlots);
          return newMap;
        });
        setStartHour(null);
        setEndHour(null);
        setFeedback({ msg: t('reservation.bookingConfirmedSummary'), severity: 'success' });
      } else if (failed.some(r => r.outcome === 'refused-already-taken')) {
        setBookError(t('reservation.errTaken'));
        slotsCache.current.delete(key);
        loadDay(key, true);
      } else {
        setBookError(t('reservation.errNetwork'));
      }
    } finally {
      setTlBooking(false);
    }
  };

  const tlLoadingCurrent = selectedDate ? loadingKeys.has(dateKey(selectedDate)) : false;
  const isDurActive = (n: number) => startHour !== null && endHour !== null && endHour - startHour === n;
  const isEveningActive = () => startHour === EVENING_START && endHour === EVENING_END;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* View mode toggle */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant={viewMode === 'timeline' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('timeline')}
          sx={{ borderRadius: 4, textTransform: 'none' }}
        >
          {t('reservation.viewTimeline')}
        </Button>
        <Button
          size="small"
          variant={viewMode === 'cards' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('cards')}
          sx={{ borderRadius: 4, textTransform: 'none' }}
        >
          {t('reservation.viewCards')}
        </Button>
      </Box>

      {/* ── Cards mode ─────────────────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <>
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{t('reservation.selectDate')}</Typography>
            <input
              type="date"
              value={day}
              min={todayString()}
              onChange={e => setDay(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
            />
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}

          {error && !loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
              <Alert severity="error">{error}</Alert>
              <Button variant="outlined" startIcon={<Refresh />} onClick={loadSlots}>
                {t('common.retry')}
              </Button>
            </Box>
          )}

          {!loading && !error && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 1.5 }}>
              {slots.map(slot => (
                <SlotCard
                  key={slot.slotKey}
                  slot={slot}
                  onClaim={handleClaim}
                  loading={claimInFlight === slot.slotKey}
                  t={t}
                />
              ))}
              {slots.length === 0 && (
                <Typography color="text.secondary" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
                  {t('reservation.noSlots')}
                </Typography>
              )}
            </Box>
          )}
        </>
      )}

      {/* ── Timeline mode ──────────────────────────────────────────────────── */}
      {viewMode === 'timeline' && (
        <>
          {/* Week navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Button size="small" onClick={() => setWeekStart(prev => {
              const min = addDays(todayDate(), -1);
              const cand = addDays(prev, -7);
              return cand < min ? min : cand;
            })} sx={{ minWidth: 32, px: 0.5 }}>‹</Button>
            <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '.9rem', color: '#555' }}>
              {visibleDays.length > 0 && (() => {
                const first = visibleDays[0].date;
                const last = visibleDays[visibleDays.length - 1].date;
                const fm = first.toLocaleDateString('bg', { month: 'long' });
                const lm = last.toLocaleDateString('bg', { month: 'long' });
                return first.getMonth() === last.getMonth() ? `${fm} ${first.getFullYear()}` : `${fm} / ${lm} ${last.getFullYear()}`;
              })()}
            </Typography>
            <Button size="small" onClick={() => setWeekStart(prev => addDays(prev, 7))} sx={{ minWidth: 32, px: 0.5 }}>›</Button>
          </Box>

          {/* Day strip */}
          <Box sx={{ display: 'flex', gap: '4px', overflowX: 'auto', pb: 1, mb: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
            role="group">
            {visibleDays.map(d => (
              <Box
                component="button"
                key={d.key}
                className="day-btn"
                disabled={d.isPast}
                aria-pressed={d.isSelected}
                onClick={() => selectDayCell(d)}
                sx={{
                  flexShrink: 0, minWidth: 52, px: '4px', py: '6px',
                  background: d.isSelected ? '#e8f3ed' : 'white',
                  border: d.isSelected ? '2px solid #2e6b4f' : d.isToday ? '1px solid #2e6b4f' : '1px solid #d9d9d9',
                  borderRadius: '6px', cursor: d.isPast ? 'not-allowed' : 'pointer',
                  opacity: d.isPast ? 0.45 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  '&:hover:not(:disabled)': { borderColor: '#2e6b4f', background: '#f0f7f3' },
                }}
              >
                <Typography sx={{ fontSize: '.65rem', color: d.isSelected ? '#2e6b4f' : '#777', textTransform: 'uppercase' }}>
                  {d.abbr}
                </Typography>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: d.isSelected ? '#2e6b4f' : 'inherit', lineHeight: 1 }}>
                  {d.num}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Slot area */}
          {selectedDate ? (
            <>
              {tlLoadingCurrent && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={36} />
                </Box>
              )}
              {slotError && !tlLoadingCurrent && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                  <Alert severity="error">{slotError}</Alert>
                  <Button variant="outlined" startIcon={<Refresh />} onClick={() => {
                    if (selectedDate) { const k = dateKey(selectedDate); slotsCache.current.delete(k); loadDay(k, true); }
                  }}>{t('common.retry')}</Button>
                </Box>
              )}
              {!tlLoadingCurrent && !slotError && (
                <>
                  {/* Hour buttons */}
                  <Box sx={{ overflowX: 'auto', mb: 1, scrollbarWidth: 'thin' }}>
                    <Box sx={{ display: 'flex', gap: '4px', minWidth: 'max-content', py: '4px' }} role="group">
                      {hourCells.map(cell => (
                        <Box
                          component="button"
                          key={cell.hour}
                          className="hour-btn"
                          data-hour={cell.hour}
                          disabled={cell.state === 'occupied' || cell.state === 'past'}
                          aria-pressed={cell.state === 'sel' || cell.state === 'sel-start'}
                          onClick={() => onHourTap(cell)}
                          sx={{
                            minWidth: 54, height: 50, borderRadius: '4px', border: '1px solid',
                            fontSize: '.9rem', fontWeight: 500, cursor: 'pointer',
                            transition: 'background .12s, border-color .12s, color .12s',
                            ...(cell.state === 'occupied' && { background: '#e53935', borderColor: '#c62828', color: 'white', cursor: 'not-allowed' }),
                            ...(cell.state === 'past' && { background: '#ebebeb', color: '#bbb', borderColor: '#ddd', cursor: 'not-allowed' }),
                            ...(cell.state === 'sel' && { background: '#2e6b4f', borderColor: '#1e4f37', color: 'white' }),
                            ...(cell.state === 'sel-start' && { background: '#2e6b4f', borderColor: '#1a3d2b', color: 'white', boxShadow: '0 0 0 2.5px white, 0 0 0 4px #2e6b4f' }),
                            ...(cell.state === 'free' && { background: '#f4f4f4', borderColor: '#ddd', color: '#333', '&:hover': { borderColor: '#2e6b4f', background: '#e8f3ed' } }),
                          }}
                        >
                          {cell.hour}
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Legend */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px', mb: 1.5 }}>
                    {[
                      { color: '#2e6b4f', filled: true, label: t('reservation.legendSelected') },
                      { color: '#e53935', filled: true, label: t('reservation.legendOccupied') },
                      { color: '#aaa', filled: false, label: t('reservation.free') },
                      { color: '#ccc', filled: false, label: t('reservation.legendPast') },
                    ].map(leg => (
                      <Typography key={leg.label} sx={{ fontSize: '.78rem', color: leg.color }}>
                        {leg.filled ? '●' : '○'} {leg.label}
                      </Typography>
                    ))}
                  </Box>

                  {/* Duration chips */}
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', mb: 1.5 }}>
                    <Typography sx={{ fontSize: '.85rem', color: '#555', mr: '2px' }}>{t('reservation.duration')}</Typography>
                    {DURATIONS.map(n => (
                      <Box
                        component="button"
                        key={n}
                        className="dur-chip"
                        disabled={startHour === null}
                        onClick={() => setDuration(n)}
                        sx={{
                          padding: '5px 14px', borderRadius: '16px', fontSize: '.85rem', cursor: 'pointer',
                          background: isDurActive(n) ? '#2e6b4f' : 'white',
                          border: '1px solid', borderColor: isDurActive(n) ? '#2e6b4f' : '#bbb',
                          color: isDurActive(n) ? 'white' : '#333',
                          fontWeight: isDurActive(n) ? 600 : 400,
                          '&:disabled': { opacity: .45, cursor: 'not-allowed' },
                          '&:hover:not(:disabled)': { borderColor: '#2e6b4f', background: isDurActive(n) ? '#1e4f37' : '#f0f7f3' },
                        }}
                      >
                        {n} ч
                      </Box>
                    ))}
                    <Box
                      component="button"
                      className="dur-chip"
                      onClick={setWholeEvening}
                      sx={{
                        padding: '5px 14px', borderRadius: '16px', fontSize: '.85rem', cursor: 'pointer',
                        background: isEveningActive() ? '#2e6b4f' : 'white',
                        border: '1px solid', borderColor: isEveningActive() ? '#2e6b4f' : '#bbb',
                        color: isEveningActive() ? 'white' : '#333',
                        fontWeight: isEveningActive() ? 600 : 400,
                        '&:hover': { borderColor: '#2e6b4f', background: isEveningActive() ? '#1e4f37' : '#f0f7f3' },
                      }}
                    >
                      {t('reservation.wholeEvening')}
                    </Box>
                  </Box>

                  {/* Summary pill + book */}
                  {bookSummary ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                      <Box className="summary-pill" sx={{
                        display: 'inline-flex', alignItems: 'center',
                        background: '#e8f3ed', color: '#2e6b4f', border: '1px solid #b2d4bf',
                        borderRadius: '20px', px: 2, py: '6px', fontSize: '.875rem', fontWeight: 500,
                      }}>
                        {bookSummary}
                      </Box>
                      <Button
                        className="book-btn"
                        variant="contained"
                        disabled={tlBooking}
                        onClick={book}
                        sx={{ background: '#2e6b4f', '&:hover': { background: '#1e4f37' }, '&:disabled': { opacity: .6 } }}
                      >
                        {t('reservation.book')}
                      </Button>
                    </Box>
                  ) : (
                    <Typography sx={{ color: '#777', fontSize: '.875rem', mt: 1 }}>
                      {startHour !== null ? t('reservation.hintSelectEnd') : t('reservation.hintSelectStart')}
                    </Typography>
                  )}
                  {bookError && <Typography sx={{ color: '#c62828', fontSize: '.875rem', mt: 0.5 }}>{bookError}</Typography>}
                </>
              )}
            </>
          ) : (
            <Typography sx={{ color: '#777', fontSize: '.875rem', mt: 1 }}>{t('reservation.hintSelectDate')}</Typography>
          )}

          {/* Upcoming reservations */}
          {upcoming.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontSize: '.9rem', color: '#2e6b4f', mb: 1, fontWeight: 400 }}>
                {t('reservation.upcomingTitle')}
              </Typography>
              {upcoming.map(r => (
                <Box key={r.sortKey} sx={{ display: 'flex', gap: 1.5, py: '10px', borderBottom: '1px solid #eee', fontSize: '.875rem' }}>
                  <Typography sx={{ fontWeight: 600, minWidth: 38 }}>{r.label}</Typography>
                  <Typography sx={{
                    background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '4px',
                    px: 1, fontSize: '.8rem', color: '#444', whiteSpace: 'nowrap',
                  }}>
                    {r.range}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {upcoming.length === 0 && selectedDate && !tlLoadingCurrent && (
            <Typography sx={{ color: '#2e6b4f', fontSize: '.875rem', mt: 2 }}>
              {t('reservation.upcomingEmpty')}
            </Typography>
          )}
        </>
      )}

      <Snackbar
        open={!!feedback}
        autoHideDuration={4000}
        onClose={() => setFeedback(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={feedback?.severity} onClose={() => setFeedback(undefined)}>
          {feedback?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ── SlotCard sub-component (cards mode) ──────────────────────────────────────
function stateColor(state: SlotState): 'success' | 'primary' | 'default' {
  return state === 'free' ? 'success' : state === 'taken-mine' ? 'primary' : 'default';
}

function SlotCard({ slot, onClaim, loading, t }: {
  slot: Slot;
  onClaim: (key: string) => void;
  loading: boolean;
  t: TFunction;
}) {
  const stateLabel = (state: SlotState): string =>
    state === 'free' ? t('reservation.free') : state === 'taken-mine' ? t('reservation.yours') : t('reservation.taken');

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: 4,
        borderLeftColor: slot.state === 'free' ? 'success.main' : slot.state === 'taken-mine' ? 'primary.main' : 'grey.400',
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: '12px !important' }}>
        <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
          {slot.slotKey}
        </Typography>
        <Chip label={stateLabel(slot.state)} color={stateColor(slot.state)} size="small" />
        {slot.state === 'free' && (
          <Button
            variant="contained"
            size="small"
            disabled={loading}
            onClick={() => onClaim(slot.slotKey)}
            sx={{ mt: 0.5 }}
          >
            {loading ? t('reservation.claiming') : t('reservation.claim')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
