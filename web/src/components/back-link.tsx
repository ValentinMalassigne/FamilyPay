import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lien "Retour" stylisé comme un bouton fantôme avec une flèche gauche.
// Remplace tous les liens `← Retour` inline des pages.
export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit', className)}
    >
      <ArrowLeft />
      {children ?? 'Retour'}
    </Link>
  );
}
