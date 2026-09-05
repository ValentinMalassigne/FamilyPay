'use client';

import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { CONTRIBUTE_TO_POT_PUBLIC_MUTATION } from '@/lib/queries';

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
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Contribuer à une cagnotte</h1>
      <p style={{ color: '#888' }}>
        Cagnotte : <code>{publicToken}</code>
      </p>

      {success && <p style={{ color: '#080' }}>{success}</p>}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: '1rem', maxWidth: '24rem' }}
      >
        <label>
          Montant (€) :
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={{ display: 'block', margin: '0.5rem 0' }}
          />
        </label>
        <label>
          Votre nom (optionnel) :
          <input
            type="text"
            value={contributorName}
            onChange={(e) => setContributorName(e.target.value)}
            style={{ display: 'block', margin: '0.5rem 0' }}
          />
        </label>
        {error && <p style={{ color: '#c00' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Envoi…' : 'Faire un don'}
        </button>
      </form>
    </main>
  );
}
