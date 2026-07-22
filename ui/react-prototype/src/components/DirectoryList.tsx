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
  TextField,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/EditOutlined';
import PersonOffIcon from '@mui/icons-material/PersonOffOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
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

const BLANK_RESIDENT: MyContact = { displayName: '', phone: '', email: '', isOptedOut: false };
const BLANK_ADMIN: AdminContact = { displayName: '', phone: '', email: '', notes: '', isOptedOut: false };

function Toolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
    </GridToolbarContainer>
  );
}

interface Props { role: Role; }

const DirectoryList: React.FC<Props> = ({ role }) => {
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

  // shared
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [toast, setToast]                 = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (role === 'resident') {
        setRows(await getDirectory());
      } else {
        setAdminRows(await getAdminDirectory());
      }
    } catch {
      setError('Could not reach the Harmonia API. Is it running on port 5000?');
    } finally {
      setLoading(false);
    }
  }, [role]);

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
      showToast('Profile updated.');
      await load();
    } catch {
      setError('Could not save. Please try again.');
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
      showToast('Resident updated.');
      await load();
    } catch {
      setError('Could not save. Please try again.');
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
      showToast(`${departRef} marked as departed.`);
    } catch {
      setError('Could not mark as departed. Please try again.');
    } finally {
      setDeparting(false);
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const residentCols: GridColDef<DirectoryEntry>[] = useMemo(() => [
    {
      field: 'householdRef',
      headerName: 'Apartment',
      width: 160,
      renderCell: (p: GridRenderCellParams<DirectoryEntry>) => (
        <Chip label={p.value} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
      ),
    },
    {
      field: 'displayName',
      headerName: 'Name',
      flex: 1,
      valueGetter: (v: string | null) => v ?? '—',
    },
  ], []);

  const adminCols: GridColDef<DirectoryEntryAdmin>[] = useMemo(() => [
    {
      field: 'householdRef',
      headerName: 'Apartment',
      width: 140,
      renderCell: (p: GridRenderCellParams<DirectoryEntryAdmin>) => (
        <Chip label={p.value} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
      ),
    },
    {
      field: 'displayName',
      headerName: 'Name',
      width: 180,
      valueGetter: (v: string | null) => v ?? '—',
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 150,
      valueGetter: (v: string | null) => v ?? '—',
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 220,
      valueGetter: (v: string | null) => v ?? '—',
    },
    {
      field: 'isOptedOut',
      headerName: 'Opt-out',
      width: 110,
      renderCell: (p: GridRenderCellParams<DirectoryEntryAdmin>) =>
        p.value
          ? <Chip label="Opted out" size="small" color="warning" />
          : <Chip label="Active" size="small" color="success" variant="outlined" />,
    },
    {
      field: 'deactivatedAt',
      headerName: 'Departed',
      width: 140,
      valueGetter: (v: string | null) =>
        v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      field: '_actions',
      headerName: '',
      width: 88,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p: GridRenderCellParams<DirectoryEntryAdmin>) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <IconButton size="small" title="Edit" onClick={() => openAdminEdit(p.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" title="Mark Departed" onClick={() => openDepart(p.row.householdRef)}>
            <PersonOffIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ], [openAdminEdit, openDepart]);

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
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Member Directory</Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? 'Admin view — all active residents including opted-out.'
              : 'Showing residents who have shared their details.'}
          </Typography>
        </Box>
        {!isAdmin && (
          <Button
            variant="outlined"
            startIcon={<ManageAccountsIcon />}
            onClick={() => { setResidentForm(BLANK_RESIDENT); setResidentDialogOpen(true); }}
            sx={{ textTransform: 'none' }}
          >
            My Profile
          </Button>
        )}
      </Box>

      {/* alerts */}
      {toast && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setToast(null)}>{toast}</Alert>}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={load}>Retry</Button>}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* search */}
      <TextField
        size="small"
        placeholder={isAdmin ? 'Search name, apartment, phone, email…' : 'Search residents…'}
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
            <Typography variant="body2" color="text.secondary">Loading directory…</Typography>
          </Box>
        ) : isAdmin ? (
          <Box sx={{ height: 520 }}>
            <DataGrid
              rows={filteredAdminRows}
              columns={adminCols}
              getRowId={r => r.householdRef}
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              disableRowSelectionOnClick
              slots={{ toolbar: Toolbar }}
              sx={{ border: 0 }}
            />
          </Box>
        ) : (
          <Box sx={{ height: 400 }}>
            <DataGrid
              rows={filteredRows}
              columns={residentCols}
              getRowId={r => r.householdRef}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              disableRowSelectionOnClick
              slots={{ toolbar: Toolbar }}
              sx={{ border: 0 }}
            />
          </Box>
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
    </Box>
  );
};

export default DirectoryList;
