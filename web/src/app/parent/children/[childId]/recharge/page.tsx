'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { RECHARGE_MUTATION } from '@/lib/queries';

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
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}/transactions`}>← Retour</Link>
      </p>
      <h1>Recharger le compte</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
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
        {error && <p style={{ color: '#c00' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Recharge…' : 'Recharger'}
        </button>
      </form>
    </main>
  );
}
