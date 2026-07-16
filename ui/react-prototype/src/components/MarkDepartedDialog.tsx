import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface Props {
  open: boolean;
  householdRef: string;
  departing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const MarkDepartedDialog: React.FC<Props> = ({
  open, householdRef, departing, onConfirm, onClose,
}) => (
  <Dialog open={open} onClose={departing ? undefined : onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Mark as Departed?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Apartment <strong>{householdRef}</strong> will be removed from the active directory.
        This cannot be undone from this screen.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit" disabled={departing}>Cancel</Button>
      <Button
        onClick={onConfirm}
        variant="contained"
        color="error"
        disabled={departing}
        startIcon={departing ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {departing ? 'Marking…' : 'Mark Departed'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default MarkDepartedDialog;
