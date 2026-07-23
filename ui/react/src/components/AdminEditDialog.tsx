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
import { AdminContact } from '../types';

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
  const set = (field: keyof AdminContact, value: string | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>Edit Resident — {householdRef}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Display Name"
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label="Notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Internal notes — not visible to resident"
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
                Opted out of directory
              </Typography>
            }
            labelPlacement="start"
            sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
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

export default AdminEditDialog;
