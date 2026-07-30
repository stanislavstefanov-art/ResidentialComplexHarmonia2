import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, IconButton, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { listPending, activatePending, purgeExpired } from '../api/adminPending';
import { PendingSignInDto, Role } from '../types';

interface Props {
  role: Role;
}

export default function AdminPendingScreen({ role }: Props) {
  const { t } = useTranslation();
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
        setError(t('adminPending.errLoad'));
      }
    } finally {
      setLoading(false);
    }
  }, [role, t]);

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
      showToast(t('adminPending.linked'));
      load();
    } catch (e: any) {
      if (e?.status === 409) setActivateError(t('adminPending.alreadyLinked'));
      else if (e?.status === 404) setActivateError(t('adminPending.gone'));
      else if (e?.status === 403) setActivateError(t('adminPending.accessDenied'));
      else setActivateError(t('adminPending.failed'));
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
        ? t('adminPending.purged', { count: result.deleted })
        : t('adminPending.noneExpired'));
    } catch (e: any) {
      setPurgeOpen(false);
      if (e?.status === 403) setError(t('adminPending.accessDenied'));
      else setError(t('adminPending.failed'));
    } finally {
      setPurging(false);
    }
  };


  return (
    <Box>
      {toast && <Alert severity="success" sx={{ mb: 2 }}>{toast}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6">{t('adminPending.title')}</Typography>
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
        <Alert severity="info">{t('adminPending.accessRequired')}</Alert>
      )}

      {!loading && !forbidden && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.displayName')}</TableCell>
              <TableCell sx={{ width: 260 }}>{t('common.email')}</TableCell>
              <TableCell sx={{ width: 220 }}>{t('adminPending.oid')}</TableCell>
              <TableCell sx={{ width: 160 }}>{t('adminPending.firstSeen')}</TableCell>
              <TableCell sx={{ width: 60 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  No pending sign-ins.
                </TableCell>
              </TableRow>
            ) : rows.map(row => (
              <TableRow key={row.entraObjectId}>
                <TableCell>{row.displayName}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>
                  <Chip
                    label={row.entraObjectId}
                    size="small"
                    sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                  />
                </TableCell>
                <TableCell>{new Date(row.firstSeenAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openActivate(row)}>
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={activateOpen} onClose={() => setActivateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('adminPending.linkTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mb: 2 }}>
            {activateOid}
          </Typography>
          {activateError && <Alert severity="error" sx={{ mb: 2 }}>{activateError}</Alert>}
          <TextField
            label={t('adminPending.householdRefLabel')}
            value={householdRef}
            onChange={(e) => setHouseholdRef(e.target.value)}
            fullWidth
            placeholder={t('adminPending.refPlaceholder')}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateOpen(false)} disabled={activating}>{t('common.cancel')}</Button>
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
        <DialogTitle>{t('adminPending.purgeTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all pending sign-ins older than 90 days. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeOpen(false)} disabled={purging}>{t('common.cancel')}</Button>
          <Button onClick={handlePurge} loading={purging} color="warning" variant="contained">
            Purge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
