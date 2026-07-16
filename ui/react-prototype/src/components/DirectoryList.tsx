import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import PersonEditIcon from '@mui/icons-material/ManageAccountsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getDirectory, updateMyContact } from '../api/directory';
import { DirectoryEntry, MyContact } from '../types';
import EditContactDialog from './EditContactDialog';

const BLANK_FORM: MyContact = { displayName: '', phone: '', email: '', isOptedOut: false };

const columns: GridColDef<DirectoryEntry>[] = [
  {
    field: 'householdRef',
    headerName: 'Apartment',
    width: 160,
    renderCell: params => (
      <Chip label={params.value} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
    ),
  },
  {
    field: 'displayName',
    headerName: 'Name',
    flex: 1,
    valueGetter: (value: string | null) => value ?? '—',
  },
];

const DirectoryList: React.FC = () => {
  const [rows, setRows]           = useState<DirectoryEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]           = useState<MyContact>(BLANK_FORM);
  const [saving, setSaving]       = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getDirectory());
    } catch {
      setError('Could not reach the Harmonia API. Is it running on port 5000?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? rows.filter(r =>
        r.householdRef.toLowerCase().includes(search.toLowerCase()) ||
        (r.displayName ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const openDialog = () => { setForm(BLANK_FORM); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyContact({
        displayName: form.displayName || null,
        phone:       form.phone       || null,
        email:       form.email       || null,
        isOptedOut:  form.isOptedOut,
      });
      setDialogOpen(false);
      setSuccessMsg('Profile updated.');
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {/* header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Member Directory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Showing residents who have shared their details.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PersonEditIcon />}
          onClick={openDialog}
          sx={{ textTransform: 'none' }}
        >
          My Profile
        </Button>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={load}>
              Retry
            </Button>
          }
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* search */}
      <TextField
        size="small"
        placeholder="Search residents…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 320 }}
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
        ) : (
          <DataGrid
            rows={filtered}
            columns={columns}
            getRowId={r => r.householdRef}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: false,
                csvOptions: { disableToolbarButton: true },
                printOptions: { disableToolbarButton: true },
              },
            }}
            sx={{ border: 0 }}
          />
        )}
      </Paper>

      <EditContactDialog
        open={dialogOpen}
        saving={saving}
        form={form}
        onChange={setForm}
        onSave={handleSave}
        onClose={() => setDialogOpen(false)}
      />
    </Box>
  );
};

export default DirectoryList;
