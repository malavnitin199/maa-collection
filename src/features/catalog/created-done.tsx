'use client';

import { useEffect, useState } from 'react';
import { DoneOverlay, type DoneLine } from '@/features/feedback/effects';
import { feedback } from '@/features/feedback/sounds';

/** The tags page just after a save: the done card with what was saved (shown once, closes by itself). */
export function CreatedDone({ title, lines }: { title: string; lines: DoneLine[] }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    feedback('done');
  }, []);
  if (!open) return null;
  return <DoneOverlay title={title} lines={lines} onClose={() => setOpen(false)} />;
}
