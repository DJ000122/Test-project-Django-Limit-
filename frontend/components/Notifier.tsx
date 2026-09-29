'use client';

import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';

type Notice = { id: number; message: string; severity: AlertColor };
type Notify = (message: string, severity?: AlertColor) => void;

const NotifierContext = createContext<Notify>(() => {});

export function NotifierProvider({ children }: PropsWithChildren) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback<Notify>(
    (message, severity = 'success') => setNotice({ id: Date.now(), message, severity }),
    [],
  );

  return (
    <NotifierContext.Provider value={notify}>
      {children}
      <Snackbar
        key={notice?.id}
        open={notice !== null}
        autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notice?.severity ?? 'info'}
          variant="filled"
          onClose={() => setNotice(null)}
          sx={{ minWidth: 320 }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </NotifierContext.Provider>
  );
}

export const useNotify = () => useContext(NotifierContext);
