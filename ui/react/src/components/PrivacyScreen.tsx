import React, { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { eraseMyContact, eraseContact, markDeparted, purgeExpired } from '../api/privacy';

interface Props {
  role: 'resident' | 'admin';
}

export default function PrivacyScreen({ role }: Props) {
  const { t } = useTranslation();
  const [deleting, setDeleting]           = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError]     = useState<string>('');

  const [eraseRef, setEraseRef]         = useState('');
  const [erasing, setErasing]           = useState(false);
  const [eraseResult, setEraseResult]   = useState<string>('');
  const [eraseError, setEraseError]     = useState<string>('');

  const [departRef, setDepartRef]         = useState('');
  const [departing, setDeparting]         = useState(false);
  const [departResult, setDepartResult]   = useState<string>('');
  const [departError, setDepartError]     = useState<string>('');

  const [purging, setPurging]             = useState(false);
  const [purgeResult, setPurgeResult]     = useState<{ deleted: number } | undefined>(undefined);
  const [purgeError, setPurgeError]       = useState<string>('');

  const handleDeleteMyData = async () => {
    setDeleteSuccess(false);
    setDeleteError('');
    setDeleting(true);
    try {
      await eraseMyContact();
      setDeleteSuccess(true);
    } catch {
      setDeleteError(t('privacy.errDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const handleErase = async (e: React.FormEvent) => {
    e.preventDefault();
    setEraseResult('');
    setEraseError('');
    setErasing(true);
    try {
      const outcome = await eraseContact(eraseRef);
      setEraseResult(outcome === 'erased' ? t('privacy.toastErased') : t('privacy.toastNotFound'));
      setEraseRef('');
    } catch {
      setEraseError(t('privacy.errErase'));
    } finally {
      setErasing(false);
    }
  };

  const handleDepart = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepartResult('');
    setDepartError('');
    setDeparting(true);
    try {
      const outcome = await markDeparted(departRef);
      setDepartResult(outcome === 'ok' ? t('privacy.toastDeparted') : t('privacy.toastDepartNotFound'));
      setDepartRef('');
    } catch {
      setDepartError(t('privacy.errDepart'));
    } finally {
      setDeparting(false);
    }
  };

  const handlePurge = async () => {
    setPurgeResult(undefined);
    setPurgeError('');
    setPurging(true);
    try {
      setPurgeResult(await purgeExpired());
    } catch {
      setPurgeError(t('privacy.errSweep'));
    } finally {
      setPurging(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {role === 'resident' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('privacy.deleteMine')}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              GDPR Art. 17 — Right to Erasure. This permanently removes your contact data and cannot be undone.
            </Typography>
            <Button
              data-testid="delete-my-data-btn"
              variant="contained"
              color="error"
              onClick={handleDeleteMyData}
              disabled={deleting}
            >
              Delete My Data
            </Button>
            {deleteSuccess && <Alert data-testid="delete-success" severity="success" sx={{ mt: 1 }}>{t('privacy.deletedMine')}</Alert>}
            {deleteError  && <Alert data-testid="delete-error"   severity="error"   sx={{ mt: 1 }}>{deleteError}</Alert>}
          </CardContent>
        </Card>
      )}

      {role === 'admin' && (
        <>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('privacy.dsarTitle')}</Typography>
              <Box
                component="form"
                data-testid="erase-form"
                onSubmit={handleErase}
                sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}
              >
                <TextField
                  label={t('privacy.eraseRefLabel')}
                  slotProps={{ htmlInput: { 'data-testid': 'erase-ref-input' } }}
                  value={eraseRef}
                  onChange={e => setEraseRef(e.target.value)}
                  size="small"
                  placeholder="e.g. H001"
                  required
                />
                <Button data-testid="erase-btn" type="submit" variant="contained" color="error" disabled={erasing}>
                  Erase Contact
                </Button>
              </Box>
              {eraseResult && <Alert data-testid="erase-result" severity="success" sx={{ mt: 1 }}>{eraseResult}</Alert>}
              {eraseError  && <Alert data-testid="erase-error"  severity="error"   sx={{ mt: 1 }}>{eraseError}</Alert>}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('privacy.departTitle')}</Typography>
              <Box
                component="form"
                data-testid="depart-form"
                onSubmit={handleDepart}
                sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}
              >
                <TextField
                  label={t('privacy.departRefLabel')}
                  slotProps={{ htmlInput: { 'data-testid': 'depart-ref-input' } }}
                  value={departRef}
                  onChange={e => setDepartRef(e.target.value)}
                  size="small"
                  placeholder="e.g. H001"
                  required
                />
                <Button data-testid="depart-btn" type="submit" variant="contained" disabled={departing}>
                  Mark Departed
                </Button>
              </Box>
              {departResult && <Alert data-testid="depart-result" severity="success" sx={{ mt: 1 }}>{departResult}</Alert>}
              {departError  && <Alert data-testid="depart-error"  severity="error"   sx={{ mt: 1 }}>{departError}</Alert>}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('privacy.sweepTitle')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Permanently deletes contacts whose retention period has expired.
              </Typography>
              <Button
                data-testid="purge-btn"
                variant="contained"
                color="error"
                onClick={handlePurge}
                disabled={purging}
              >
                Purge Expired Contacts
              </Button>
              {purgeResult !== undefined && (
                <Alert data-testid="purge-result" severity="success" sx={{ mt: 1 }}>
                  {purgeResult.deleted} contact(s) purged.
                </Alert>
              )}
              {purgeError && <Alert data-testid="purge-error" severity="error" sx={{ mt: 1 }}>{purgeError}</Alert>}
            </CardContent>
          </Card>
        </>
      )}

    </Box>
  );
}
