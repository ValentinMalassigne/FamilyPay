'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { RECHARGE_MUTATION } from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Formulaire de recharge manuelle (Client Component).
//
// Utilise useMutation d'Apollo Client → appelle le proxy /api/graphql qui
// injecte le JWT httpOnly. Après une recharge réussie, on rafraîchit la route
// (router.refresh) pour que les Server Components (solde, historique) se
// rechargent depuis le backend.
export default function RechargePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  // use() déboucle la Promise params (pattern Next.js 15+ pour les Client
  // Components avec params asynchrone).
  const { childId } = use(params);

  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recharge, { loading }] = useMutation(gql(RECHARGE_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant invalide');
      return;
    }
    try {
      await recharge({ variables: { childId, amount: value } });
      router.refresh();
      router.push(`/parent/children/${childId}/transactions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recharge');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}/transactions`} />

      <h1 className="text-2xl font-semibold tracking-tight">
        Recharger le compte
      </h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Recharge manuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recharge-amount">Montant (€)</Label>
              <Input
                id="recharge-amount"
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
              {loading ? 'Recharge…' : 'Recharger'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
