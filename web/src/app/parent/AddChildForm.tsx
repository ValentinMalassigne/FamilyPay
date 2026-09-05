'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { CREATE_CHILD_ACCOUNT_MUTATION } from '@/lib/queries';

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
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      <h3>Ajouter un enfant</h3>
      <label>
        Prénom :
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Nom :
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Email :
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Mot de passe :
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Création…' : 'Créer le compte enfant'}
      </button>
    </form>
  );
}
