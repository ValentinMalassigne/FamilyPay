'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_ALLOWANCE_RULE_MUTATION,
  UPDATE_ALLOWANCE_RULE_MUTATION,
  DELETE_ALLOWANCE_RULE_MUTATION,
  type AllowanceFrequency,
  type AllowanceRule,
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

// Formulaire de création de virement automatique (Client Component).
//
// Mutation createAllowanceRule (PARENT only côté backend) via Apollo Client →
// proxy /api/graphql (JWT httpOnly). Après création, router.refresh()
// recharge la liste (Server Component).
export function CreateAllowanceForm({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<AllowanceFrequency>('WEEKLY');
  const [error, setError] = useState<string | null>(null);
  const [createRule, { loading }] = useMutation(
    gql(CREATE_ALLOWANCE_RULE_MUTATION),
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant invalide');
      return;
    }
    try {
      await createRule({
        variables: { childId, amount: value, frequency },
      });
      setAmount('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la création');
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Créer un virement automatique</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-allowance-amount">Montant (€)</Label>
            <Input
              id="create-allowance-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Fréquence</Label>
            <Select
              value={frequency}
              onValueChange={(val) => setFrequency(val as AllowanceFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Hebdomadaire (WEEKLY)</SelectItem>
                <SelectItem value="MONTHLY">Mensuel (MONTHLY)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Création…' : 'Créer le virement'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const FREQUENCIES: AllowanceFrequency[] = ['WEEKLY', 'MONTHLY'];

// Formulaire d'édition inline d'un virement. Pré-rempli avec les valeurs
// actuelles. Toggle via le bouton "Modifier".
export function EditAllowanceForm({ rule }: { rule: AllowanceRule }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(rule.amount));
  const [frequency, setFrequency] = useState<AllowanceFrequency>(rule.frequency);
  const [active, setActive] = useState(rule.active);
  const [error, setError] = useState<string | null>(null);
  const [updateRule, { loading }] = useMutation(
    gql(UPDATE_ALLOWANCE_RULE_MUTATION),
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Le montant doit être positif');
      return;
    }

    try {
      await updateRule({
        variables: {
          ruleId: rule.id,
          amount: value,
          frequency,
          active,
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
        <CardTitle className="text-sm">Modifier le virement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-allowance-amount-${rule.id}`}>Montant (€)</Label>
            <Input
              id={`edit-allowance-amount-${rule.id}`}
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Fréquence</Label>
            <Select
              value={frequency}
              onValueChange={(val) => setFrequency(val as AllowanceFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f === 'WEEKLY' ? 'Hebdomadaire (WEEKLY)' : 'Mensuel (MONTHLY)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Actif
          </label>
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

// Bouton de suppression d'un virement.
export function DeleteAllowanceButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [deleteRule, { loading }] = useMutation(
    gql(DELETE_ALLOWANCE_RULE_MUTATION),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteRule({ variables: { ruleId } });
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
