import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Snackbar, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
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
  const { t } = useTranslation();
  const [day, setDay] = useState(todayString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [claimInFlight, setClaimInFlight] = useState<string>('');
  const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);

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

  useEffect(() => { loadSlots(); }, [loadSlots]);

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

  return (
    <Box>
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

function stateColor(state: SlotState): 'success' | 'primary' | 'default' {
  return state === 'free' ? 'success' : state === 'taken-mine' ? 'primary' : 'default';
}

function SlotCard({ slot, onClaim, loading, t }: {
  slot: Slot;
  onClaim: (key: string) => void;
  loading: boolean;
  t: TFunction;
}) {
  const stateLabel = (state: SlotState): string => {
    return state === 'free' ? t('reservation.free') : state === 'taken-mine' ? t('reservation.yours') : t('reservation.taken');
  };

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
            {loading ? t('reservation.claiming') : t('reservation.claim')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
