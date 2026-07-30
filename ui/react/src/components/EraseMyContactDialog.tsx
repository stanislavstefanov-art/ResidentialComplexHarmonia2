import React from 'react';
import {
  Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  erasing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const EraseMyContactDialog: React.FC<Props> = ({ open, erasing, onConfirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={erasing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.eraseMineTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          All your contact information will be <strong>{t('dialog.permanentlyDeleted')}</strong>.
          This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={erasing}>{t('common.cancel')}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={erasing}
          startIcon={erasing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {erasing ? t('dialog.deleting') : t('dialog.deleteMine')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EraseMyContactDialog;
