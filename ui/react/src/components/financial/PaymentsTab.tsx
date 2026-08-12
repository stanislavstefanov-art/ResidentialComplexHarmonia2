import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getAllPayments, recordPayment, getBalance } from '../../api/payments';
import { PaymentDto, BalanceDto } from '../../types';
import { formatEur, currentMonth, today } from './util';

function SectionDivider({ label }: { label: string }) {
  return (
    <Divider sx={{ my: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
        {label}
      </Typography>
    </Divider>
  );
}

export default function PaymentsTab() {
  const { t } = useTranslation();

  const [payments, setPayments]     = useState<PaymentDto[]>([]);
  const [balance, setBalance]       = useState<BalanceDto | null>(null);
  const [payLoad, setPayLoad]       = useState(true);
  const [payErr, setPayErr]         = useState('');
  const [payRef, setPayRef]         = useState('');
  const [payAmt, setPayAmt]         = useState('');
  const [payPer, setPayPer]         = useState(currentMonth());
  const [payDate, setPayDate]       = useState(today());
  const [paySaving, setPaySaving]   = useState(false);
  const [payOk, setPayOk]           = useState(false);
  const [payFormErr, setPayFormErr] = useState('');

  const loadPayments = useCallback(async () => {
    setPayLoad(true); setPayErr('');
    try { setPayments(await getAllPayments()); }
    catch { setPayErr(t('payments.errLoad')); }
    finally { setPayLoad(false); }
  }, [t]);

  const loadBalance = useCallback(async () => {
    try { setBalance(await getBalance()); } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { loadPayments(); loadBalance(); }, [loadPayments, loadBalance]);

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setPayOk(false); setPayFormErr('');
    const parsed = parseFloat(payAmt);
    if (!payRef || !payAmt || isNaN(parsed) || parsed <= 0) { setPayFormErr(t('payments.errInput')); return; }
    setPaySaving(true);
    try {
      await recordPayment({ householdRef: payRef, amountEur: parsed, period: payPer, dateReceived: payDate, idempotencyKey: crypto.randomUUID() });
      setPayOk(true); setPayRef(''); setPayAmt(''); setPayPer(currentMonth()); setPayDate(today());
      await loadPayments(); await loadBalance();
    } catch { setPayFormErr(t('payments.errRecord')); }
    finally { setPaySaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SectionDivider label={t('nav.payments')} />

      {balance && (
        <Card variant="outlined">
          <CardContent sx={{ py: '12px !important' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('payments.balanceLabel', { label: balance.label })}
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.household')}</TableCell>
                    <TableCell align="right">{t('payments.charged')}</TableCell>
                    <TableCell align="right">{t('payments.paid')}</TableCell>
                    <TableCell align="right">{t('payments.balance')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balance.lines.map(l => (
                    <TableRow key={l.householdRef} data-testid={`balance-row-${l.householdRef}`}>
                      <TableCell>{l.householdRef}</TableCell>
                      <TableCell align="right">{formatEur(l.totalCharged)}</TableCell>
                      <TableCell align="right">{formatEur(l.totalPaid)}</TableCell>
                      <TableCell align="right" sx={{ color: l.balance > 0 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                        {formatEur(l.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{t('payments.record')}</Typography>
          <Box component="form" data-testid="payment-form" onSubmit={handlePaySubmit} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label={t('common.householdRef')} value={payRef} onChange={e => setPayRef(e.target.value)} required size="small" placeholder="e.g. H001" slotProps={{ htmlInput: { 'aria-label': t('common.householdRef') } }} />
            <TextField label={t('payments.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'aria-label': t('payments.amountEuro') } }} value={payAmt} onChange={e => setPayAmt(e.target.value)} required size="small" />
            <TextField label={t('payments.periodYm')} type="month" value={payPer} onChange={e => setPayPer(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={t('payments.dateReceived')} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button data-testid="payment-submit-btn" type="submit" variant="contained" disabled={paySaving} size="small" sx={{ alignSelf: 'flex-start' }}>{t('payments.record')}</Button>
              {payOk && <Alert data-testid="payment-submit-success" severity="success" sx={{ py: 0 }}>{t('payments.recorded')}</Alert>}
              {payFormErr && <Alert data-testid="payment-submit-error" severity="error" sx={{ py: 0 }}>{payFormErr}</Alert>}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {payLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : payErr ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Alert severity="error">{payErr}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadPayments} size="small">{t('common.retry')}</Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                <TableCell>{t('common.household')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('payments.dateReceived')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('payments.none')}</TableCell></TableRow>
              ) : payments.map(p => (
                <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                  <TableCell>{p.period}</TableCell>
                  <TableCell>{p.householdRef}</TableCell>
                  <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
                  <TableCell>{p.dateReceived}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
