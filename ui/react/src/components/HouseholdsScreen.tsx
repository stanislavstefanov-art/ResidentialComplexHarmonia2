import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { getHouseholds, upsertHousehold, deleteHousehold, HouseholdDto } from '../api/households';
import { getAdminDirectory } from '../api/directory';
import { DirectoryEntryAdmin } from '../types';
import HouseholdRefPicker from './HouseholdRefPicker';

export default function HouseholdsScreen() {
  const { t } = useTranslation();
  const [rows, setRows]         = useState<HouseholdDto[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntryAdmin[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');

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

  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteRef, setDeleteRef]     = useState('');
  const [deleting, setDeleting]       = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [h, d] = await Promise.all([getHouseholds(), getAdminDirectory()]);
      setRows(h);
      setDirectory(d);
    } catch { setError(t('households.errLoad')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Pick the primary resident name for each householdRef (Owner first, then Renter).
  const residentNameByRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of directory) {
      const existing = map.get(e.householdRef);
      if (!existing || e.role === 'Owner') {
        if (e.displayName) map.set(e.householdRef, e.displayName);
      }
    }
    return map;
  }, [directory]);

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

  const openDelete = (ref: string) => { setDeleteRef(ref); setDeleteOpen(true); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHousehold(deleteRef);
      setDeleteOpen(false);
      showToast(t('households.deleted'));
      load();
    } catch { setError(t('households.errDelete')); setDeleteOpen(false); }
    finally { setDeleting(false); }
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
                <TableCell>{t('households.apartment')}</TableCell>
                <TableCell>{t('households.residentName')}</TableCell>
                <TableCell align="right">{t('households.sqMeters')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {t('households.none')}
                  </TableCell>
                </TableRow>
              ) : rows.map(r => (
                <TableRow key={r.householdRef}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.householdRef}</TableCell>
                  <TableCell>{residentNameByRef.get(r.householdRef) ?? '—'}</TableCell>
                  <TableCell align="right">{r.sqMeters.toFixed(2)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => openEdit(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => openDelete(r.householdRef)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
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

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={deleting ? undefined : () => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('households.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography
            dangerouslySetInnerHTML={{ __html: t('households.deleteConfirm', { ref: deleteRef }) }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} color="inherit" disabled={deleting}>{t('common.cancel')}</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {deleting ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
