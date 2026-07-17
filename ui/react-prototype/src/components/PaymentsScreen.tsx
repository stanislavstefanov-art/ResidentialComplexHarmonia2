import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
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
  const [payments, setPayments]         = useState<PaymentDto[]>([]);
  const [balance, setBalance]           = useState<BalanceDto | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);

  const [householdRef, setHouseholdRef] = useState('');
  const [amount, setAmount]             = useState('');
  const [period, setPeriod]             = useState(currentMonth());
  const [dateReceived, setDateReceived] = useState(today());

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(role === 'admin' ? await getAllPayments() : await getMyPayments());
    } catch {
      setError('Could not load payments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [role]);

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
    setSubmitError(null);
    const parsed = parseFloat(amount);
    if (!householdRef || !amount || isNaN(parsed) || parsed <= 0) {
      setSubmitError('Enter a valid household ref and amount greater than zero.');
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
      setSubmitError('Could not record payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {role === 'admin' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Record Payment</Typography>
            <Box
              component="form"
              data-testid="record-form"
              onSubmit={handleSubmit}
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
            >
              <TextField
                label="Household Ref"
                slotProps={{ htmlInput: { 'aria-label': 'Household Ref' } }}
                value={householdRef}
                onChange={e => setHouseholdRef(e.target.value)}
                required
                size="small"
                placeholder="e.g. H001"
              />
              <TextField
                label="Amount (€)"
                slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'aria-label': 'Amount (€)' } }}
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                size="small"
              />
              <TextField
                label="Period (YYYY-MM)"
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                required
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Date received"
                type="date"
                value={dateReceived}
                onChange={e => setDateReceived(e.target.value)}
                required
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button data-testid="submit-btn" type="submit" variant="contained" disabled={submitting}>
                  Record Payment
                </Button>
                {submitSuccess && <Alert data-testid="submit-success" severity="success">Payment recorded.</Alert>}
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
                  {role === 'admin' && <TableCell>Household</TableCell>}
                  <TableCell align="right">Charged</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Balance</TableCell>
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
          {role === 'admin' ? 'All Payments' : 'My Payments'}
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <Alert severity="error">{error}</Alert>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadPayments}>Retry</Button>
          </Box>
        )}

        {!loading && !error && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                {role === 'admin' && <TableCell>Household</TableCell>}
                <TableCell align="right">Amount</TableCell>
                <TableCell>Date received</TableCell>
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
