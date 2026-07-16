import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getPeriodSummary, getMyCharges, getMyPayments } from '../api/financial';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from '../types';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function FinancialScreen() {
  const [period, setPeriod]               = useState(currentMonth());
  const [summary, setSummary]             = useState<PeriodSummaryDto | null>(null);
  const [charges, setCharges]             = useState<ChargeDto[]>([]);
  const [payments, setPayments]           = useState<PaymentDto[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, chargesData, paymentsData] = await Promise.all([
        getPeriodSummary(period),
        getMyCharges(),
        getMyPayments(),
      ]);
      setSummary(summaryData);
      setCharges(chargesData);
      setPayments(paymentsData);
    } catch {
      setError('Could not load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
        <Alert severity="error">{error}</Alert>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Period:</Typography>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
        />
      </Box>

      {summary && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total charges this period</Typography>
              <Typography
                data-testid="summary-charges"
                variant="h6"
                sx={{ fontWeight: 700, color: 'primary.main' }}
              >
                {formatEur(summary.totalChargesEur)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total expenses this period</Typography>
              <Typography
                data-testid="summary-expenses"
                variant="h6"
                sx={{ fontWeight: 700, color: 'primary.main' }}
              >
                {formatEur(summary.totalExpensesEur)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>My Charges</Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No charges on record.
              </TableCell>
            </TableRow>
          ) : (
            charges.map(c => (
              <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                <TableCell>{c.description}</TableCell>
                <TableCell>{c.period}</TableCell>
                <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>My Payments</Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date received</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No payments on record.
              </TableCell>
            </TableRow>
          ) : (
            payments.map(p => (
              <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                <TableCell>{p.dateReceived}</TableCell>
                <TableCell>{p.period}</TableCell>
                <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Button variant="contained" onClick={() => setShowPayDialog(true)}>
        Request Payment
      </Button>

      <Dialog open={showPayDialog} onClose={() => setShowPayDialog(false)}>
        <DialogTitle>Request Payment</DialogTitle>
        <DialogContent>
          <Box data-testid="pay-dialog">
            <Typography>Payments are recorded by the building administrator.</Typography>
            <Typography sx={{ mt: 1 }}>
              Please contact the office to register a payment.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPayDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
