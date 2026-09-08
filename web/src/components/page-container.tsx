import { cn } from '@/lib/utils';

// Wrapper de largeur maximale centré, utilisé par toutes les pages pour
// garantir un espacement cohérent. Remplace les `style={{ padding: '2rem' }}`
// inline des pages originales.
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={cn('mx-auto max-w-4xl px-4 py-8', className)}>
      {children}
    </main>
  );
}
