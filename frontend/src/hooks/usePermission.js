import useAuthStore from '../stores/authStore';

/**
 * Hook for checking permissions in components.
 *
 * Usage:
 *   const { can, canAny } = usePermission();
 *   if (can('inventory.product.create')) { ... }
 *   if (canAny('hr.timesheet.approve', 'hr.timesheet.execute')) { ... }
 */
export function usePermission() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  return {
    can: hasPermission,
    canAny: (...perms) => hasAnyPermission(...perms),
  };
}
