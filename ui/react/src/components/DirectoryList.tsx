import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import PersonOffIcon from '@mui/icons-material/PersonOffOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import {
  adminUpdateContact,
  getAdminDirectory,
  getDirectory,
  markDeparted,
  updateMyContact,
} from '../api/directory';
import {
  AdminContact,
  DirectoryEntry,
  DirectoryEntryAdmin,
  MyContact,
  Role,
} from '../types';
import AdminEditDialog from './AdminEditDialog';
import EditContactDialog from './EditContactDialog';
import MarkDepartedDialog from './MarkDepartedDialog';
import DeleteForeverIcon from '@mui/icons-material/DeleteForeverOutlined';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import { eraseMyContact, eraseContact, removeResident } from '../api/privacy';
import EraseMyContactDialog from './EraseMyContactDialog';
import EraseContactDialog from './EraseContactDialog';
import RemoveResidentDialog from './RemoveResidentDialog';

const BLANK_RESIDENT: MyContact = { displayName: '', phone: '', email: '', isOptedOut: false };
const BLANK_ADMIN: AdminContact = { displayName: '', phone: '', email: '', notes: '', isOptedOut: false };

interface Props { role: Role; }

const DirectoryList: React.FC<Props> = ({ role }) => {
  const { t } = useTranslation();

  // resident
  const [rows, setRows]                   = useState<DirectoryEntry[]>([]);
  const [residentDialogOpen, setResidentDialogOpen] = useState(false);
  const [residentForm, setResidentForm]   = useState<MyContact>(BLANK_RESIDENT);
  const [saving, setSaving]               = useState(false);

  // admin
  const [adminRows, setAdminRows]         = useState<DirectoryEntryAdmin[]>([]);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminRef, setAdminRef]           = useState('');
  const [adminForm, setAdminForm]         = useState<AdminContact>(BLANK_ADMIN);
  const [adminSaving, setAdminSaving]     = useState(false);

  // depart
  const [departOpen, setDepartOpen]       = useState(false);
  const [departRef, setDepartRef]         = useState('');
  const [departing, setDeparting]         = useState(false);

  // erase my contact
  const [eraseMyOpen, setEraseMyOpen]           = useState(false);
  const [erasingMy, setErasingMy]               = useState(false);
  // erase contact (admin)
  const [eraseContactOpen, setEraseContactOpen] = useState(false);
  const [eraseContactRef, setEraseContactRef]   = useState('');
  const [erasingContact, setErasingContact]     = useState(false);

  // remove resident (admin)
  const [removeResidentOpen, setRemoveResidentOpen] = useState(false);
  const [removeResidentRef, setRemoveResidentRef]   = useState('');
  const [removeResidentRole, setRemoveResidentRole] = useState('');
  const [removingResident, setRemovingResident]     = useState(false);

  // shared
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string>('');
  const [search, setSearch]               = useState('');
  const [toast, setToast]                 = useState<string>('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (role === 'resident') {
        setRows(await getDirectory());
      } else {
        setAdminRows(await getAdminDirectory());
      }
    } catch {
      setError(t('directory.errApi'));
    } finally {
      setLoading(false);
    }
  }, [role, t]);

  useEffect(() => { load(); }, [load]);

  // ── resident handlers ──────────────────────────────────────────────────────
  const handleResidentSave = async () => {
    setSaving(true);
    try {
      await updateMyContact({
        displayName: residentForm.displayName || null,
        phone:       residentForm.phone       || null,
        email:       residentForm.email       || null,
        isOptedOut:  residentForm.isOptedOut,
      });
      setResidentDialogOpen(false);
      showToast(t('directory.toastProfileUpdated'));
      await load();
    } catch {
      setError(t('directory.errSave'));
    } finally {
      setSaving(false);
    }
  };

  // ── admin handlers ─────────────────────────────────────────────────────────
  const openAdminEdit = useCallback((entry: DirectoryEntryAdmin) => {
    setAdminRef(entry.householdRef);
    setAdminForm({
      displayName: entry.displayName ?? '',
      phone:       entry.phone       ?? '',
      email:       entry.email       ?? '',
      notes:       entry.notes       ?? '',
      isOptedOut:  entry.isOptedOut,
    });
    setAdminEditOpen(true);
  }, []);

  const handleAdminSave = async () => {
    setAdminSaving(true);
    try {
      await adminUpdateContact(adminRef, {
        displayName: adminForm.displayName || null,
        phone:       adminForm.phone       || null,
        email:       adminForm.email       || null,
        notes:       adminForm.notes       || null,
        isOptedOut:  adminForm.isOptedOut,
      });
      setAdminEditOpen(false);
      showToast(t('directory.toastResidentUpdated'));
      await load();
    } catch {
      setError(t('directory.errSave'));
    } finally {
      setAdminSaving(false);
    }
  };

  const openDepart = useCallback((householdRef: string) => {
    setDepartRef(householdRef);
    setDepartOpen(true);
  }, []);

  const handleDepart = async () => {
    setDeparting(true);
    try {
      await markDeparted(departRef);
      setAdminRows(prev => prev.filter(r => r.householdRef !== departRef));
      setDepartOpen(false);
      showToast(t('directory.toastDeparted', { ref: departRef }));
    } catch {
      setError(t('directory.errDepart'));
    } finally {
      setDeparting(false);
    }
  };

  const handleEraseMyContact = async () => {
    setErasingMy(true);
    try {
      await eraseMyContact();
      setEraseMyOpen(false);
      setResidentDialogOpen(false);
      setRows([]);
      showToast(t('directory.toastMyDataDeleted'));
    } catch {
      setError(t('directory.errDeleteMine'));
    } finally {
      setErasingMy(false);
    }
  };

  const handleEraseContact = async () => {
    setErasingContact(true);
    try {
      await eraseContact(eraseContactRef);
      setAdminRows(prev => prev.filter(r => r.householdRef !== eraseContactRef));
      setEraseContactOpen(false);
      showToast(t('directory.toastContactErased', { ref: eraseContactRef }));
    } catch {
      setError(t('directory.errErase'));
    } finally {
      setErasingContact(false);
    }
  };

  const handleRemoveResident = async () => {
    setRemovingResident(true);
    try {
      await removeResident(removeResidentRef, removeResidentRole);
      setAdminRows(prev => prev.filter(r =>
        !(r.householdRef === removeResidentRef && (r.role ?? 'Owner') === removeResidentRole),
      ));
      setRemoveResidentOpen(false);
      showToast(t('directory.toastRemoved', { ref: removeResidentRef }));
    } catch {
      setError(t('directory.errRemove'));
    } finally {
      setRemovingResident(false);
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────

  // ── filtering ──────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.householdRef.toLowerCase().includes(q) ||
      (r.displayName ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const filteredAdminRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adminRows;
    return adminRows.filter(r =>
      r.householdRef.toLowerCase().includes(q) ||
      (r.displayName ?? '').toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q) ||
      (r.email ?? '').toLowerCase().includes(q),
    );
  }, [adminRows, search]);

  const isAdmin = role === 'admin';

  return (
    <Box>
      {/* header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('directory.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? t('directory.adminSubtitle')
              : t('directory.residentSubtitle')}
          </Typography>
        </Box>
        {!isAdmin && (
          <Button
            variant="outlined"
            startIcon={<ManageAccountsIcon />}
            onClick={() => { setResidentForm(BLANK_RESIDENT); setResidentDialogOpen(true); }}
            sx={{ textTransform: 'none' }}
          >
            {t('directory.myProfile')}
          </Button>
        )}
      </Box>

      {/* alerts */}
      {toast && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setToast('')}>{toast}</Alert>}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={load}>{t('common.retry')}</Button>}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* search */}
      <TextField
        size="small"
        placeholder={isAdmin ? t('directory.searchAdmin') : t('directory.searchResident')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: isAdmin ? 400 : 320 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Paper elevation={0} variant="outlined">
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 4 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">{t('directory.loading')}</Typography>
          </Box>
        ) : isAdmin ? (
          <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('directory.apartment')}</TableCell>
                <TableCell>{t('directory.name')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('common.phone')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{t('common.email')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('adminPending.roleLabel')}</TableCell>
                <TableCell>{t('directory.optOut')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('directory.departed')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAdminRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {t('directory.noResidents')}
                  </TableCell>
                </TableRow>
              ) : filteredAdminRows.map(r => (
                <TableRow key={`${r.householdRef}-${r.role ?? 'Owner'}`}>
                  <TableCell>
                    <Chip label={r.householdRef} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                  </TableCell>
                  <TableCell>{r.displayName ?? '—'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.phone ?? '—'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{r.email ?? '—'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {r.role
                      ? <Chip label={t(`directory.role${r.role}`)} size="small" variant="outlined" />
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {r.isOptedOut
                      ? <Chip label={t('directory.optedOut')} size="small" color="warning" />
                      : <Chip label={t('directory.active')} size="small" color="success" variant="outlined" />}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {r.deactivatedAt ? new Date(r.deactivatedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton size="small" title={t('directory.tipEdit')} onClick={() => openAdminEdit(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" title={t('directory.tipDepart')} onClick={() => openDepart(r.householdRef)}>
                        <PersonOffIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" title={t('directory.tipRemove')}
                        onClick={() => { setRemoveResidentRef(r.householdRef); setRemoveResidentRole(r.role ?? 'Owner'); setRemoveResidentOpen(true); }}>
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" title={t('directory.tipErase')}
                        onClick={() => { setEraseContactRef(r.householdRef); setEraseContactOpen(true); }}>
                        <DeleteForeverIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>{t('directory.apartment')}</TableCell>
                <TableCell>{t('directory.name')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {t('directory.noResidents')}
                  </TableCell>
                </TableRow>
              ) : filteredRows.map(r => (
                <TableRow key={r.householdRef}>
                  <TableCell>
                    <Chip label={r.householdRef} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                  </TableCell>
                  <TableCell>{r.displayName ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* resident edit */}
      <EditContactDialog
        open={residentDialogOpen}
        saving={saving}
        form={residentForm}
        onChange={setResidentForm}
        onSave={handleResidentSave}
        onClose={() => setResidentDialogOpen(false)}
        onRequestErase={() => { setResidentDialogOpen(false); setEraseMyOpen(true); }}
      />

      {/* admin edit */}
      <AdminEditDialog
        open={adminEditOpen}
        saving={adminSaving}
        householdRef={adminRef}
        form={adminForm}
        onChange={setAdminForm}
        onSave={handleAdminSave}
        onClose={() => setAdminEditOpen(false)}
      />

      {/* mark departed confirm */}
      <MarkDepartedDialog
        open={departOpen}
        householdRef={departRef}
        departing={departing}
        onConfirm={handleDepart}
        onClose={() => setDepartOpen(false)}
      />

      <EraseMyContactDialog
        open={eraseMyOpen}
        erasing={erasingMy}
        onConfirm={handleEraseMyContact}
        onClose={() => setEraseMyOpen(false)}
      />

      <EraseContactDialog
        open={eraseContactOpen}
        householdRef={eraseContactRef}
        erasing={erasingContact}
        onConfirm={handleEraseContact}
        onClose={() => setEraseContactOpen(false)}
      />

      <RemoveResidentDialog
        open={removeResidentOpen}
        householdRef={removeResidentRef}
        removing={removingResident}
        onConfirm={handleRemoveResident}
        onClose={() => setRemoveResidentOpen(false)}
      />
    </Box>
  );
};

export default DirectoryList;
