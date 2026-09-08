import type { VariantProps } from 'class-variance-authority';

import { Badge, type badgeVariants } from '@/components/ui/badge';

// Mappe un statut métier (mission, carte, cagnotte, virement) à une variante
// de Badge. Centralise la logique de couleur auparavant dupliquée inline.
const STATUS_VARIANT: Record<
  string,
  VariantProps<typeof badgeVariants>['variant']
> = {
  // Missions
  PENDING: 'secondary',
  DONE_BY_CHILD: 'warning',
  VALIDATED: 'success',
  REJECTED: 'destructive',
  // Cagnottes
  OPEN: 'secondary',
  CLOSED: 'outline',
  // Carte
  BLOCKED: 'destructive',
  ACTIVE: 'success',
  // Virements automatiques
  SUSPENDED: 'secondary',
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>
      {label ?? status}
    </Badge>
  );
}
