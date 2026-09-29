import { Suspense } from 'react';
import MechanicsView from './MechanicsView';

export const metadata = { title: 'Mechanics' };

export default function MechanicsPage() {
  return (
    <Suspense>
      <MechanicsView />
    </Suspense>
  );
}
