import React from 'react';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DirectoryList from './components/DirectoryList';

const theme = createTheme({
  palette: {
    primary: { main: '#2e6b4f' },
    background: { default: '#f5f5f0' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <HomeIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
            Harmonia
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Resident Portal
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 2, py: 4 }}>
        <DirectoryList />
      </Box>
    </ThemeProvider>
  );
}

export default App;
