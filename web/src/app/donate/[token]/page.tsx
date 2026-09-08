'use client';

import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { CONTRIBUTE_TO_POT_PUBLIC_MUTATION } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HandCoins } from 'lucide-react';
import { IconBadge } from '@/components/icon-badge';

// Page publique de don sur cagnotte (Client Component, SANS auth).
//
// Accessible via /donate/[publicToken]. Appelle la mutation
// `contributeToPotPublic` — la SEULE mutation backend marquée @Public(), donc
// aucun JWT n'est requis. Le proxy /api/graphql transmet la requête sans
// header Authorization quand le cookie httpOnly est absent (donateur externe).
//
// Le backend n'expose pas de query publique pour récupérer une cagnotte par
// token : on ne peut afficher que le formulaire avec le token en paramètre.
// Afficher le titre/objectif de la cagnotte nécessiterait une query publique
// backend (hors scope de cette PR).
//
// Throttling anti-abus côté UI : le bouton est désactivé pendant la soumission
// et on empêche les doubles-clics (le backend valide aussi le plafond).
export default function DonatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: publicToken } = use(params);

  const [amount, setAmount] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contribute, { loading }] = useMutation(
    gql(CONTRIBUTE_TO_POT_PUBLIC_MUTATION),
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant invalide');
      return;
    }
    try {
      await contribute({
        variables: {
          publicToken,
          amount: value,
          contributorName: contributorName.trim() || null,
        },
      });
      setSuccess(`Merci ! Votre don de ${value.toFixed(2)} € a été enregistré.`);
      setAmount('');
      setContributorName('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors du don',
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <IconBadge icon={HandCoins} className="size-16" />
          <CardTitle className="text-2xl">Contribuer à une cagnotte</CardTitle>
          <CardDescription className="font-mono text-xs">
            {publicToken}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert variant="success" className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="donate-amount">Montant (€)</Label>
              <Input
                id="donate-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="donate-name">Votre nom (optionnel)</Label>
              <Input
                id="donate-name"
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Envoi…' : 'Faire un don'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
