import React from 'react';
import {
  Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';

interface Props {
  open: boolean;
  erasing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const EraseMyContactDialog: React.FC<Props> = ({ open, erasing, onConfirm, onClose }) => (
  <Dialog open={open} onClose={erasing ? undefined : onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Delete my data?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        All your contact information will be <strong>permanently deleted</strong>.
        This cannot be undone.
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
        {erasing ? 'Deleting…' : 'Delete my data'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default EraseMyContactDialog;
