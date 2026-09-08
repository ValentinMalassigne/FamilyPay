import { Image as ImageIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Placeholder neutre pour les emplacements d'image (logo, avatar, illustration).
// TODO: replace with actual image
export function ImagePlaceholder({
  className,
  iconClassName,
}: {
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
      <ImageIcon className={cn('size-1/2 max-w-8 max-h-8', iconClassName)} />
    </div>
  );
}
