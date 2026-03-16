'use client';

import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { palette, typography, shadows, shape } from './themePrimitives';
import {
  surfacesCustomizations,
  inputsCustomizations,
  dataDisplayCustomizations,
  dataGridCustomizations,
  feedbackCustomizations,
  navigationCustomizations,
} from './customizations';

const baseTheme = createTheme({
  cssVariables: {
    cssVarPrefix: 'template',
  },
  palette,
  typography,
  shadows,
  shape,
  components: {
    ...surfacesCustomizations,
    ...inputsCustomizations,
    ...dataDisplayCustomizations,
    ...dataGridCustomizations,
    ...feedbackCustomizations,
    ...navigationCustomizations,
  },
});

export default function AppTheme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={baseTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
