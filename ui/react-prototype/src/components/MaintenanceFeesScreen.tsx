import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getMyCharges, getAllCharges, recordCharge } from '../api/maintenanceFees';
import { ChargeDto } from '../types';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface Props {
  role: 'resident' | 'admin';
}

export default function MaintenanceFeesScreen({ role }: Props) {
  const [charges, setCharges]           = useState<ChargeDto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);

  const [householdRef, setHouseholdRef] = useState('');
  const [amount, setAmount]             = useState('');
  const [description, setDesc]          = useState('');
  const [period, setPeriod]             = useState(currentMonth());

  const loadCharges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCharges(role === 'admin' ? await getAllCharges() : await getMyCharges());
    } catch {
      setError('Could not load charges. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { loadCharges(); }, [loadCharges]);

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
      await recordCharge(householdRef, {
        amountEur: parsed,
        description,
        period,
        idempotencyKey: crypto.randomUUID(),
      });
      setSubmitSuccess(true);
      setHouseholdRef('');
      setAmount('');
      setDesc('');
      setPeriod(currentMonth());
      await loadCharges();
    } catch {
      setSubmitError('Could not record charge. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {role === 'admin' && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Record Charge</Typography>
            <Box
              component="form"
              data-testid="record-form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label="Household Ref"
                inputProps={{ 'aria-label': 'Household Ref' }}
                value={householdRef}
                onChange={e => setHouseholdRef(e.target.value)}
                required
                size="small"
                placeholder="e.g. H001"
              />
              <TextField
                label="Amount (€)"
                inputProps={{ step: '0.01', min: '0.01', 'aria-label': 'Amount (€)' }}
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                size="small"
              />
              <TextField
                label="Description"
                value={description}
                onChange={e => setDesc(e.target.value)}
                size="small"
              />
              <TextField
                label="Period (YYYY-MM)"
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                required
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <Button
                data-testid="submit-btn"
                type="submit"
                variant="contained"
                disabled={submitting}
              >
                Record Charge
              </Button>
              {submitSuccess && (
                <Alert data-testid="submit-success" severity="success">Charge recorded.</Alert>
              )}
              {submitError && (
                <Alert data-testid="submit-error" severity="error">{submitError}</Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {role === 'admin' ? 'All Charges' : 'My Charges'}
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadCharges}>Retry</Button>
        </Box>
      )}

      {!loading && !error && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Period</TableCell>
              {role === 'admin' && <TableCell>Household</TableCell>}
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Charged At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {charges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={role === 'admin' ? 5 : 4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  No charges on record.
                </TableCell>
              </TableRow>
            ) : (
              charges.map(c => (
                <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                  <TableCell>{c.period}</TableCell>
                  {role === 'admin' && <TableCell>{c.householdRef}</TableCell>}
                  <TableCell>{c.description}</TableCell>
                  <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
                  <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
