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
import { MyContact } from '../types';

interface Props {
  open: boolean;
  saving: boolean;
  form: MyContact;
  onChange: (updated: MyContact) => void;
  onSave: () => void;
  onClose: () => void;
}

const EditContactDialog: React.FC<Props> = ({ open, saving, form, onChange, onSave, onClose }) => {
  const set = (field: keyof MyContact, value: string | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>My Profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Display Name"
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            placeholder="Your name as shown to neighbours"
            fullWidth
            size="small"
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+359 88 …"
            fullWidth
            size="small"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="you@example.com"
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
                  Hide me from the directory
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, your name will not appear to other residents.
                </Typography>
              </span>
            }
            labelPlacement="start"
            sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditContactDialog;
