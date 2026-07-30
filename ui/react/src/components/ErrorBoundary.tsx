import React from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props extends WithTranslation { children: React.ReactNode; }
interface State { error: Error | null; }

/**
 * App-level error boundary. Prevents a single component crash from blanking the
 * whole screen, and logs the *real* error stack + component stack to the console
 * (the un-minified error object, not the degraded bundle source map).
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log the raw error stack (not React's collapsed owner stack) plus the
    // component stack, so any future crash points at the real frame.
    // eslint-disable-next-line no-console
    console.error(
      '[Harmonia] Uncaught render error:\n' +
        (error.stack || String(error)) +
        '\nComponent stack:' +
        (info.componentStack || ' (none)'),
    );
  }

  render() {
    const { t } = this.props;
    if (this.state.error) {
      return (
        <Box sx={{ maxWidth: 720, mx: 'auto', mt: 8, px: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                {t('errorBoundary.reload')}
              </Button>
            }
          >
            <AlertTitle>{t('errorBoundary.title')}</AlertTitle>
            {this.state.error.message}
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
