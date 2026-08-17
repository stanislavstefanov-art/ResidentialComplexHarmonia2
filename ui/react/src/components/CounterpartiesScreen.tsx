import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useTranslation } from 'react-i18next';
import {
  CounterpartyDto, CounterpartyInput,
  getCounterparties, createCounterparty, updateCounterparty, deleteCounterparty,
} from '../api/counterparties';

const EMPTY: CounterpartyInput = {
  name: '', category: '', parentCategory: '', vatNumber: '', phone: '', email: '',
};

function toInput(c: CounterpartyDto): CounterpartyInput {
  return {
    name: c.name, category: c.category, parentCategory: c.parentCategory,
    vatNumber: c.vatNumber ?? '', phone: c.phone ?? '', email: c.email ?? '',
  };
}

// Blank optional fields → null before send.
function normalise(input: CounterpartyInput): CounterpartyInput {
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    parentCategory: input.parentCategory.trim(),
    vatNumber: input.vatNumber?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
  };
}

export default function CounterpartiesScreen() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CounterpartyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CounterpartyDto | null>(null);
  const [form, setForm] = useState<CounterpartyInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  // delete dialog
  const [deleting, setDeleting] = useState<CounterpartyDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const formValid = useMemo(
    () => form.name.trim() !== '' && form.category.trim() !== '' && form.parentCategory.trim() !== '',
    [form],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCounterparties());
    } catch {
      setError(t('counterparties.loadError'));
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm(EMPTY); setDialogOpen(true); }
  function openEdit(c: CounterpartyDto) { setEditing(c); setForm(toInput(c)); setDialogOpen(true); }

  async function save() {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = normalise(form);
      if (editing) await updateCounterparty(editing.id, payload);
      else await createCounterparty(payload);
      setDialogOpen(false);
      setToast(editing ? t('counterparties.updated') : t('counterparties.created'));
      await load();
    } catch {
      setToast(t('counterparties.saveError'));
    } finally {
      setSaving(false);
    }
  }

  function openDelete(c: CounterpartyDto) { setDeleting(c); setDeleteError(null); }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await deleteCounterparty(deleting.id);
      setDeleting(null);
      setToast(t('counterparties.deleted'));
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setDeleteError(status === 409 ? t('counterparties.deleteHasBills') : t('counterparties.deleteError'));
    } finally {
      setDeletingBusy(false);
    }
  }

  const field = (key: keyof CounterpartyInput, required = false) => (
    <TextField
      label={t(`counterparties.${key}`)}
      value={form[key] ?? ''}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      required={required}
      fullWidth
      margin="dense"
    />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>{t('counterparties.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('counterparties.add')}</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" action={<Button onClick={load}>{t('common.retry')}</Button>}>{error}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('counterparties.name')}</TableCell>
                <TableCell>{t('counterparties.category')}</TableCell>
                <TableCell>{t('counterparties.parentCategory')}</TableCell>
                <TableCell>{t('counterparties.vatNumber')}</TableCell>
                <TableCell>{t('counterparties.phone')}</TableCell>
                <TableCell>{t('counterparties.email')}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('counterparties.empty')}
                </TableCell></TableRow>
              ) : rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.parentCategory}</TableCell>
                  <TableCell>{c.vatNumber ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton size="small" color="error" onClick={() => openDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? t('counterparties.editTitle') : t('counterparties.addTitle')}</DialogTitle>
        <DialogContent>
          {field('name', true)}
          {field('category', true)}
          {field('parentCategory', true)}
          {field('vatNumber')}
          {field('phone')}
          {field('email')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={!formValid || saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* delete confirm */}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('counterparties.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('counterparties.deleteConfirm', { name: deleting?.name })}</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deletingBusy}>
            {deletingBusy ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Box>
  );
}
