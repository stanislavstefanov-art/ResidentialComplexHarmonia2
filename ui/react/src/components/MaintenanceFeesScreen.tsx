import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getMyCharges, getAllCharges, recordCharge } from '../api/maintenanceFees';
import { ChargeDto } from '../types';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface Props {
  role: 'resident' | 'admin';
}

export default function MaintenanceFeesScreen({ role }: Props) {
  const { t } = useTranslation();
  const [charges, setCharges]           = useState<ChargeDto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]   = useState<string>('');
  const [submitting, setSubmitting]     = useState(false);

  const [householdRef, setHouseholdRef] = useState('');
  const [amount, setAmount]             = useState('');
  const [description, setDesc]          = useState('');
  const [period, setPeriod]             = useState(currentMonth());

  const loadCharges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCharges(role === 'admin' ? await getAllCharges() : await getMyCharges());
    } catch {
      setError(t('fees.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [role, t]);

  useEffect(() => { loadCharges(); }, [loadCharges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError('');
    const parsed = parseFloat(amount);
    if (!householdRef || !amount || isNaN(parsed) || parsed <= 0) {
      setSubmitError(t('fees.errInput'));
      return;
    }
    setSubmitting(true);
    try {
      await recordCharge(householdRef, {
        amountEur: parsed,
        description,
        period,
        idempotencyKey: crypto.randomUUID(),
      });
      setSubmitSuccess(true);
      setHouseholdRef('');
      setAmount('');
      setDesc('');
      setPeriod(currentMonth());
      await loadCharges();
    } catch {
      setSubmitError(t('fees.errRecord'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {role === 'admin' && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('fees.record')}</Typography>
            <Box
              component="form"
              data-testid="record-form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label={t('common.householdRef')}
                slotProps={{ htmlInput: { 'aria-label': 'Household Ref' } }}
                value={householdRef}
                onChange={e => setHouseholdRef(e.target.value)}
                required
                size="small"
                placeholder="e.g. H001"
              />
              <TextField
                label={t('fees.amountEuro')}
                slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'aria-label': 'Amount (€)' } }}
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                size="small"
              />
              <TextField
                label={t('common.description')}
                value={description}
                onChange={e => setDesc(e.target.value)}
                size="small"
              />
              <TextField
                label={t('fees.periodYm')}
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                required
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button
                data-testid="submit-btn"
                type="submit"
                variant="contained"
                disabled={submitting}
              >
                {t('fees.record')}
              </Button>
              {submitSuccess && (
                <Alert data-testid="submit-success" severity="success">{t('fees.recorded')}</Alert>
              )}
              {submitError && (
                <Alert data-testid="submit-error" severity="error">{submitError}</Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {t(role === 'admin' ? 'fees.allCharges' : 'fees.myCharges')}
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadCharges}>{t('common.retry')}</Button>
        </Box>
      )}

      {!loading && !error && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.period')}</TableCell>
              {role === 'admin' && <TableCell>{t('common.household')}</TableCell>}
              <TableCell>{t('common.description')}</TableCell>
              <TableCell align="right">{t('common.amount')}</TableCell>
              <TableCell>{t('fees.chargedAt')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {charges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={role === 'admin' ? 5 : 4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  No charges on record.
                </TableCell>
              </TableRow>
            ) : (
              charges.map(c => (
                <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                  <TableCell>{c.period}</TableCell>
                  {role === 'admin' && <TableCell>{c.householdRef}</TableCell>}
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                  <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
