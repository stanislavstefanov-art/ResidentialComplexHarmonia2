import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getMyPayments, getAllPayments, recordPayment, getBalance } from '../api/payments';
import { PaymentDto, BalanceDto } from '../types';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface Props {
  role: 'resident' | 'admin';
}

export default function PaymentsScreen({ role }: Props) {
  const { t } = useTranslation();
  const [payments, setPayments]         = useState<PaymentDto[]>([]);
  const [balance, setBalance]           = useState<BalanceDto | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]   = useState<string>('');
  const [submitting, setSubmitting]     = useState(false);

  const [householdRef, setHouseholdRef] = useState('');
  const [amount, setAmount]             = useState('');
  const [period, setPeriod]             = useState(currentMonth());
  const [dateReceived, setDateReceived] = useState(today());

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayments(role === 'admin' ? await getAllPayments() : await getMyPayments());
    } catch {
      setError(t('payments.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [role, t]);

  const loadBalance = useCallback(async () => {
    try { setBalance(await getBalance()); } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    loadPayments();
    loadBalance();
  }, [loadPayments, loadBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError('');
    const parsed = parseFloat(amount);
    if (!householdRef || !amount || isNaN(parsed) || parsed <= 0) {
      setSubmitError(t('payments.errInput'));
      return;
    }
    setSubmitting(true);
    try {
      await recordPayment({
        householdRef,
        amountEur: parsed,
        period,
        dateReceived,
        idempotencyKey: crypto.randomUUID(),
      });
      setSubmitSuccess(true);
      setHouseholdRef('');
      setAmount('');
      setPeriod(currentMonth());
      setDateReceived(today());
      await loadPayments();
      await loadBalance();
    } catch {
      setSubmitError(t('payments.errRecord'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {role === 'admin' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('payments.record')}</Typography>
            <Box
              component="form"
              data-testid="record-form"
              onSubmit={handleSubmit}
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
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
                label={t('payments.amountEuro')}
                slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'aria-label': 'Amount (€)' } }}
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                size="small"
              />
              <TextField
                label={t('payments.periodYm')}
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                required
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={t('payments.dateReceived')}
                type="date"
                value={dateReceived}
                onChange={e => setDateReceived(e.target.value)}
                required
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button data-testid="submit-btn" type="submit" variant="contained" disabled={submitting}>
                  {t('payments.record')}
                </Button>
                {submitSuccess && <Alert data-testid="submit-success" severity="success">{t('payments.recorded')}</Alert>}
                {submitError  && <Alert data-testid="submit-error"   severity="error">{submitError}</Alert>}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {balance && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Balance — {balance.label}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {role === 'admin' && <TableCell>{t('common.household')}</TableCell>}
                  <TableCell align="right">{t('payments.charged')}</TableCell>
                  <TableCell align="right">{t('payments.paid')}</TableCell>
                  <TableCell align="right">{t('payments.balance')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {balance.lines.map(l => (
                  <TableRow key={l.householdRef} data-testid={`balance-row-${l.householdRef}`}>
                    {role === 'admin' && <TableCell>{l.householdRef}</TableCell>}
                    <TableCell align="right">{formatEur(l.totalCharged)}</TableCell>
                    <TableCell align="right">{formatEur(l.totalPaid)}</TableCell>
                    <TableCell align="right" sx={{ color: l.balance > 0 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                      {formatEur(l.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {t(role === 'admin' ? 'payments.allPayments' : 'payments.myPayments')}
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <Alert severity="error">{error}</Alert>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadPayments}>{t('common.retry')}</Button>
          </Box>
        )}

        {!loading && !error && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                {role === 'admin' && <TableCell>{t('common.household')}</TableCell>}
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('payments.dateReceived')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={role === 'admin' ? 4 : 3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    No payments on record.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map(p => (
                  <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                    <TableCell>{p.period}</TableCell>
                    {role === 'admin' && <TableCell>{p.householdRef}</TableCell>}
                    <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
                    <TableCell>{p.dateReceived}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
