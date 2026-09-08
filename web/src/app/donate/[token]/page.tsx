'use client';

import { use, useState, FormEvent } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CONTRIBUTE_TO_POT_PUBLIC_MUTATION,
  POT_BY_PUBLIC_TOKEN_QUERY,
  type PublicPotData,
} from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Page publique de don sur cagnotte (Client Component, SANS auth).
//
// Accessible via /donate/[publicToken]. Appelle la mutation
// `contributeToPotPublic` — la SEULE mutation backend marquée @Public(), donc
// aucun JWT n'est requis. Le proxy /api/graphql transmet la requête sans
// header Authorization quand le cookie httpOnly est absent (donateur externe).
//
// La query publique `potByPublicToken` (@Public côté backend) récupère le
// titre, l'objectif et le montant actuel de la cagnotte pour afficher une
// barre de progression avant le formulaire. Le type retourné (PublicPot)
// n'expose que les champs sûrs — pas de childId, hiddenFrom ni d'ID interne.
// Après un don réussi, on appelle refetch() pour rafraîchir la progression en
// direct. Si la cagnotte est CLOSED ou introuvable, le formulaire est désactivé.
//
// Throttling anti-abus côté UI : le bouton est désactivé pendant la soumission
// et on empêche les doubles-clics (le backend valide aussi le plafond).
export default function DonatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: publicToken } = use(params);

  // Query publique de la cagnotte : titre, objectif, montant actuel, statut.
  // Pas de JWT — la query est marquée @Public() côté backend. On récupère
  // refetch pour rafraîchir la progression après un don réussi.
  const {
    data: potData,
    loading: potLoading,
    error: potError,
    refetch,
  } = useQuery<{ potByPublicToken: PublicPotData }>(
    gql(POT_BY_PUBLIC_TOKEN_QUERY),
    { variables: { publicToken } },
  );

  const pot = potData?.potByPublicToken;
  const isClosed = pot?.status === 'CLOSED';
  // Le formulaire est désactivé tant qu'on ne sait pas si la cagnotte est
  // ouverte : en cours de chargement, en erreur (introuvable) ou clôturée.
  const formDisabled = potLoading || !!potError || isClosed;

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
      // Rafraîchir la progression : currentAmount a augmenté côté backend.
      refetch();
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
          {/* TODO: replace with actual donate illustration */}
          <ImagePlaceholder className="size-16" />
          <CardTitle className="text-2xl">
            {pot ? pot.title : 'Contribuer à une cagnotte'}
          </CardTitle>
          {/* <CardDescription className="font-mono text-xs">
            {publicToken}
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          {potError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Cagnotte introuvable. Vérifiez le lien de don.
              </AlertDescription>
            </Alert>
          )}
          {pot && !potError && (
            <div className="mb-4 flex flex-col gap-2">
              <Progress
                value={
                  pot.targetAmount > 0
                    ? Math.min(100, (pot.currentAmount / pot.targetAmount) * 100)
                    : 0
                }
              />
              <p className="text-center text-sm text-muted-foreground">
                {pot.currentAmount.toLocaleString('fr-FR')} € sur{' '}
                {pot.targetAmount.toLocaleString('fr-FR')} €
              </p>
            </div>
          )}
          {isClosed && !potError && (
            <Alert className="mb-4">
              <AlertDescription>
                Cette cagnotte est clôturée — les contributions ne sont plus acceptées.
              </AlertDescription>
            </Alert>
          )}
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
                disabled={formDisabled}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="donate-name">Votre nom (optionnel)</Label>
              <Input
                id="donate-name"
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                disabled={formDisabled}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading || formDisabled}>
              {loading ? 'Envoi…' : 'Faire un don'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
