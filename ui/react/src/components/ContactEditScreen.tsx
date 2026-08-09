import React, { useState, useEffect } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress,
  FormControlLabel, TextField, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { updateMyContact, getMyContact, linkMyHousehold } from '../api/contactEdit';
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

  // Admin self-link state (undefined = checking, true = linked, false = not linked)
  const [adminLinked, setAdminLinked]     = useState<boolean | undefined>(undefined);
  const [linkRef, setLinkRef]             = useState('');
  const [linkRole, setLinkRole]           = useState<'Owner' | 'Renter'>('Owner');
  const [linking, setLinking]             = useState(false);
  const [linkError, setLinkError]         = useState<string>('');

  useEffect(() => {
    setContact(undefined);
    setEditing(false);
    setAdminLinked(undefined);
    getMyContact()
      .then(c => {
        setAdminLinked(true);
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
      .catch((e: any) => {
        if (e?.status === 403) {
          setAdminLinked(false);
        } else {
          setAdminLinked(true);
          setContact(null);
          setEditing(true);
        }
      });
  }, [role]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');
    setLinking(true);
    try {
      await linkMyHousehold(linkRef, linkRole);
      // Re-fetch contact now that the link exists
      const c = await getMyContact();
      setAdminLinked(true);
      setContact(c);
      if (c === null) {
        setEditing(true);
      } else {
        setMyDisplayName(c.displayName ?? '');
        setMyPhone(c.phone ?? '');
        setMyEmail(c.email ?? '');
        setMyOptedOut(c.isOptedOut);
      }
    } catch (err: any) {
      if (err?.status === 409) setLinkError(t('contactEdit.alreadyLinked'));
      else setLinkError(t('contactEdit.linkFailed'));
    } finally {
      setLinking(false);
    }
  };

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

      {role === 'admin' && adminLinked === undefined && (
        <CircularProgress size={24} />
      )}

      {role === 'admin' && adminLinked === false && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('contactEdit.linkTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('contactEdit.linkSubtitle')}</Typography>
            {linkError && <Alert severity="error" sx={{ mb: 2 }}>{linkError}</Alert>}
            <Box component="form" onSubmit={handleLink} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('common.householdRef')}
                value={linkRef}
                onChange={e => setLinkRef(e.target.value)}
                size="small"
                placeholder={t('adminPending.refPlaceholder')}
                required
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                {(['Owner', 'Renter'] as const).map(r => (
                  <Button
                    key={r}
                    variant={linkRole === r ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setLinkRole(r)}
                    type="button"
                  >
                    {t(r === 'Owner' ? 'adminPending.roleOwner' : 'adminPending.roleRenter')}
                  </Button>
                ))}
              </Box>
              <Button type="submit" variant="contained" disabled={!linkRef || linking} sx={{ alignSelf: 'flex-start' }}>
                {t('contactEdit.linkBtn')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {role === 'admin' && adminLinked === true && (
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

            {contact === undefined && <CircularProgress size={24} />}

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
              <Box component="form" data-testid="my-contact-form" onSubmit={handleMyContact} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('common.displayName')} slotProps={{ htmlInput: { 'data-testid': 'my-name-input' } }} value={myDisplayName} onChange={e => setMyDisplayName(e.target.value)} size="small" fullWidth />
                <TextField label={t('common.phone')} slotProps={{ htmlInput: { 'data-testid': 'my-phone-input' } }} value={myPhone} onChange={e => setMyPhone(e.target.value)} size="small" fullWidth />
                <TextField label={t('common.email')} slotProps={{ htmlInput: { 'data-testid': 'my-email-input' } }} type="email" value={myEmail} onChange={e => setMyEmail(e.target.value)} size="small" fullWidth />
                <FormControlLabel control={<Checkbox data-testid="my-opted-out" checked={myOptedOut} onChange={e => setMyOptedOut(e.target.checked)} />} label={t('contactEdit.optOut')} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button data-testid="my-contact-btn" type="submit" variant="contained" disabled={mySaving} sx={{ alignSelf: 'flex-start' }}>{t('contactEdit.saveChanges')}</Button>
                  {contact !== null && <Button variant="outlined" onClick={() => setEditing(false)} sx={{ alignSelf: 'flex-start' }}>{t('common.cancel')}</Button>}
                </Box>
              </Box>
            )}

            {mySuccess && <Alert data-testid="my-contact-success" severity="success" sx={{ mt: 1 }}>{t('contactEdit.saved')}</Alert>}
            {myError  && <Alert data-testid="my-contact-error"   severity="error"   sx={{ mt: 1 }}>{myError}</Alert>}
          </CardContent>
        </Card>
      )}

    </Box>
  );
}
