import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getExpenses, recordExpense, scanInvoice } from '../../api/expenses';
import { ExpenseListItemDto } from '../../types';
import { CounterpartyDto } from '../../api/counterparties';
import CounterpartyPicker from './CounterpartyPicker';
import { formatEur, today } from './util';

export default function OutcomeTab() {
  const { t } = useTranslation();

  // Single shared bill form (manual + scan target)
  const [amount, setAmount]           = useState('');
  const [desc, setDesc]               = useState('');
  const [counterparty, setCounterparty] = useState<CounterpartyDto | null>(null);
  const [date, setDate]               = useState(today());
  const [confidence, setConf]         = useState<number | null>(null); // null = manual
  const [scanning, setScanning]       = useState(false);
  const [scanErr, setScanErr]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [ok, setOk]                   = useState(false);
  const [formErr, setFormErr]         = useState('');

  const [expenses, setExpenses] = useState<ExpenseListItemDto[]>([]);
  const [expLoad, setExpLoad]   = useState(true);
  const [expErr, setExpErr]     = useState('');

  const loadExpenses = useCallback(async () => {
    setExpLoad(true); setExpErr('');
    try { setExpenses(await getExpenses()); }
    catch { setExpErr(t('expenses.errLoad')); }
    finally { setExpLoad(false); }
  }, [t]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const resetForm = () => {
    setAmount(''); setDesc(''); setCounterparty(null);
    setDate(today()); setConf(null);
    setOk(false); setScanErr('');
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) { setScanErr(t('invoiceScan.errEmpty')); return; }
    setScanErr(''); setOk(false); setScanning(true);
    try {
      const dto = await scanInvoice(file);
      setAmount(dto.amount != null ? String(dto.amount) : '');
      setDate(dto.date ?? today());
      setDesc(dto.vendor ?? '');
      setConf(dto.confidence);
      // Scanning never auto-selects a counterparty — the user always picks it manually.
    } catch { setScanErr(t('invoiceScan.errScan')); }
    finally { setScanning(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setOk(false); setFormErr('');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setFormErr(t('expenses.errAmount')); return; }
    if (!counterparty) { setFormErr(t('finance.errCounterpartyRequired')); return; }
    setSaving(true);
    try {
      await recordExpense({ amountEur: parsed, description: desc, counterpartyId: counterparty.id, expenseDate: date, idempotencyKey: crypto.randomUUID() });
      resetForm(); setOk(true); await loadExpenses();
    } catch { setFormErr(t('expenses.errRecord')); }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>{t('finance.addBill')}</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            <Button variant="contained" component="label" size="small" disabled={scanning}>
              {t('finance.scanInvoice')}
              <input data-testid="bill-scan-input" type="file" hidden accept="application/pdf,image/*" onChange={handleScanFile} />
            </Button>
            {scanning && <CircularProgress size={18} />}
            {confidence != null && <Chip data-testid="bill-confidence" size="small" label={`${t('invoiceScan.confidence')}: ${(confidence * 100).toFixed(0)}%`} />}
            <Typography variant="caption" color="text.secondary">{t('finance.orEnterManually')}</Typography>
          </Box>
          {scanErr && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{scanErr}</Alert>}

          <Box component="form" data-testid="bill-form" onSubmit={handleSubmit} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label={t('expenses.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'data-testid': 'bill-amount' } }} value={amount} onChange={e => setAmount(e.target.value)} required size="small" />
            <TextField label={t('expenses.expenseDate')} type="date" value={date} onChange={e => setDate(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={t('common.description')} value={desc} onChange={e => setDesc(e.target.value)} required size="small" slotProps={{ htmlInput: { 'data-testid': 'bill-desc' } }} />
            <CounterpartyPicker value={counterparty} onChange={setCounterparty} />
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button data-testid="bill-submit" type="submit" variant="contained" size="small" disabled={saving || !counterparty}>{t('expenses.record')}</Button>
              <Button variant="outlined" size="small" onClick={resetForm} disabled={saving}>{t('finance.clearForm')}</Button>
              {ok && <Alert data-testid="bill-success" severity="success" sx={{ py: 0 }}>{t('expenses.recorded')}</Alert>}
              {formErr && <Alert severity="error" sx={{ py: 0 }}>{formErr}</Alert>}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Divider><Typography variant="overline" color="text.secondary">{t('nav.expenses')}</Typography></Divider>

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
                <TableCell>{t('finance.counterpartyLabel')}</TableCell>
                <TableCell>{t('expenses.category')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('expenses.none')}</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                  <TableCell>{e.expenseDate}</TableCell>
                  <TableCell>{e.counterpartyName}</TableCell>
                  <TableCell>{e.counterpartyCategory}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right">{formatEur(e.amountEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
