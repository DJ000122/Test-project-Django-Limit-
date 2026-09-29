'use client';

import InboxOutlined from '@mui/icons-material/InboxOutlined';
import { Alert, Box, Button, Skeleton, TableCell, TableRow, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/errors';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
      <InboxOutlined sx={{ fontSize: 40, mb: 1, opacity: 0.6 }} />
      <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
        {title}
      </Typography>
      {description && <Typography variant="body2">{description}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export function SkeletonRows({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function FullWidthRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} sx={{ borderBottom: 0 }}>
        {children}
      </TableCell>
    </TableRow>
  );
}
