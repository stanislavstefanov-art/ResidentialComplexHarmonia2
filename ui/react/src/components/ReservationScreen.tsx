import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Snackbar, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getSlots, claimSlot } from '../api/reservations';
import { Slot, SlotState } from '../types';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Feedback {
  msg: string;
  severity: 'success' | 'warning' | 'error';
}

export default function ReservationScreen() {
  const [day, setDay] = useState(todayString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimInFlight, setClaimInFlight] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getSlots(day);
      setSlots(r.slots);
    } catch {
      setError('Could not load slots. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleClaim = async (slotKey: string) => {
    setClaimInFlight(slotKey);
    try {
      const r = await claimSlot(day, slotKey);
      if (r.outcome === 'confirmed-yours') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-mine' as SlotState } : s));
        setFeedback({ msg: `Slot "${slotKey}" confirmed — it's yours!`, severity: 'success' });
      } else if (r.outcome === 'refused-already-taken') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' as SlotState } : s));
        setFeedback({ msg: 'Slot already taken by someone else.', severity: 'warning' });
      } else {
        setFeedback({ msg: 'Could not confirm booking. Please try again.', severity: 'error' });
      }
    } catch {
      setFeedback({ msg: 'Network error. Please try again.', severity: 'error' });
    } finally {
      setClaimInFlight(null);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Select date:</Typography>
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
            Retry
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
            />
          ))}
          {slots.length === 0 && (
            <Typography color="text.secondary" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
              No slots available for this day.
            </Typography>
          )}
        </Box>
      )}

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={feedback?.severity} onClose={() => setFeedback(null)}>
          {feedback?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function stateColor(state: SlotState): 'success' | 'primary' | 'default' {
  return state === 'free' ? 'success' : state === 'taken-mine' ? 'primary' : 'default';
}

function stateLabel(state: SlotState): string {
  return state === 'free' ? 'Free' : state === 'taken-mine' ? 'Yours' : 'Taken';
}

function SlotCard({ slot, onClaim, loading }: {
  slot: Slot;
  onClaim: (key: string) => void;
  loading: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: 4,
        borderLeftColor: slot.state === 'free'
          ? 'success.main'
          : slot.state === 'taken-mine'
          ? 'primary.main'
          : 'grey.400',
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
            {loading ? 'Claiming…' : 'Claim'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
