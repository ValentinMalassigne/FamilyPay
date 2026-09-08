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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Créer une mission</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-mission-title">Titre</Label>
            <Input
              id="create-mission-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-mission-reward">Récompense (€)</Label>
            <Input
              id="create-mission-reward"
              type="number"
              step="0.01"
              min="0"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Création…' : 'Créer la mission'}
          </Button>
        </form>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="success"
          size="sm"
          onClick={() => handle(true)}
          disabled={loading}
        >
          Valider
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => handle(false)}
          disabled={loading}
        >
          Refuser
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        Modifier
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Modifier la mission</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-mission-title-${mission.id}`}>Titre</Label>
            <Input
              id={`edit-mission-title-${mission.id}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-mission-reward-${mission.id}`}>
              Récompense (€)
            </Label>
            <Input
              id={`edit-mission-reward-${mission.id}`}
              type="number"
              step="0.01"
              min="0"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Statut</Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as MissionStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {MISSION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={loading}
            >
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
      >
        {loading ? 'Suppression…' : 'Supprimer'}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
