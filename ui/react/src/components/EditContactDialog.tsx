import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Stack,
  Typography,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MyContact } from '../types';

interface Props {
  open: boolean;
  saving: boolean;
  form: MyContact;
  onChange: (updated: MyContact) => void;
  onSave: () => void;
  onClose: () => void;
  onRequestErase: () => void;
}

const EditContactDialog: React.FC<Props> = ({ open, saving, form, onChange, onSave, onClose, onRequestErase }) => {
  const { t } = useTranslation();
  const set = (field: keyof MyContact, value: string | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>{t('dialog.myProfileTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label={t('common.displayName')}
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            placeholder={t('dialog.nameHelp')}
            fullWidth
            size="small"
          />
          <TextField
            label={t('common.phone')}
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder={t('dialog.phonePlaceholder')}
            fullWidth
            size="small"
          />
          <TextField
            label={t('common.email')}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder={t('dialog.emailPlaceholder')}
            fullWidth
            size="small"
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
              <span>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('dialog.hideFromDirectory')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dialog.hideFromDirectoryHelp')}
                </Typography>
              </span>
            }
            labelPlacement="start"
            sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onRequestErase} color="error" disabled={saving} sx={{ mr: 'auto' }}>
          {t('dialog.deleteMine')}
        </Button>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditContactDialog;
