import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { getHouseholds, upsertHousehold, HouseholdDto } from '../api/households';
import HouseholdRefPicker from './HouseholdRefPicker';

export default function HouseholdsScreen() {
  const { t } = useTranslation();
  const [rows, setRows]       = useState<HouseholdDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState('');

  const [addOpen, setAddOpen]   = useState(false);
  const [addRef, setAddRef]     = useState('');
  const [addSqm, setAddSqm]     = useState('');
  const [adding, setAdding]     = useState(false);
  const [addErr, setAddErr]     = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editRef, setEditRef]   = useState('');
  const [editSqm, setEditSqm]   = useState('');
  const [editing, setEditing]   = useState(false);
  const [editErr, setEditErr]   = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await getHouseholds()); }
    catch { setError(t('households.errLoad')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setAddRef(''); setAddSqm(''); setAddErr(''); setAddOpen(true); };

  const handleAdd = async () => {
    if (!addRef) { setAddErr(t('households.errRefRequired')); return; }
    setAdding(true); setAddErr('');
    try {
      await upsertHousehold(addRef, parseFloat(addSqm) || 0);
      setAddOpen(false);
      showToast(t('households.saved'));
      load();
    } catch { setAddErr(t('households.errSave')); }
    finally { setAdding(false); }
  };

  const openEdit = (row: HouseholdDto) => {
    setEditRef(row.householdRef);
    setEditSqm(String(row.sqMeters));
    setEditErr('');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    setEditing(true); setEditErr('');
    try {
      await upsertHousehold(editRef, parseFloat(editSqm) || 0);
      setEditOpen(false);
      showToast(t('households.saved'));
      load();
    } catch { setEditErr(t('households.errSave')); }
    finally { setEditing(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('households.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('households.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ textTransform: 'none' }}>
          {t('households.addHousehold')}
        </Button>
      </Box>

      {toast && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setToast('')}>{toast}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper elevation={0} variant="outlined">
        {loading ? (
          <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">{t('households.loading')}</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.householdRef')}</TableCell>
                <TableCell align="right">{t('households.sqMeters')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {t('households.none')}
                  </TableCell>
                </TableRow>
              ) : rows.map(r => (
                <TableRow key={r.householdRef}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.householdRef}</TableCell>
                  <TableCell align="right">{r.sqMeters.toFixed(2)}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(r)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={adding ? undefined : () => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('households.addTitle')}</DialogTitle>
        <DialogContent>
          {addErr && <Alert severity="error" sx={{ mb: 2 }}>{addErr}</Alert>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {t('households.pickerLabel')}
          </Typography>
          <HouseholdRefPicker onChange={setAddRef} />
          <TextField
            label={t('households.sqMetersLabel')}
            value={addSqm}
            onChange={e => setAddSqm(e.target.value)}
            type="number"
            size="small"
            fullWidth
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} color="inherit" disabled={adding}>{t('common.cancel')}</Button>
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={adding || !addRef}
            startIcon={adding ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {adding ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={editing ? undefined : () => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('households.editTitle', { ref: editRef })}</DialogTitle>
        <DialogContent>
          {editErr && <Alert severity="error" sx={{ mb: 2 }}>{editErr}</Alert>}
          <TextField
            label={t('households.sqMetersLabel')}
            value={editSqm}
            onChange={e => setEditSqm(e.target.value)}
            type="number"
            size="small"
            fullWidth
            sx={{ mt: 1 }}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} color="inherit" disabled={editing}>{t('common.cancel')}</Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            disabled={editing}
            startIcon={editing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editing ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
