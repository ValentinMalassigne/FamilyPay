'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_POT_MUTATION,
  WITHDRAW_FROM_POT_MUTATION,
  type WithdrawalPolicy,
} from '@/lib/queries';

// Actions sur les cagnottes (Client Component) : création + retrait.
//
// Côté client car ce sont des mutations (Apollo Client → proxy /api/graphql
// avec JWT httpOnly). Après chaque mutation, router.refresh() re-demande aux
// Server Components (liste des cagnottes, solde) de se recharger depuis le
// backend.

const POLICIES: WithdrawalPolicy[] = ['ANYTIME', 'WHEN_FULL', 'PARENT_ONLY'];

const POLICY_LABELS: Record<WithdrawalPolicy, string> = {
  ANYTIME: 'À tout moment (ANYTIME)',
  WHEN_FULL: 'Quand l’objectif est atteint (WHEN_FULL)',
  PARENT_ONLY: 'Parent uniquement (PARENT_ONLY)',
};

export function CreatePotForm({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { childId } = use(params);

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [policy, setPolicy] = useState<WithdrawalPolicy>('ANYTIME');
  const [error, setError] = useState<string | null>(null);
  const [createPot, { loading }] = useMutation(gql(CREATE_POT_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const target = parseFloat(targetAmount);
    if (!title.trim() || !Number.isFinite(target) || target <= 0) {
      setError('Titre et montant objectif requis');
      return;
    }
    try {
      await createPot({
        variables: {
          childId,
          title: title.trim(),
          targetAmount: target,
          withdrawalPolicy: policy,
        },
      });
      setTitle('');
      setTargetAmount('');
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
      <h3>Créer une cagnotte</h3>
      <label>
        Titre :
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Objectif (€) :
        <input
          type="number"
          step="0.01"
          min="0"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          required
          style={{ display: 'block', margin: '0.5rem 0' }}
        />
      </label>
      <label>
        Politique de retrait :
        <select
          value={policy}
          onChange={(e) => setPolicy(e.target.value as WithdrawalPolicy)}
          style={{ display: 'block', margin: '0.5rem 0' }}
        >
          {POLICIES.map((p) => (
            <option key={p} value={p}>
              {POLICY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Création…' : 'Créer la cagnotte'}
      </button>
    </form>
  );
}

export function WithdrawPotButton({
  potId,
  currentAmount,
}: {
  potId: string;
  currentAmount: number;
}) {
  const router = useRouter();
  const [withdraw, { loading }] = useMutation(gql(WITHDRAW_FROM_POT_MUTATION));
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    setError(null);
    if (currentAmount <= 0) {
      setError('Cagnotte vide');
      return;
    }
    try {
      await withdraw({ variables: { potId, amount: currentAmount } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au retrait');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={loading || currentAmount <= 0}
      >
        {loading ? 'Retrait…' : `Retirer ${currentAmount.toFixed(2)} €`}
      </button>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </div>
  );
}
