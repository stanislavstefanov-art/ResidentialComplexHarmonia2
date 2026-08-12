import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getPeriodSummary } from '../../api/financial';
import { getMyCharges } from '../../api/maintenanceFees';
import { getMyPayments, getBalance } from '../../api/payments';
import { ChargeDto, PaymentDto, BalanceDto, PeriodSummaryDto } from '../../types';
import { formatEur, currentMonth } from './util';

function SectionDivider({ label }: { label: string }) {
  return (
    <Divider sx={{ my: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
        {label}
      </Typography>
    </Divider>
  );
}

export default function ResidentFinancial() {
  const { t } = useTranslation();

  // ── Period summary ──────────────────────────────────────────────────────────
  const [period, setPeriod]       = useState(currentMonth());
  const [summary, setSummary]     = useState<PeriodSummaryDto | null>(null);
  const [sumLoading, setSumLoad]  = useState(true);
  const [sumError, setSumError]   = useState('');

  const loadSummary = useCallback(async () => {
    setSumLoad(true); setSumError('');
    try { setSummary(await getPeriodSummary(period)); }
    catch { setSumError(t('finance.errLoad')); }
    finally { setSumLoad(false); }
  }, [period, t]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ── Maintenance fees (resident) ─────────────────────────────────────────────
  const [charges, setCharges]   = useState<ChargeDto[]>([]);
  const [feesLoad, setFeesLoad] = useState(true);
  const [feesErr, setFeesErr]   = useState('');

  const loadFees = useCallback(async () => {
    setFeesLoad(true); setFeesErr('');
    try { setCharges(await getMyCharges()); }
    catch { setFeesErr(t('fees.errLoad')); }
    finally { setFeesLoad(false); }
  }, [t]);

  useEffect(() => { loadFees(); }, [loadFees]);

  // ── Payments (resident) ─────────────────────────────────────────────────────
  const [payments, setPayments]   = useState<PaymentDto[]>([]);
  const [balance, setBalance]     = useState<BalanceDto | null>(null);
  const [payLoad, setPayLoad]     = useState(true);
  const [payErr, setPayErr]       = useState('');
  const [showPayDlg, setShowPayDlg] = useState(false);

  const loadPayments = useCallback(async () => {
    setPayLoad(true); setPayErr('');
    try { setPayments(await getMyPayments()); }
    catch { setPayErr(t('payments.errLoad')); }
    finally { setPayLoad(false); }
  }, [t]);

  const loadBalance = useCallback(async () => {
    try { setBalance(await getBalance()); } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { loadPayments(); loadBalance(); }, [loadPayments, loadBalance]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Period summary ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{t('finance.periodLabel')}</Typography>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
        />
        {sumLoading && <CircularProgress size={18} />}
        {sumError && <Alert severity="error" sx={{ py: 0 }}>{sumError}</Alert>}
      </Box>

      {summary && (
        <Card variant="outlined">
          <CardContent sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', py: '12px !important' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('finance.totalCharges')}</Typography>
              <Typography data-testid="summary-charges" variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatEur(summary.totalChargesEur)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('finance.totalExpenses')}</Typography>
              <Typography data-testid="summary-expenses" variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatEur(summary.totalExpensesEur)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Maintenance fees ── */}
      <SectionDivider label={t('nav.fees')} />

      {feesLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : feesErr ? (
        <Alert severity="error">{feesErr}</Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('fees.chargedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('fees.none')}</TableCell></TableRow>
              ) : charges.map(c => (
                <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                  <TableCell>{c.period}</TableCell>
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                  <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Balance ── */}
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
                    <TableCell align="right">{t('payments.charged')}</TableCell>
                    <TableCell align="right">{t('payments.paid')}</TableCell>
                    <TableCell align="right">{t('payments.balance')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balance.lines.map(l => (
                    <TableRow key={l.householdRef} data-testid={`balance-row-${l.householdRef}`}>
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

      {/* ── Payments table ── */}
      {payLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : payErr ? (
        <Alert severity="error">{payErr}</Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('payments.dateReceived')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('payments.none')}</TableCell></TableRow>
              ) : payments.map(p => (
                <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                  <TableCell>{p.period}</TableCell>
                  <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
                  <TableCell>{p.dateReceived}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Request payment ── */}
      <Button data-testid="pay-btn" variant="contained" onClick={() => setShowPayDlg(true)} sx={{ alignSelf: 'flex-start' }}>
        {t('finance.requestPayment')}
      </Button>
      <Dialog open={showPayDlg} onClose={() => setShowPayDlg(false)}>
        <DialogTitle>{t('finance.requestPayment')}</DialogTitle>
        <DialogContent>
          <Box data-testid="pay-dialog">
            <Typography>{t('finance.requestInfo')}</Typography>
            <Typography sx={{ mt: 1 }}>{t('finance.contactOffice')}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPayDlg(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
