import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getAllCharges, recordCharge } from '../../api/maintenanceFees';
import { ChargeDto } from '../../types';
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

export default function FeesTab() {
  const { t } = useTranslation();

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
    try { setCharges(await getAllCharges()); }
    catch { setFeesErr(t('fees.errLoad')); }
    finally { setFeesLoad(false); }
  }, [t]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SectionDivider label={t('nav.fees')} />

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
                <TableCell>{t('common.household')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell>{t('fees.chargedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('fees.none')}</TableCell></TableRow>
              ) : charges.map(c => (
                <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                  <TableCell>{c.period}</TableCell>
                  <TableCell>{c.householdRef}</TableCell>
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                  <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
