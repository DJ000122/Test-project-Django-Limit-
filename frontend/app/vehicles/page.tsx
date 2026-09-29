import { Suspense } from 'react';
import VehiclesView from './VehiclesView';

export const metadata = { title: 'Vehicles' };

export default function VehiclesPage() {
  // useSearchParams() inside needs a Suspense boundary for production builds.
  return (
    <Suspense>
      <VehiclesView />
    </Suspense>
  );
}
