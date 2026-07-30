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
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  householdRef: string;
  departing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const MarkDepartedDialog: React.FC<Props> = ({
  open, householdRef, departing, onConfirm, onClose,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={departing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.markDepartedTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Apartment <strong>{householdRef}</strong> will be removed from the active directory.
          This cannot be undone from this screen.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={departing}>{t('common.cancel')}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={departing}
          startIcon={departing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {departing ? t('dialog.marking') : t('dialog.markDeparted')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarkDepartedDialog;
