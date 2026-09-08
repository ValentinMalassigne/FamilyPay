'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { ADD_MANUAL_EXPENSE_MUTATION } from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Formulaire d'ajout d'une dépense manuelle (Client Component).
//
// Le montant saisi est positif côté UI ; le backend le convertit en négatif
// (débit). Même pattern que la recharge : useMutation via Apollo → proxy
// /api/graphql avec JWT httpOnly, puis router.refresh.
export default function ExpensePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addExpense, { loading }] = useMutation(gql(ADD_MANUAL_EXPENSE_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!label.trim()) {
      setError('Libellé requis');
      return;
    }
    try {
      await addExpense({
        variables: { childId, amount: value, label: label.trim() },
      });
      router.refresh();
      router.push(`/parent/children/${childId}/transactions`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la dépense',
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}/transactions`} />

      <h1 className="text-2xl font-semibold tracking-tight">
        Ajouter une dépense
      </h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Dépense manuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-label">Libellé</Label>
              <Input
                id="expense-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-amount">Montant (€)</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Ajout…' : 'Ajouter la dépense'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
