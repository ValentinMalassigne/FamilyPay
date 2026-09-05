'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { CREATE_MISSION_MUTATION, VALIDATE_MISSION_MUTATION } from '@/lib/queries';

// Actions sur les missions (Client Component) : création + validation/refus.
//
// Mutations via Apollo Client → proxy /api/graphql (JWT httpOnly). Après chaque
// mutation, router.refresh() recharge la liste (Server Component) depuis le
// backend.

export function CreateMissionForm({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createMission, { loading }] = useMutation(gql(CREATE_MISSION_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(reward);
    if (!title.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Titre et récompense requis');
      return;
    }
    try {
      await createMission({
        variables: { childId, title: title.trim(), reward: value },
      });
      setTitle('');
      setReward('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la création');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      <h3>Créer une mission</h3>
      <label>
        Titre :
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Récompense (€) :
        <input
          type="number"
          step="0.01"
          min="0"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Création…' : 'Créer la mission'}
      </button>
    </form>
  );
}

// Boutons de validation/refus pour une mission en statut DONE_BY_CHILD.
// Un parent peut valider (approve=true → MISSION_REWARD crédité) ou refuser
// (approve=false → REJECTED).
export function ValidateMissionButtons({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [validate, { loading }] = useMutation(gql(VALIDATE_MISSION_MUTATION));
  const [error, setError] = useState<string | null>(null);

  async function handle(approve: boolean) {
    setError(null);
    try {
      await validate({ variables: { missionId, approve } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={() => handle(true)}
        disabled={loading}
        style={{ marginRight: '0.5rem' }}
      >
        Valider
      </button>
      <button
        type="button"
        onClick={() => handle(false)}
        disabled={loading}
      >
        Refuser
      </button>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </div>
  );
}
