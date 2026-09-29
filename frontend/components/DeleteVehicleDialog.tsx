'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { keys } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';
import ConfirmDialog from './ConfirmDialog';
import { useNotify } from './Notifier';

export default function DeleteVehicleDialog({
  vehicle,
  hasHistory,
  onClose,
  onDeleted,
}: {
  vehicle: Pick<Vehicle, 'id' | 'license_plate' | 'active'> | null;
  hasHistory: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const deactivate = hasHistory;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vehicle) return;
      if (deactivate) await api.updateVehicle(vehicle.id, { active: false });
      else await api.deleteVehicle(vehicle.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.vehicles });
      queryClient.invalidateQueries({ queryKey: keys.offices });
      notify(
        deactivate ? `${vehicle?.license_plate} deactivated` : `${vehicle?.license_plate} deleted`,
      );
      if (!deactivate) onDeleted?.();
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <ConfirmDialog
      open={vehicle !== null}
      title={
        deactivate ? `Deactivate ${vehicle?.license_plate}?` : `Delete ${vehicle?.license_plate}?`
      }
      body={
        deactivate
          ? 'This vehicle has maintenance history, which is kept for reporting, so it cannot be deleted. Deactivating removes it from the active fleet and frees its license plate.'
          : 'This vehicle has no maintenance history. It will be permanently removed.'
      }
      confirmLabel={deactivate ? 'Deactivate' : 'Delete'}
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
