'use client';

import MoreVert from '@mui/icons-material/MoreVert';
import { IconButton, ListItemText, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';

export default function RowActions({
  label,
  actions,
}: {
  label: string;
  actions: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions for ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a) => (
          <MenuItem
            key={a.label}
            disabled={a.disabled}
            onClick={() => {
              setAnchor(null);
              a.onClick();
            }}
            sx={a.danger ? { color: 'error.main' } : undefined}
          >
            <ListItemText>{a.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
