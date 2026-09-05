'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { ADD_MANUAL_EXPENSE_MUTATION } from '@/lib/queries';

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
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}/transactions`}>← Retour</Link>
      </p>
      <h1>Ajouter une dépense</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <label>
          Libellé :
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            style={{ display: 'block', margin: '0.5rem 0' }}
          />
        </label>
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
          {loading ? 'Ajout…' : 'Ajouter la dépense'}
        </button>
      </form>
    </main>
  );
}
