import React, { useState, useEffect } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress,
  FormControlLabel, TextField, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { updateMyContact, updateContact, updateNotes, getMyContact } from '../api/contactEdit';
import type { MyContactDto } from '../api/contactEdit';

interface Props {
  role: 'resident' | 'admin';
}

export default function ContactEditScreen({ role }: Props) {
  const { t } = useTranslation();

  // Resident — read/edit toggle
  // undefined = still loading, null = no row yet / load failed, MyContactDto = loaded
  const [contact, setContact]         = useState<MyContactDto | null | undefined>(undefined);
  const [editing, setEditing]         = useState(false);
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myPhone, setMyPhone]             = useState('');
  const [myEmail, setMyEmail]             = useState('');
  const [myOptedOut, setMyOptedOut]       = useState(false);
  const [mySaving, setMySaving]           = useState(false);
  const [mySuccess, setMySuccess]         = useState(false);
  const [myError, setMyError]             = useState<string>('');

  // Admin state
  const [adminRef, setAdminRef]           = useState('');
  const [adminName, setAdminName]         = useState('');
  const [adminPhone, setAdminPhone]       = useState('');
  const [adminEmail, setAdminEmail]       = useState('');
  const [adminOptedOut, setAdminOptedOut] = useState(false);
  const [adminSaving, setAdminSaving]     = useState(false);
  const [adminSuccess, setAdminSuccess]   = useState(false);
  const [adminError, setAdminError]       = useState<string>('');

  const [notesRef, setNotesRef]           = useState('');
  const [notesText, setNotesText]         = useState('');
  const [notesSaving, setNotesSaving]     = useState(false);
  const [notesSuccess, setNotesSuccess]   = useState(false);
  const [notesError, setNotesError]       = useState<string>('');

  useEffect(() => {
    if (role !== 'resident') return;
    setContact(undefined);
    setEditing(false);
    getMyContact()
      .then(c => {
        setContact(c);
        if (c === null) {
          setEditing(true);
        } else {
          setMyDisplayName(c.displayName ?? '');
          setMyPhone(c.phone ?? '');
          setMyEmail(c.email ?? '');
          setMyOptedOut(c.isOptedOut);
        }
      })
      .catch(() => { setContact(null); setEditing(true); });
  }, [role]);

  const enterEdit = () => {
    if (contact) {
      setMyDisplayName(contact.displayName ?? '');
      setMyPhone(contact.phone ?? '');
      setMyEmail(contact.email ?? '');
      setMyOptedOut(contact.isOptedOut);
    }
    setMySuccess(false);
    setMyError('');
    setEditing(true);
  };

  const handleMyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setMySuccess(false); setMyError(''); setMySaving(true);
    try {
      await updateMyContact({
        displayName: myDisplayName || null,
        phone: myPhone || null,
        email: myEmail || null,
        optedOut: myOptedOut,
      });
      const updated: MyContactDto = {
        displayName: myDisplayName || null,
        phone: myPhone || null,
        email: myEmail || null,
        isOptedOut: myOptedOut,
      };
      setContact(updated);
      setMySuccess(true);
      setEditing(false);
    } catch {
      setMyError(t('contactEdit.errSave'));
    } finally {
      setMySaving(false);
    }
  };

  const handleAdminContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSuccess(false); setAdminError(''); setAdminSaving(true);
    try {
      await updateContact(adminRef, {
        displayName: adminName || null,
        phone: adminPhone || null,
        email: adminEmail || null,
        optedOut: adminOptedOut,
      });
      setAdminSuccess(true);
    } catch {
      setAdminError(t('contactEdit.errUpdate'));
    } finally {
      setAdminSaving(false);
    }
  };

  const handleNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotesSuccess(false); setNotesError(''); setNotesSaving(true);
    try {
      await updateNotes(notesRef, notesText || null);
      setNotesSuccess(true);
    } catch {
      setNotesError(t('contactEdit.errNotes'));
    } finally {
      setNotesSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {role === 'resident' && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('contactEdit.myTitle')}</Typography>
              {!editing && contact != null && (
                <Button size="small" startIcon={<EditIcon />} onClick={enterEdit}>
                  {t('common.edit')}
                </Button>
              )}
            </Box>

            {contact === undefined && (
              <CircularProgress size={24} />
            )}

            {contact !== undefined && !editing && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('common.displayName')}</Typography>
                  <Typography variant="body2">{contact?.displayName ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('common.phone')}</Typography>
                  <Typography variant="body2">{contact?.phone ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('common.email')}</Typography>
                  <Typography variant="body2">{contact?.email ?? '—'}</Typography>
                </Box>
                <FormControlLabel
                  control={<Checkbox checked={contact?.isOptedOut ?? false} disabled size="small" />}
                  label={<Typography variant="body2">{t('contactEdit.optOut')}</Typography>}
                />
              </Box>
            )}

            {contact !== undefined && editing && (
              <Box
                component="form"
                data-testid="my-contact-form"
                onSubmit={handleMyContact}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <TextField
                  label={t('common.displayName')}
                  slotProps={{ htmlInput: { 'data-testid': 'my-name-input' } }}
                  value={myDisplayName}
                  onChange={e => setMyDisplayName(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={t('common.phone')}
                  slotProps={{ htmlInput: { 'data-testid': 'my-phone-input' } }}
                  value={myPhone}
                  onChange={e => setMyPhone(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={t('common.email')}
                  slotProps={{ htmlInput: { 'data-testid': 'my-email-input' } }}
                  type="email"
                  value={myEmail}
                  onChange={e => setMyEmail(e.target.value)}
                  size="small"
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      data-testid="my-opted-out"
                      checked={myOptedOut}
                      onChange={e => setMyOptedOut(e.target.checked)}
                    />
                  }
                  label={t('contactEdit.optOut')}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button data-testid="my-contact-btn" type="submit" variant="contained" disabled={mySaving} sx={{ alignSelf: 'flex-start' }}>
                    {t('contactEdit.saveChanges')}
                  </Button>
                  {contact !== null && (
                    <Button variant="outlined" onClick={() => setEditing(false)} sx={{ alignSelf: 'flex-start' }}>
                      {t('common.cancel')}
                    </Button>
                  )}
                </Box>
              </Box>
            )}

            {mySuccess && <Alert data-testid="my-contact-success" severity="success" sx={{ mt: 1 }}>{t('contactEdit.saved')}</Alert>}
            {myError  && <Alert data-testid="my-contact-error"   severity="error"   sx={{ mt: 1 }}>{myError}</Alert>}
          </CardContent>
        </Card>
      )}

      {role === 'admin' && (
        <>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('contactEdit.updateContact')}</Typography>
              <Box
                component="form"
                data-testid="admin-contact-form"
                onSubmit={handleAdminContact}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <TextField
                  label={t('common.householdRef')}
                  slotProps={{ htmlInput: { 'data-testid': 'admin-ref-input' } }}
                  value={adminRef}
                  onChange={e => setAdminRef(e.target.value)}
                  size="small"
                  placeholder="e.g. H001"
                  required
                  fullWidth
                />
                <TextField label={t('common.displayName')} slotProps={{ htmlInput: { 'data-testid': 'admin-name-input' } }} value={adminName} onChange={e => setAdminName(e.target.value)} size="small" fullWidth />
                <TextField label={t('common.phone')} slotProps={{ htmlInput: { 'data-testid': 'admin-phone-input' } }} value={adminPhone} onChange={e => setAdminPhone(e.target.value)} size="small" fullWidth />
                <TextField label={t('common.email')} slotProps={{ htmlInput: { 'data-testid': 'admin-email-input' } }} type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} size="small" fullWidth />
                <FormControlLabel
                  control={<Checkbox data-testid="admin-opted-out" checked={adminOptedOut} onChange={e => setAdminOptedOut(e.target.checked)} />}
                  label={t('contactEdit.optedOut')}
                />
                <Button data-testid="admin-contact-btn" type="submit" variant="contained" disabled={adminSaving} sx={{ alignSelf: 'flex-start' }}>
                  {t('contactEdit.updateContactBtn')}
                </Button>
              </Box>
              {adminSuccess && <Alert data-testid="admin-contact-success" severity="success" sx={{ mt: 1 }}>{t('contactEdit.contactUpdated')}</Alert>}
              {adminError  && <Alert data-testid="admin-contact-error"   severity="error"   sx={{ mt: 1 }}>{adminError}</Alert>}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('contactEdit.updateNotes')}</Typography>
              <Box
                component="form"
                data-testid="notes-form"
                onSubmit={handleNotes}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <TextField
                  label={t('common.householdRef')}
                  slotProps={{ htmlInput: { 'data-testid': 'notes-ref-input' } }}
                  value={notesRef}
                  onChange={e => setNotesRef(e.target.value)}
                  size="small"
                  placeholder="e.g. H001"
                  required
                  fullWidth
                />
                <TextField
                  label={t('common.notes')}
                  slotProps={{ htmlInput: { 'data-testid': 'notes-text-input' } }}
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  size="small"
                  multiline
                  rows={3}
                  fullWidth
                />
                <Button data-testid="notes-btn" type="submit" variant="contained" disabled={notesSaving} sx={{ alignSelf: 'flex-start' }}>
                  {t('contactEdit.updateNotes')}
                </Button>
              </Box>
              {notesSuccess && <Alert data-testid="notes-success" severity="success" sx={{ mt: 1 }}>{t('contactEdit.notesUpdated')}</Alert>}
              {notesError  && <Alert data-testid="notes-error"   severity="error"   sx={{ mt: 1 }}>{notesError}</Alert>}
            </CardContent>
          </Card>
        </>
      )}

    </Box>
  );
}
