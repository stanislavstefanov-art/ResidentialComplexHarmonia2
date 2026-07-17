import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getHistory, sendAnnouncement } from '../api/notifications';
import { NotificationRecordDto } from '../types';

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString();
}

interface Props {
  role: 'resident' | 'admin';
}

export default function NotificationsScreen({ role }: Props) {
  const [history, setHistory]             = useState<NotificationRecordDto[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await getHistory());
    } catch {
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError(null);
    if (!title || !body) {
      setSubmitError('Title and body are required.');
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
      setSubmitError('Could not send announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {role === 'admin' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Send Announcement</Typography>
            <Box
              component="form"
              data-testid="announce-form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label="Title"
                inputProps={{ 'aria-label': 'Title' }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                size="small"
                placeholder="Announcement title"
              />
              <TextField
                label="Body"
                inputProps={{ 'aria-label': 'Body' }}
                value={body}
                onChange={e => setBody(e.target.value)}
                required
                size="small"
                multiline
                rows={3}
                placeholder="Message body"
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button data-testid="submit-btn" type="submit" variant="contained" disabled={submitting}>
                  Send Announcement
                </Button>
                {submitSuccess && <Alert data-testid="submit-success" severity="success">Announcement sent.</Alert>}
                {submitError  && <Alert data-testid="submit-error"   severity="error">{submitError}</Alert>}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Notification History</Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <Alert severity="error">{error}</Alert>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadHistory}>Retry</Button>
          </Box>
        )}

        {!loading && !error && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sent</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Channel</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    No notifications on record.
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
