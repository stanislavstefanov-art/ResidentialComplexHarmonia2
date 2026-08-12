import React, { useState, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { recordIncome, getAnnualReport, downloadAnnualReportXlsx } from '../../api/expenses';
import { AnnualReportDto } from '../../types';
import { formatEur, today } from './util';

function SectionDivider({ label }: { label: string }) {
  return (
    <Divider sx={{ my: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
        {label}
      </Typography>
    </Divider>
  );
}

export default function ReportTab() {
  const { t } = useTranslation();

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
    </Box>
  );
}
