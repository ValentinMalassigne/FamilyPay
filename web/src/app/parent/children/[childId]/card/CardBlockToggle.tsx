'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { SET_CARD_BLOCKED_MUTATION, type BlockActor } from '@/lib/queries';

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
    <div>
      <div style={{ margin: '1rem 0', fontSize: '1.1rem' }}>
        État actuel :{' '}
        {blocked ? (
          <span style={{ color: '#c00' }}>
            Bloquée
            {initialBlockedBy === 'PARENT' ? ' (par un parent)' : ''}
          </span>
        ) : (
          <span style={{ color: '#080' }}>Active</span>
        )}
      </div>
      <button type="button" onClick={toggle} disabled={loading}>
        {loading
          ? '…'
          : blocked
            ? 'Débloquer la carte'
            : 'Bloquer la carte'}
      </button>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <p style={{ marginTop: '1rem' }}>
        <Link href={`/parent/children/${childId}`}>← Retour</Link>
      </p>
    </div>
  );
}
