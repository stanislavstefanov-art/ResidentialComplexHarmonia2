import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getExpenses, recordExpense } from '../api/expenses';
import { getMyCharges } from '../api/maintenanceFees';
import { getMyPayments } from '../api/payments';
import { ExpenseDto, ChargeDto, PaymentDto, EXPENSE_CATEGORIES, PARENT_CATEGORIES } from '../types';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  role: 'resident' | 'admin';
}

export default function ExpensesScreen({ role }: Props) {
  const { t } = useTranslation();

  // ── Admin: expense ledger ─────────────────────────────────────────────────
  const [expenses, setExpenses]           = useState<ExpenseDto[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]     = useState<string>('');
  const [submitting, setSubmitting]       = useState(false);
  const [amount, setAmount]               = useState('');
  const [description, setDesc]            = useState('');
  const [category, setCategory]           = useState<string>(EXPENSE_CATEGORIES[0]);
  const [parentCategory, setParentCat]    = useState<string>(PARENT_CATEGORIES[3]);
  const [expenseDate, setExpDate]         = useState(today());

  // ── Resident: My Fees ─────────────────────────────────────────────────────
  const [charges, setCharges]         = useState<ChargeDto[]>([]);
  const [myPayments, setMyPayments]   = useState<PaymentDto[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError]     = useState<string>('');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setExpenses(await getExpenses());
    } catch {
      setError(t('expenses.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadFees = useCallback(async () => {
    setFeesLoading(true);
    setFeesError('');
    try {
      const [c, p] = await Promise.all([getMyCharges(), getMyPayments()]);
      setCharges(c);
      setMyPayments(p);
    } catch {
      setFeesError(t('finance.errLoad'));
    } finally {
      setFeesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (role === 'resident') loadFees();
    else loadExpenses();
  }, [role, loadFees, loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError('');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setSubmitError(t('expenses.errAmount'));
      return;
    }
    setSubmitting(true);
    try {
      await recordExpense({
        amountEur:      parsed,
        description,
        category,
        parentCategory,
        expenseDate,
        idempotencyKey: crypto.randomUUID(),
      });
      setSubmitSuccess(true);
      setAmount('');
      setDesc('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setParentCat(PARENT_CATEGORIES[3]);
      setExpDate(today());
      await loadExpenses();
    } catch {
      setSubmitError(t('expenses.errRecord'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resident view: My Fees ────────────────────────────────────────────────
  if (role === 'resident') {
    const totalCharged = charges.reduce((s, c) => s + c.amountEur, 0);
    const totalPaid    = myPayments.reduce((s, p) => s + p.amountEur, 0);
    const balance      = totalCharged - totalPaid;

    if (feesLoading) return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

    if (feesError) return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
        <Alert severity="error">{feesError}</Alert>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadFees}>{t('common.retry')}</Button>
      </Box>
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Balance summary */}
        <Card variant="outlined">
          <CardContent sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('payments.charged')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatEur(totalCharged)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('payments.paid')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatEur(totalPaid)}</Typography>
            </Box>
            <Box sx={{ ml: 'auto' }}>
              <Typography variant="caption" color="text.secondary">{t('payments.balance')}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: balance > 0 ? '#c62828' : '#2e6b4f' }}>
                {formatEur(balance)}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* My Charges */}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('finance.myCharges')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    {t('finance.noCharges')}
                  </TableCell>
                </TableRow>
              ) : charges.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.period}</TableCell>
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* My Payments */}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('finance.myPayments')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.period')}</TableCell>
                <TableCell>{t('finance.dateReceived')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    {t('finance.noPayments')}
                  </TableCell>
                </TableRow>
              ) : myPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.period}</TableCell>
                  <TableCell>{p.dateReceived}</TableCell>
                  <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

      </Box>
    );
  }

  // ── Admin view: expense recording + ledger ────────────────────────────────
  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('expenses.record')}</Typography>
          <Box
            component="form"
            data-testid="record-form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('expenses.amountEuro')}
              type="number"
              slotProps={{ htmlInput: { step: '0.01', min: '0.01' } }}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              size="small"
            />
            <TextField
              label={t('common.description')}
              value={description}
              onChange={e => setDesc(e.target.value)}
              required
              size="small"
            />
            <Select value={category} onChange={e => setCategory(e.target.value)} size="small">
              {EXPENSE_CATEGORIES.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
            <Select value={parentCategory} onChange={e => setParentCat(e.target.value)} size="small" displayEmpty>
              {PARENT_CATEGORIES.map(p => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <TextField
              label={t('expenses.expenseDate')}
              type="date"
              value={expenseDate}
              onChange={e => setExpDate(e.target.value)}
              required
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button data-testid="submit-btn" type="submit" variant="contained" disabled={submitting}>
              {t('expenses.record')}
            </Button>
            {submitSuccess && <Alert data-testid="submit-success" severity="success">{t('expenses.recorded')}</Alert>}
            {submitError  && <Alert data-testid="submit-error"   severity="error">{submitError}</Alert>}
          </Box>
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('expenses.ledger')}</Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {error && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadExpenses}>{t('common.retry')}</Button>
        </Box>
      )}
      {!loading && !error && (
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
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  {t('expenses.none')}
                </TableCell>
              </TableRow>
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
      )}
    </Box>
  );
}
