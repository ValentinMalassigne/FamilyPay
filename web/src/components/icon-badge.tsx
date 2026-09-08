import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Boîte neutre (fond muted, icône centrée) pour les avatars et illustrations
// icône. L'icône est choisie par l'appelant ; la forme (rounded-full, size…)
// se pilote via className.
export function IconBadge({
  icon: Icon,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className={cn('size-1/2 max-w-8 max-h-8', iconClassName)} />
    </div>
  );
}
