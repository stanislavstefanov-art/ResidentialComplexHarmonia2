import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Select, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getPeriodSummary } from '../api/financial';
import { getMyCharges, getAllCharges, recordCharge } from '../api/maintenanceFees';
import { getExpenses, recordExpense, recordIncome, getAnnualReport, downloadAnnualReportXlsx, scanInvoice } from '../api/expenses';
import { getMyPayments, getAllPayments, recordPayment, getBalance } from '../api/payments';
import { ChargeDto, PaymentDto, BalanceDto, ExpenseDto, PeriodSummaryDto, EXPENSE_CATEGORIES, PARENT_CATEGORIES, AnnualReportDto } from '../types';

function formatEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
function currentMonth() { return new Date().toISOString().slice(0, 7); }
function today() { return new Date().toISOString().slice(0, 10); }

interface Props { role: 'resident' | 'admin'; }

export default function FinancialScreen({ role }: Props) {
  const { t } = useTranslation();
  const isAdmin = role === 'admin';

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

  // ── Maintenance fees ────────────────────────────────────────────────────────
  const [charges, setCharges]       = useState<ChargeDto[]>([]);
  const [feesLoad, setFeesLoad]     = useState(true);
  const [feesErr, setFeesErr]       = useState('');
  const [feeRef, setFeeRef]         = useState('');
  const [feeAmt, setFeeAmt]         = useState('');
  const [feeDesc, setFeeDesc]       = useState('');
  const [feePer, setFeePer]         = useState(currentMonth());
  const [feeSaving, setFeeSaving]   = useState(false);
  const [feeOk, setFeeOk]           = useState(false);
  const [feeFormErr, setFeeFormErr] = useState('');

  const loadFees = useCallback(async () => {
    setFeesLoad(true); setFeesErr('');
    try { setCharges(isAdmin ? await getAllCharges() : await getMyCharges()); }
    catch { setFeesErr(t('fees.errLoad')); }
    finally { setFeesLoad(false); }
  }, [isAdmin, t]);

  useEffect(() => { loadFees(); }, [loadFees]);

  const handleFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFeeOk(false); setFeeFormErr('');
    const parsed = parseFloat(feeAmt);
    if (!feeRef || !feeAmt || isNaN(parsed) || parsed <= 0) { setFeeFormErr(t('fees.errInput')); return; }
    setFeeSaving(true);
    try {
      await recordCharge(feeRef, { amountEur: parsed, description: feeDesc, period: feePer, idempotencyKey: crypto.randomUUID() });
      setFeeOk(true); setFeeRef(''); setFeeAmt(''); setFeeDesc(''); setFeePer(currentMonth());
      await loadFees();
    } catch { setFeeFormErr(t('fees.errRecord')); }
    finally { setFeeSaving(false); }
  };

  // ── Building expenses ───────────────────────────────────────────────────────
  const [expenses, setExpenses]     = useState<ExpenseDto[]>([]);
  const [expLoad, setExpLoad]       = useState(true);
  const [expErr, setExpErr]         = useState('');
  const [expAmt, setExpAmt]           = useState('');
  const [expDesc, setExpDesc]         = useState('');
  const [expCat, setExpCat]           = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expParent, setExpParent]     = useState<string>(PARENT_CATEGORIES[3]); // 'Other'
  const [expDate, setExpDate]         = useState(today());
  const [expSaving, setExpSaving]     = useState(false);
  const [expOk, setExpOk]             = useState(false);
  const [expFormErr, setExpFormErr]   = useState('');

  // ── Annual report ───────────────────────────────────────────────────────────
  const [reportYear, setReportYear]   = useState(new Date().getFullYear());
  const [report, setReport]           = useState<AnnualReportDto | null>(null);
  const [repLoad, setRepLoad]         = useState(false);
  const [repErr, setRepErr]           = useState('');
  const [xlsxLoad, setXlsxLoad]       = useState(false);
  const [incCategory, setIncCategory] = useState('');
  const [incDesc, setIncDesc]         = useState('');
  const [incAmt, setIncAmt]           = useState('');
  const [incDate, setIncDate]         = useState(today());
  const [incSaving, setIncSaving]     = useState(false);
  const [incOk, setIncOk]             = useState(false);
  const [incFormErr, setIncFormErr]   = useState('');

  const loadExpenses = useCallback(async () => {
    setExpLoad(true); setExpErr('');
    try { setExpenses(await getExpenses()); }
    catch { setExpErr(t('expenses.errLoad')); }
    finally { setExpLoad(false); }
  }, [t]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleExpSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setExpOk(false); setExpFormErr('');
    const parsed = parseFloat(expAmt);
    if (!expAmt || isNaN(parsed) || parsed <= 0) { setExpFormErr(t('expenses.errAmount')); return; }
    setExpSaving(true);
    try {
      await recordExpense({ amountEur: parsed, description: expDesc, category: expCat, parentCategory: expParent, expenseDate: expDate, idempotencyKey: crypto.randomUUID() });
      setExpOk(true); setExpAmt(''); setExpDesc(''); setExpCat(EXPENSE_CATEGORIES[0]); setExpParent(PARENT_CATEGORIES[3]); setExpDate(today());
      await loadExpenses();
    } catch { setExpFormErr(t('expenses.errRecord')); }
    finally { setExpSaving(false); }
  };

  const loadReport = useCallback(async () => {
    setRepLoad(true); setRepErr('');
    try { setReport(await getAnnualReport(reportYear)); }
    catch { setRepErr(t('annualReport.errLoad')); }
    finally { setRepLoad(false); }
  }, [reportYear, t]);

  const handleDownloadXlsx = useCallback(async () => {
    setXlsxLoad(true);
    try { await downloadAnnualReportXlsx(reportYear); }
    catch { setRepErr(t('annualReport.errLoad')); }
    finally { setXlsxLoad(false); }
  }, [reportYear, t]);

  const handleIncSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIncOk(false); setIncFormErr('');
    const parsed = parseFloat(incAmt);
    if (!incCategory || !incAmt || isNaN(parsed) || parsed <= 0) { setIncFormErr(t('annualReport.errAmount')); return; }
    setIncSaving(true);
    try {
      await recordIncome({ category: incCategory, description: incDesc, amountEur: parsed, incomeDate: incDate, idempotencyKey: crypto.randomUUID() });
      setIncOk(true); setIncCategory(''); setIncDesc(''); setIncAmt(''); setIncDate(today());
      if (report) await loadReport();
    } catch { setIncFormErr(t('annualReport.errRecord')); }
    finally { setIncSaving(false); }
  };

  // ── Payments ────────────────────────────────────────────────────────────────
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
  const [showPayDlg, setShowPayDlg] = useState(false);

  const loadPayments = useCallback(async () => {
    setPayLoad(true); setPayErr('');
    try { setPayments(isAdmin ? await getAllPayments() : await getMyPayments()); }
    catch { setPayErr(t('payments.errLoad')); }
    finally { setPayLoad(false); }
  }, [isAdmin, t]);

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

  // ── Invoice scan ────────────────────────────────────────────────────────────
  const [scanStep, setScanStep]       = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanErr, setScanErr]         = useState('');
  const [scanAmt, setScanAmt]         = useState('');
  const [scanDate, setScanDate]       = useState(today());
  const [scanDesc, setScanDesc]       = useState('');
  const [scanCat, setScanCat]         = useState<string>(EXPENSE_CATEGORIES[0]);
  const [scanParent, setScanParent]   = useState<string>(PARENT_CATEGORIES[3]);
  const [scanConf, setScanConf]       = useState(0);
  const [scanSaving, setScanSaving]   = useState(false);
  const [scanOk, setScanOk]           = useState(false);
  const [scanSaveErr, setScanSaveErr] = useState('');

  const handleInvoiceSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setScanErr(t('invoiceScan.errEmpty')); return; }
    setScanErr(''); setScanStep('scanning');
    try {
      const dto = await scanInvoice(file);
      setScanAmt(dto.amount != null ? String(dto.amount) : '');
      setScanDate(dto.date ?? today());
      setScanDesc(dto.vendor ?? '');
      setScanCat(EXPENSE_CATEGORIES[0]);
      setScanParent(PARENT_CATEGORIES[3]);
      setScanConf(dto.confidence);
      setScanStep('done');
    } catch {
      setScanErr(t('invoiceScan.errScan')); setScanStep('idle');
    }
  };

  const resetScan = () => {
    setScanStep('idle'); setScanErr(''); setScanOk(false); setScanSaveErr('');
    setScanAmt(''); setScanDate(today()); setScanDesc('');
    setScanCat(EXPENSE_CATEGORIES[0]); setScanParent(PARENT_CATEGORIES[3]);
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setScanOk(false); setScanSaveErr('');
    const parsed = parseFloat(scanAmt);
    if (isNaN(parsed) || parsed <= 0) { setScanSaveErr(t('expenses.errAmount')); return; }
    setScanSaving(true);
    try {
      await recordExpense({ amountEur: parsed, description: scanDesc, category: scanCat, parentCategory: scanParent, expenseDate: scanDate, idempotencyKey: crypto.randomUUID() });
      setScanOk(true); await loadExpenses();
    } catch { setScanSaveErr(t('invoiceScan.errSave')); }
    finally { setScanSaving(false); }
  };

  // ── Section divider helper ──────────────────────────────────────────────────
  const SectionDivider = ({ label }: { label: string }) => (
    <Divider sx={{ my: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
        {label}
      </Typography>
    </Divider>
  );

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

      {isAdmin && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{t('fees.record')}</Typography>
            <Box component="form" data-testid="fee-form" onSubmit={handleFeeSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField label={t('common.householdRef')} value={feeRef} onChange={e => setFeeRef(e.target.value)} required size="small" placeholder="e.g. H001" />
                <TextField label={t('fees.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01' } }} value={feeAmt} onChange={e => setFeeAmt(e.target.value)} required size="small" />
                <TextField label={t('common.description')} value={feeDesc} onChange={e => setFeeDesc(e.target.value)} size="small" />
                <TextField label={t('fees.periodYm')} type="month" value={feePer} onChange={e => setFeePer(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
              <Button data-testid="fee-submit-btn" type="submit" variant="contained" disabled={feeSaving} size="small" sx={{ alignSelf: 'flex-start' }}>{t('fees.record')}</Button>
              {feeOk && <Alert data-testid="fee-submit-success" severity="success" sx={{ py: 0 }}>{t('fees.recorded')}</Alert>}
              {feeFormErr && <Alert data-testid="fee-submit-error" severity="error" sx={{ py: 0 }}>{feeFormErr}</Alert>}
            </Box>
          </CardContent>
        </Card>
      )}

      {feesLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : feesErr ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Alert severity="error">{feesErr}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadFees} size="small">{t('common.retry')}</Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                {isAdmin && <TableCell>{t('common.household')}</TableCell>}
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('fees.chargedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 5 : 4} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('fees.none')}</TableCell></TableRow>
              ) : charges.map(c => (
                <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                  <TableCell>{c.period}</TableCell>
                  {isAdmin && <TableCell>{c.householdRef}</TableCell>}
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                  <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Building expenses ── */}
      <SectionDivider label={t('nav.expenses')} />

      {isAdmin && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{t('expenses.record')}</Typography>
            <Box component="form" data-testid="expense-form" onSubmit={handleExpSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField label={t('expenses.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01' } }} value={expAmt} onChange={e => setExpAmt(e.target.value)} required size="small" />
                <TextField label={t('common.description')} value={expDesc} onChange={e => setExpDesc(e.target.value)} required size="small" />
                <Select value={expCat} onChange={e => setExpCat(e.target.value)} size="small" displayEmpty>
                  {EXPENSE_CATEGORIES.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                </Select>
                <Select value={expParent} onChange={e => setExpParent(e.target.value)} size="small" displayEmpty>
                  {PARENT_CATEGORIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
                <TextField label={t('expenses.expenseDate')} type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
              <Button data-testid="expense-submit-btn" type="submit" variant="contained" disabled={expSaving} size="small" sx={{ alignSelf: 'flex-start' }}>{t('expenses.record')}</Button>
              {expOk && <Alert data-testid="expense-submit-success" severity="success" sx={{ py: 0 }}>{t('expenses.recorded')}</Alert>}
              {expFormErr && <Alert data-testid="expense-submit-error" severity="error" sx={{ py: 0 }}>{expFormErr}</Alert>}
            </Box>
          </CardContent>
        </Card>
      )}

      {expLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : expErr ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Alert severity="error">{expErr}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadExpenses} size="small">{t('common.retry')}</Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('expenses.category')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('expenses.none')}</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                  <TableCell>{e.expenseDate}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right">{formatEur(e.amountEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Payments ── */}
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
                    {isAdmin && <TableCell>{t('common.household')}</TableCell>}
                    <TableCell align="right">{t('payments.charged')}</TableCell>
                    <TableCell align="right">{t('payments.paid')}</TableCell>
                    <TableCell align="right">{t('payments.balance')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balance.lines.map(l => (
                    <TableRow key={l.householdRef} data-testid={`balance-row-${l.householdRef}`}>
                      {isAdmin && <TableCell>{l.householdRef}</TableCell>}
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

      {isAdmin && (
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
      )}

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
                {isAdmin && <TableCell>{t('common.household')}</TableCell>}
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('payments.dateReceived')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 4 : 3} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('payments.none')}</TableCell></TableRow>
              ) : payments.map(p => (
                <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                  <TableCell>{p.period}</TableCell>
                  {isAdmin && <TableCell>{p.householdRef}</TableCell>}
                  <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
                  <TableCell>{p.dateReceived}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {!isAdmin && (
        <>
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
        </>
      )}

      {/* ── Annual Report (admin only) ── */}
      {isAdmin && (
        <>
          <SectionDivider label={t('annualReport.title')} />

          {/* Record income form */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{t('annualReport.recordIncome')}</Typography>
              <Box component="form" data-testid="income-form" onSubmit={handleIncSubmit} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField label={t('annualReport.incomeCategory')} value={incCategory} onChange={e => setIncCategory(e.target.value)} required size="small" />
                <TextField label={t('common.description')} value={incDesc} onChange={e => setIncDesc(e.target.value)} size="small" />
                <TextField label={t('expenses.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01' } }} value={incAmt} onChange={e => setIncAmt(e.target.value)} required size="small" />
                <TextField label={t('annualReport.incomeDate')} type="date" value={incDate} onChange={e => setIncDate(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
                <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button data-testid="income-submit-btn" type="submit" variant="contained" disabled={incSaving} size="small" sx={{ alignSelf: 'flex-start' }}>{t('annualReport.recordIncome')}</Button>
                  {incOk && <Alert data-testid="income-submit-success" severity="success" sx={{ py: 0 }}>{t('annualReport.incomeRecorded')}</Alert>}
                  {incFormErr && <Alert data-testid="income-submit-error" severity="error" sx={{ py: 0 }}>{incFormErr}</Alert>}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Year picker + load button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{t('annualReport.yearLabel')}</Typography>
            <TextField
              type="number"
              value={reportYear}
              onChange={e => setReportYear(parseInt(e.target.value, 10))}
              size="small"
              slotProps={{ htmlInput: { min: 2000, max: 2100, style: { width: 90 } } }}
            />
            <Button variant="outlined" size="small" onClick={loadReport} disabled={repLoad}>{t('common.load')}</Button>
            <Button variant="outlined" size="small" onClick={handleDownloadXlsx} disabled={xlsxLoad}>{t('annualReport.downloadExcel')}</Button>
            {(repLoad || xlsxLoad) && <CircularProgress size={18} />}
          </Box>

          {repErr && <Alert severity="error">{repErr}</Alert>}

          {report && (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700 }}>{report.year}</TableCell>
                    {report.months.map(m => <TableCell key={m} align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{m.slice(5)}</TableCell>)}
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('annualReport.total')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Income section header */}
                  <TableRow sx={{ bgcolor: 'success.50' }}>
                    <TableCell colSpan={14} sx={{ fontWeight: 700, color: 'success.dark', py: 0.5 }}>{t('annualReport.income')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>{t('annualReport.maintenanceFees')}</TableCell>
                    {report.maintenanceFees.byMonth.map((v, i) => <TableCell key={i} align="right">{v > 0 ? formatEur(v) : '—'}</TableCell>)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatEur(report.maintenanceFees.total)}</TableCell>
                  </TableRow>
                  {report.otherIncome.map(line => (
                    <TableRow key={line.category}>
                      <TableCell sx={{ pl: 3 }}>{line.category}</TableCell>
                      {line.byMonth.map((v, i) => <TableCell key={i} align="right">{v > 0 ? formatEur(v) : '—'}</TableCell>)}
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{formatEur(line.total)}</TableCell>
                    </TableRow>
                  ))}

                  {/* Expenses section header */}
                  <TableRow sx={{ bgcolor: 'error.50' }}>
                    <TableCell colSpan={14} sx={{ fontWeight: 700, color: 'error.dark', py: 0.5 }}>{t('annualReport.expenses')}</TableCell>
                  </TableRow>
                  {report.expenses.map(pg => (
                    <React.Fragment key={pg.parentCategory}>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 600, pl: 2 }}>{pg.parentCategory}</TableCell>
                        {Array(12).fill(null).map((_, i) => (
                          <TableCell key={i} align="right" sx={{ fontWeight: 600 }}>
                            {pg.subCategories.reduce((s, c) => s + (c.byMonth[i] ?? 0), 0) > 0
                              ? formatEur(pg.subCategories.reduce((s, c) => s + (c.byMonth[i] ?? 0), 0))
                              : '—'}
                          </TableCell>
                        ))}
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatEur(pg.subCategories.reduce((s, c) => s + c.total, 0))}
                        </TableCell>
                      </TableRow>
                      {pg.subCategories.map(sub => (
                        <TableRow key={sub.name}>
                          <TableCell sx={{ pl: 4, color: 'text.secondary', fontSize: '0.8125rem' }}>{sub.name}</TableCell>
                          {sub.byMonth.map((v, i) => <TableCell key={i} align="right" sx={{ fontSize: '0.8125rem' }}>{v > 0 ? formatEur(v) : '—'}</TableCell>)}
                          <TableCell align="right" sx={{ fontWeight: 500 }}>{formatEur(sub.total)}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Period result */}
                  <TableRow sx={{ bgcolor: 'primary.50', borderTop: '2px solid', borderColor: 'divider' }}>
                    <TableCell sx={{ fontWeight: 700 }}>{t('annualReport.periodResult')}</TableCell>
                    {report.periodResultByMonth.map((v, i) => (
                      <TableCell key={i} align="right" sx={{ fontWeight: 600, color: v >= 0 ? 'success.main' : 'error.main' }}>
                        {formatEur(v)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 700, color: report.periodResultTotal >= 0 ? 'success.main' : 'error.main' }}>
                      {formatEur(report.periodResultTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          )}

          {/* ── Invoice Scanner ── */}
          <SectionDivider label={t('invoiceScan.title')} />

          {scanStep === 'idle' && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('invoiceScan.uploadLabel')}</Typography>
                <Button variant="contained" component="label" size="small">
                  {t('invoiceScan.uploadBtn')}
                  <input type="file" hidden accept="application/pdf,image/*" onChange={handleInvoiceSelected} />
                </Button>
                {scanErr && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{scanErr}</Alert>}
              </CardContent>
            </Card>
          )}

          {scanStep === 'scanning' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <CircularProgress size={24} />
              <Typography>{t('invoiceScan.scanning')}</Typography>
            </Box>
          )}

          {scanStep === 'done' && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{t('invoiceScan.resultTitle')}</Typography>
                <Box component="form" onSubmit={handleScanSubmit} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <TextField label={t('invoiceScan.fieldAmount')} type="number" slotProps={{ htmlInput: { step: '0.01' } }} value={scanAmt} onChange={e => setScanAmt(e.target.value)} size="small" />
                  <TextField label={t('invoiceScan.fieldDate')} type="date" value={scanDate} onChange={e => setScanDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label={t('invoiceScan.fieldVendor')} value={scanDesc} onChange={e => setScanDesc(e.target.value)} size="small" />
                  <TextField label={t('invoiceScan.confidence')} value={`${(scanConf * 100).toFixed(0)}%`} size="small" slotProps={{ input: { readOnly: true } }} />
                  <TextField label={t('expenses.category')} select value={scanCat} onChange={e => setScanCat(e.target.value)} size="small">
                    {EXPENSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField label={t('expenses.parentCategory')} select value={scanParent} onChange={e => setScanParent(e.target.value)} size="small">
                    {PARENT_CATEGORIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </TextField>
                  <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Button type="submit" variant="contained" size="small" disabled={scanSaving}>
                      {scanSaving ? t('invoiceScan.saving') : t('invoiceScan.saveAsExpense')}
                    </Button>
                    <Button variant="outlined" size="small" onClick={resetScan}>{t('invoiceScan.reset')}</Button>
                  </Box>
                  {scanOk && <Alert severity="success" sx={{ gridColumn: '1 / -1', py: 0 }}>{t('invoiceScan.saved')}</Alert>}
                  {scanSaveErr && <Alert severity="error" sx={{ gridColumn: '1 / -1', py: 0 }}>{scanSaveErr}</Alert>}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
