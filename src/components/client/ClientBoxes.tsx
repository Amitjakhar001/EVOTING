// src/components/client/ClientBoxes.tsx
'use client';

import dynamic from 'next/dynamic';

const Boxes = dynamic(
  () => import('@/components/ui/background-boxes').then(mod => mod.Boxes),
  { ssr: false }
);

export default function ClientBoxes() {
  return <Boxes />;
}