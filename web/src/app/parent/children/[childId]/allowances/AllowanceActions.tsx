'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_ALLOWANCE_RULE_MUTATION,
  type AllowanceFrequency,
} from '@/lib/queries';

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
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      <h3>Créer un virement automatique</h3>
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
        Fréquence :
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as AllowanceFrequency)}
          style={{ display: 'block', margin: '0.5rem 0' }}
        >
          <option value="WEEKLY">Hebdomadaire (WEEKLY)</option>
          <option value="MONTHLY">Mensuel (MONTHLY)</option>
        </select>
      </label>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Création…' : 'Créer le virement'}
      </button>
    </form>
  );
}
