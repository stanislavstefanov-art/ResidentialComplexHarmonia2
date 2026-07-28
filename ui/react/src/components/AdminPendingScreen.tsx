import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, IconButton, TextField, Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { listPending, activatePending, purgeExpired } from '../api/adminPending';
import { PendingSignInDto, Role } from '../types';

interface Props {
  role: Role;
}

export default function AdminPendingScreen({ role }: Props) {
  const [rows, setRows] = useState<PendingSignInDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  const [activateOpen, setActivateOpen] = useState(false);
  const [activateOid, setActivateOid] = useState('');
  const [householdRef, setHouseholdRef] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string>('');

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setError('');
    try {
      const data = await listPending();
      setRows(data);
    } catch (e: any) {
      if (e?.status === 403) {
        setForbidden(true);
        setRows([]);
      } else {
        setError('Could not load pending sign-ins. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const openActivate = (row: PendingSignInDto) => {
    setActivateOid(row.entraObjectId);
    setHouseholdRef('');
    setActivateError('');
    setActivateOpen(true);
  };

  const handleActivate = async () => {
    setActivating(true);
    setActivateError('');
    try {
      await activatePending(activateOid, householdRef);
      setActivateOpen(false);
      showToast('Linked successfully.');
      load();
    } catch (e: any) {
      if (e?.status === 409) setActivateError('Already linked to a household.');
      else if (e?.status === 404) setActivateError('Pending entry no longer exists — it may have been removed.');
      else if (e?.status === 403) setActivateError('Admin access required.');
      else setActivateError('Failed — please try again.');
    } finally {
      setActivating(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const result = await purgeExpired();
      setPurgeOpen(false);
      showToast(result.deleted > 0
        ? `Deleted ${result.deleted} expired entries.`
        : 'No expired entries found.');
    } catch (e: any) {
      setPurgeOpen(false);
      if (e?.status === 403) setError('Admin access required.');
      else setError('Failed — please try again.');
    } finally {
      setPurging(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'displayName', headerName: 'Display Name', flex: 1 },
    { field: 'email', headerName: 'Email', width: 260 },
    {
      field: 'entraObjectId',
      headerName: 'OID',
      width: 220,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value as string}
          size="small"
          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'firstSeenAt',
      headerName: 'First Seen',
      width: 160,
      valueFormatter: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton size="small" onClick={() => openActivate(params.row as PendingSignInDto)}>
          <LinkIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      {toast && <Alert severity="success" sx={{ mb: 2 }}>{toast}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6">Pending Sign-Ins</Typography>
          <Typography variant="body2" color="text.secondary">
            Users awaiting household assignment.
          </Typography>
        </Box>
        <Button variant="outlined" color="warning" onClick={() => setPurgeOpen(true)}>
          Purge Expired (&gt;90 days)
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && <CircularProgress size={32} />}

      {!loading && forbidden && (
        <Alert severity="info">Admin access required to view pending sign-ins.</Alert>
      )}

      {!loading && !forbidden && (
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.entraObjectId}
          autoHeight
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      )}

      <Dialog open={activateOpen} onClose={() => setActivateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link to Household</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mb: 2 }}>
            {activateOid}
          </Typography>
          {activateError && <Alert severity="error" sx={{ mb: 2 }}>{activateError}</Alert>}
          <TextField
            label="Household Ref"
            value={householdRef}
            onChange={(e) => setHouseholdRef(e.target.value)}
            fullWidth
            placeholder="e.g. AP-101"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateOpen(false)} disabled={activating}>Cancel</Button>
          <Button
            onClick={handleActivate}
            loading={activating}
            variant="contained"
            disabled={!householdRef || activating}
          >
            Link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={purgeOpen} onClose={() => setPurgeOpen(false)} maxWidth="xs">
        <DialogTitle>Purge Expired Entries?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all pending sign-ins older than 90 days. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeOpen(false)} disabled={purging}>Cancel</Button>
          <Button onClick={handlePurge} loading={purging} color="warning" variant="contained">
            Purge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
