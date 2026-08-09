import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AdminContact } from '../types';
import { isValidEmail } from '../utils/validation';

interface Props {
  open: boolean;
  saving: boolean;
  householdRef: string;
  form: AdminContact;
  onChange: (updated: AdminContact) => void;
  onSave: () => void;
  onClose: () => void;
}

const AdminEditDialog: React.FC<Props> = ({
  open, saving, householdRef, form, onChange, onSave, onClose,
}) => {
  const { t } = useTranslation();
  const set = (field: keyof AdminContact, value: string | boolean) =>
    onChange({ ...form, [field]: value });
  const emailInvalid = !isValidEmail(form.email ?? '');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>{t('dialog.editResidentTitle', { ref: householdRef })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label={t('common.displayName')}
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label={t('common.phone')}
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label={t('common.email')}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            fullWidth size="small"
            error={emailInvalid}
            helperText={emailInvalid ? t('common.emailInvalid') : undefined}
          />
          <TextField
            label={t('common.notes')}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder={t('dialog.adminNotesPlaceholder')}
            fullWidth size="small"
            multiline rows={3}
          />
          <Divider />
          <FormControlLabel
            control={
              <Switch
                checked={form.isOptedOut}
                onChange={e => set('isOptedOut', e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t('dialog.optedOutOfDirectory')}
              </Typography>
            }
            labelPlacement="start"
            sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>{t('common.cancel')}</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={saving || emailInvalid}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdminEditDialog;
