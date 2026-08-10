import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getHistory, sendAnnouncement, subscribeToPush, unsubscribeFromPush } from '../api/notifications';
import { NotificationRecordDto } from '../types';

type PushStatus = 'checking' | 'subscribed' | 'not-subscribed' | 'unsupported' | 'denied';

async function getPushStatus(): Promise<PushStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'not-subscribed';
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString();
}

interface Props {
  role: 'resident' | 'admin';
}

export default function NotificationsScreen({ role }: Props) {
  const { t } = useTranslation();
  const [history, setHistory]             = useState<NotificationRecordDto[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]     = useState<string>('');
  const [submitting, setSubmitting]       = useState(false);
  const [pushStatus, setPushStatus]       = useState<PushStatus>('checking');
  const [pushBusy, setPushBusy]           = useState(false);
  const [pushError, setPushError]         = useState<string>('');

  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHistory(await getHistory());
    } catch {
      setError(t('notifications.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => { getPushStatus().then(setPushStatus); }, []);

  const handleSubscribe = async () => {
    setPushBusy(true);
    setPushError('');
    try {
      await subscribeToPush();
      setPushStatus('subscribed');
    } catch {
      setPushError(t('notifications.errSubscribe'));
    } finally {
      setPushBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    setPushBusy(true);
    setPushError('');
    try {
      await unsubscribeFromPush();
      setPushStatus('not-subscribed');
    } catch {
      setPushError(t('notifications.errUnsubscribe'));
    } finally {
      setPushBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError('');
    if (!title || !body) {
      setSubmitError(t('notifications.errRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await sendAnnouncement({ title, body });
      setSubmitSuccess(true);
      setTitle('');
      setBody('');
      await loadHistory();
    } catch {
      setSubmitError(t('notifications.errSend'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {role === 'admin' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('notifications.send')}</Typography>
            <Box
              component="form"
              data-testid="announce-form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label={t('notifications.title')}
                slotProps={{ htmlInput: { 'aria-label': t('notifications.title') } }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                size="small"
                placeholder={t('notifications.titlePlaceholder')}
              />
              <TextField
                label={t('notifications.body')}
                slotProps={{ htmlInput: { 'aria-label': t('notifications.body') } }}
                value={body}
                onChange={e => setBody(e.target.value)}
                required
                size="small"
                multiline
                rows={3}
                placeholder={t('notifications.bodyPlaceholder')}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button data-testid="submit-btn" type="submit" variant="contained" disabled={submitting}>
                  {t('notifications.send')}
                </Button>
                {submitSuccess && <Alert data-testid="submit-success" severity="success">{t('notifications.sent')}</Alert>}
                {submitError  && <Alert data-testid="submit-error"   severity="error">{submitError}</Alert>}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {pushStatus !== 'unsupported' && pushStatus !== 'checking' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('notifications.pushTitle')}</Typography>
            {pushStatus === 'denied' ? (
              <Alert severity="warning">{t('notifications.pushDenied')}</Alert>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {pushStatus === 'subscribed' ? t('notifications.pushEnabled') : t('notifications.pushDisabled')}
                </Typography>
                {pushStatus === 'subscribed' ? (
                  <Button variant="outlined" size="small" disabled={pushBusy} onClick={handleUnsubscribe}>
                    {t('notifications.pushDisableBtn')}
                  </Button>
                ) : (
                  <Button variant="contained" size="small" disabled={pushBusy} onClick={handleSubscribe}>
                    {t('notifications.pushEnableBtn')}
                  </Button>
                )}
                {pushError && <Alert severity="error" sx={{ py: 0 }}>{pushError}</Alert>}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('notifications.history')}</Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <Alert severity="error">{error}</Alert>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadHistory}>{t('common.retry')}</Button>
          </Box>
        )}

        {!loading && !error && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('notifications.sentAt')}</TableCell>
                <TableCell>{t('notifications.title')}</TableCell>
                <TableCell>{t('notifications.channel')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    {t('notifications.none')}
                  </TableCell>
                </TableRow>
              ) : (
                history.map(n => (
                  <TableRow key={n.id} data-testid={`notification-row-${n.id}`}>
                    <TableCell>{formatDate(n.sentAt)}</TableCell>
                    <TableCell>{n.title}</TableCell>
                    <TableCell>{n.channel}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
