'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_MISSION_MUTATION,
  VALIDATE_MISSION_MUTATION,
  UPDATE_MISSION_MUTATION,
  DELETE_MISSION_MUTATION,
  type MissionStatus,
  type Mission,
} from '@/lib/queries';

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

const MISSION_STATUSES: MissionStatus[] = [
  'PENDING',
  'DONE_BY_CHILD',
  'VALIDATED',
  'REJECTED',
];

const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  PENDING: 'En attente (PENDING)',
  DONE_BY_CHILD: 'Faite par l’enfant (DONE_BY_CHILD)',
  VALIDATED: 'Validée (VALIDATED)',
  REJECTED: 'Refusée (REJECTED)',
};

// Formulaire d'édition inline d'une mission. Pré-rempli avec les valeurs
// actuelles. Toggle via le bouton "Modifier".
export function EditMissionForm({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(mission.title);
  const [reward, setReward] = useState(String(mission.reward));
  const [status, setStatus] = useState<MissionStatus>(mission.status);
  const [error, setError] = useState<string | null>(null);
  const [updateMission, { loading }] = useMutation(gql(UPDATE_MISSION_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(reward);
    if (!title.trim()) {
      setError('Le titre ne peut pas être vide');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('La récompense doit être positive');
      return;
    }

    try {
      await updateMission({
        variables: {
          missionId: mission.id,
          title: title.trim(),
          reward: value,
          status,
        },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la modification');
    }
  }

  if (!editing) {
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button type="button" onClick={() => setEditing(true)}>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      <h4>Modifier la mission</h4>
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
      <label>
        Statut :
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as MissionStatus)}
          style={{ display: 'block', margin: '0.5rem 0' }}
        >
          {MISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MISSION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        disabled={loading}
        style={{ marginLeft: '0.5rem' }}
      >
        Annuler
      </button>
    </form>
  );
}

// Bouton de suppression d'une mission (tous statuts).
export function DeleteMissionButton({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [deleteMission, { loading }] = useMutation(
    gql(DELETE_MISSION_MUTATION),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteMission({ variables: { missionId } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la suppression');
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        style={{ color: '#c00' }}
      >
        {loading ? 'Suppression…' : 'Supprimer'}
      </button>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </div>
  );
}
