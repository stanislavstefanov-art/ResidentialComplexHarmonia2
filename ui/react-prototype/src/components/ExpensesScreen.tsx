import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getExpenses, recordExpense } from '../api/expenses';
import { ExpenseDto, EXPENSE_CATEGORIES } from '../types';

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
  const [expenses, setExpenses]         = useState<ExpenseDto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);

  const [amount, setAmount]         = useState('');
  const [description, setDesc]      = useState('');
  const [category, setCategory]     = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expenseDate, setExpDate]   = useState(today());

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExpenses(await getExpenses());
    } catch {
      setError('Could not load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError(null);
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setSubmitError('Enter a valid amount greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await recordExpense({
        amountEur:      parsed,
        description,
        category,
        expenseDate,
        idempotencyKey: crypto.randomUUID(),
      });
      setSubmitSuccess(true);
      setAmount('');
      setDesc('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setExpDate(today());
      await loadExpenses();
    } catch {
      setSubmitError('Could not record expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {role === 'admin' && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Record Expense</Typography>
            <Box
              component="form"
              data-testid="record-form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label="Amount (€)"
                type="number"
                inputProps={{ step: '0.01', min: '0.01' }}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                size="small"
              />
              <TextField
                label="Description"
                value={description}
                onChange={e => setDesc(e.target.value)}
                required
                size="small"
              />
              <Select
                value={category}
                onChange={e => setCategory(e.target.value)}
                size="small"
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
              <TextField
                label="Expense date"
                type="date"
                value={expenseDate}
                onChange={e => setExpDate(e.target.value)}
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
                Record Expense
              </Button>
              {submitSuccess && (
                <Alert data-testid="submit-success" severity="success">Expense recorded.</Alert>
              )}
              {submitError && (
                <Alert data-testid="submit-error" severity="error">{submitError}</Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Expense Ledger</Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadExpenses}>Retry</Button>
        </Box>
      )}

      {!loading && !error && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  No expenses on record.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map(e => (
                <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                  <TableCell>{e.expenseDate}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right">{formatEur(e.amountEur)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
