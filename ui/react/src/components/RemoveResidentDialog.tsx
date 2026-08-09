import React from 'react';
import {
  Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  householdRef: string;
  removing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const RemoveResidentDialog: React.FC<Props> = ({
  open, householdRef, removing, onConfirm, onClose,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={removing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.removeResidentTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Trans
            i18nKey="dialog.removeResidentBody"
            values={{ ref: householdRef }}
            components={{ b: <strong /> }}
          />
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={removing}>{t('common.cancel')}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={removing}
          startIcon={removing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {removing ? t('dialog.removing') : t('dialog.removeResident')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoveResidentDialog;
