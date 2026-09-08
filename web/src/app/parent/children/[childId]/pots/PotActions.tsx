'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_POT_MUTATION,
  WITHDRAW_FROM_POT_MUTATION,
  UPDATE_POT_MUTATION,
  DELETE_POT_MUTATION,
  type WithdrawalPolicy,
  type Pot,
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

// Actions sur les cagnottes (Client Component) : création + retrait.
//
// Côté client car ce sont des mutations (Apollo Client → proxy /api/graphql
// avec JWT httpOnly). Après chaque mutation, router.refresh() re-demande aux
// Server Components (liste des cagnottes, solde) de se recharger depuis le
// backend.

const POLICIES: WithdrawalPolicy[] = ['ANYTIME', 'WHEN_FULL', 'PARENT_ONLY'];

const POLICY_LABELS: Record<WithdrawalPolicy, string> = {
  ANYTIME: 'À tout moment (ANYTIME)',
  WHEN_FULL: 'Quand l’objectif est atteint (WHEN_FULL)',
  PARENT_ONLY: 'Parent uniquement (PARENT_ONLY)',
};

export function CreatePotForm({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [policy, setPolicy] = useState<WithdrawalPolicy>('ANYTIME');
  const [error, setError] = useState<string | null>(null);
  const [createPot, { loading }] = useMutation(gql(CREATE_POT_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const target = parseFloat(targetAmount);
    if (!title.trim() || !Number.isFinite(target) || target <= 0) {
      setError('Titre et montant objectif requis');
      return;
    }
    try {
      await createPot({
        variables: {
          childId,
          title: title.trim(),
          targetAmount: target,
          withdrawalPolicy: policy,
        },
      });
      setTitle('');
      setTargetAmount('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la création');
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Créer une cagnotte</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-pot-title">Titre</Label>
            <Input
              id="create-pot-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-pot-target">Objectif (€)</Label>
            <Input
              id="create-pot-target"
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Politique de retrait</Label>
            <Select
              value={policy}
              onValueChange={(val) => setPolicy(val as WithdrawalPolicy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POLICY_LABELS[p]}
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Création…' : 'Créer la cagnotte'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function WithdrawPotButton({
  potId,
  currentAmount,
}: {
  potId: string;
  currentAmount: number;
}) {
  const router = useRouter();
  const [withdraw, { loading }] = useMutation(gql(WITHDRAW_FROM_POT_MUTATION));
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    setError(null);
    if (currentAmount <= 0) {
      setError('Cagnotte vide');
      return;
    }
    try {
      await withdraw({ variables: { potId, amount: currentAmount } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au retrait');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleWithdraw}
        disabled={loading || currentAmount <= 0}
      >
        {loading ? 'Retrait…' : `Retirer ${currentAmount.toFixed(2)} €`}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Formulaire d'édition inline d'une cagnotte (uniquement si OPEN).
// Pré-rempli avec les valeurs actuelles. Toggle via le bouton "Modifier".
export function EditPotForm({ pot }: { pot: Pot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(pot.title);
  const [targetAmount, setTargetAmount] = useState(String(pot.targetAmount));
  const [policy, setPolicy] = useState<WithdrawalPolicy>(pot.withdrawalPolicy);
  const [error, setError] = useState<string | null>(null);
  const [updatePot, { loading }] = useMutation(gql(UPDATE_POT_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const target = parseFloat(targetAmount);
    if (!title.trim()) {
      setError('Le titre ne peut pas être vide');
      return;
    }
    if (Number.isFinite(target) && target > 0 && target < pot.currentAmount) {
      setError(
        `L'objectif ne peut pas être inférieur au montant accumulé (${pot.currentAmount}€)`,
      );
      return;
    }

    try {
      await updatePot({
        variables: {
          potId: pot.id,
          title: title.trim(),
          targetAmount: Number.isFinite(target) ? target : undefined,
          withdrawalPolicy: policy,
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
        <CardTitle className="text-sm">Modifier la cagnotte</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-pot-title-${pot.id}`}>Titre</Label>
            <Input
              id={`edit-pot-title-${pot.id}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-pot-target-${pot.id}`}>Objectif (€)</Label>
            <Input
              id={`edit-pot-target-${pot.id}`}
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Politique de retrait</Label>
            <Select
              value={policy}
              onValueChange={(val) => setPolicy(val as WithdrawalPolicy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POLICY_LABELS[p]}
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

// Bouton de suppression d'une cagnotte. Désactivé si currentAmount > 0
// (le backend refuse aussi la suppression d'une cagnotte non vide).
export function DeletePotButton({
  potId,
  currentAmount,
}: {
  potId: string;
  currentAmount: number;
}) {
  const router = useRouter();
  const [deletePot, { loading }] = useMutation(gql(DELETE_POT_MUTATION));
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deletePot({ variables: { potId } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la suppression');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading || currentAmount > 0}
        >
          {loading ? 'Suppression…' : 'Supprimer'}
        </Button>
        {currentAmount > 0 && (
          <span className="text-xs text-muted-foreground">
            (retirez l&apos;argent d&apos;abord)
          </span>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
