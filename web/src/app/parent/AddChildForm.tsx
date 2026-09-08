'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { CREATE_CHILD_ACCOUNT_MUTATION } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Formulaire d'ajout d'un enfant (Client Component).
//
// Côté client car c'est une mutation (Apollo Client → proxy /api/graphql qui
// injecte le JWT httpOnly du parent). Après une création réussie, on
// rafraîchit la route (router.refresh) pour que le Server Component parent
// recharge la liste myChildren depuis le backend — le nouvel enfant apparaît
// immédiatement avec son lien vers la page de détail.
//
// Validation UI minimale : champs non vides, format email, mot de passe >= 6.
// Le backend valide déjà l'unicité de l'email (ConflictException) — l'erreur
// retournée est affichée sous le formulaire.
export function AddChildForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createChild, { loading }] = useMutation(
    gql(CREATE_CHILD_ACCOUNT_MUTATION),
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) {
      setError('Prénom, nom et email sont requis');
      return;
    }
    // Validation format email basique côté UI.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Format d’email invalide');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }

    try {
      await createChild({
        variables: {
          email: trimmedEmail,
          password,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
        },
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la création');
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Ajouter un enfant</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="child-firstName">Prénom</Label>
            <Input
              id="child-firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="child-lastName">Nom</Label>
            <Input
              id="child-lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="child-email">Email</Label>
            <Input
              id="child-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="child-password">Mot de passe</Label>
            <Input
              id="child-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Création…' : 'Créer le compte enfant'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
