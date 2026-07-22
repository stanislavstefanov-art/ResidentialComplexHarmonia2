import React from 'react';
import {
  Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';

interface Props {
  open: boolean;
  householdRef: string;
  erasing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const EraseContactDialog: React.FC<Props> = ({ open, householdRef, erasing, onConfirm, onClose }) => (
  <Dialog open={open} onClose={erasing ? undefined : onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Erase contact data?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        All data for apartment <strong>{householdRef}</strong> will be{' '}
        <strong>permanently deleted</strong>. This cannot be undone.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit" disabled={erasing}>Cancel</Button>
      <Button
        onClick={onConfirm}
        variant="contained"
        color="error"
        disabled={erasing}
        startIcon={erasing ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {erasing ? 'Erasing…' : 'Erase contact'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default EraseContactDialog;
