'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { SET_CARD_BLOCKED_MUTATION, type BlockActor } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/status-badge';
import { BackLink } from '@/components/back-link';

// Bouton de blocage/déblocage de carte (Client Component).
//
// Un parent peut toujours bloquer/débloquer (règle métier backend : parent
// prioritaire quel que soit blockedBy). Après la mutation, router.refresh()
// recharge la page (Server Component) pour réafficher l'état à jour.
//
// On reçoit l'état initial (blocked, blockedBy) côté serveur ; après une
// mutation on s'appuie sur router.refresh plutôt que sur l'état local, pour
// rester cohérent avec la donnée backend.
export function CardBlockToggle({
  params,
  initialBlocked,
  initialBlockedBy,
}: {
  params: Promise<{ childId: string }>;
  initialBlocked: boolean;
  initialBlockedBy: BlockActor | null;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [blocked, setBlocked] = useState(initialBlocked);
  const [error, setError] = useState<string | null>(null);
  const [setCardBlocked, { loading }] = useMutation(
    gql(SET_CARD_BLOCKED_MUTATION),
  );

  async function toggle() {
    setError(null);
    const next = !blocked;
    try {
      await setCardBlocked({ variables: { childId, blocked: next } });
      setBlocked(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-lg">
            <span className="text-muted-foreground">État actuel :</span>
            <StatusBadge
              status={blocked ? 'BLOCKED' : 'ACTIVE'}
              label={
                blocked
                  ? `Bloquée${initialBlockedBy === 'PARENT' ? ' (par un parent)' : ''}`
                  : 'Active'
              }
            />
          </div>
          <Button
            type="button"
            onClick={toggle}
            disabled={loading}
            variant={blocked ? 'success' : 'destructive'}
          >
            {loading
              ? '…'
              : blocked
                ? 'Débloquer la carte'
                : 'Bloquer la carte'}
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <BackLink href={`/parent/children/${childId}`} />
    </div>
  );
}
