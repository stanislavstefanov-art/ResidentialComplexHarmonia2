import React, { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel,
  TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { updateMyContact, updateContact, updateNotes } from '../api/contactEdit';

interface Props {
  role: 'resident' | 'admin';
}

export default function ContactEditScreen({ role }: Props) {
  const { t } = useTranslation();
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myPhone, setMyPhone]             = useState('');
  const [myEmail, setMyEmail]             = useState('');
  const [myOptedOut, setMyOptedOut]       = useState(false);
  const [mySaving, setMySaving]           = useState(false);
  const [mySuccess, setMySuccess]         = useState(false);
  const [myError, setMyError]             = useState<string>('');

  const [adminRef, setAdminRef]             = useState('');
  const [adminName, setAdminName]           = useState('');
  const [adminPhone, setAdminPhone]         = useState('');
  const [adminEmail, setAdminEmail]         = useState('');
  const [adminOptedOut, setAdminOptedOut]   = useState(false);
  const [adminSaving, setAdminSaving]       = useState(false);
  const [adminSuccess, setAdminSuccess]     = useState(false);
  const [adminError, setAdminError]         = useState<string>('');

  const [notesRef, setNotesRef]       = useState('');
  const [notesText, setNotesText]     = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  const [notesError, setNotesError]   = useState<string>('');

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
      setMySuccess(true);
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
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('contactEdit.myTitle')}</Typography>
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
              <Button data-testid="my-contact-btn" type="submit" variant="contained" disabled={mySaving} sx={{ alignSelf: 'flex-start' }}>
                Save Changes
              </Button>
            </Box>
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
                  Update Contact
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
                  Update Notes
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
