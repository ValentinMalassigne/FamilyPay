'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_POT_MUTATION,
  WITHDRAW_FROM_POT_MUTATION,
  UPDATE_POT_MUTATION,
  DELETE_POT_MUTATION,
  type WithdrawalPolicy,
  type Pot,
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

// Formulaire d'édition inline d'une cagnotte (uniquement si OPEN).
// Pré-rempli avec les valeurs actuelles. Toggle via le bouton "Modifier".
export function EditPotForm({ pot }: { pot: Pot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(pot.title);
  const [targetAmount, setTargetAmount] = useState(String(pot.targetAmount));
  const [policy, setPolicy] = useState<WithdrawalPolicy>(pot.withdrawalPolicy);
  const [error, setError] = useState<string | null>(null);
  const [updatePot, { loading }] = useMutation(gql(UPDATE_POT_MUTATION));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const target = parseFloat(targetAmount);
    if (!title.trim()) {
      setError('Le titre ne peut pas être vide');
      return;
    }
    if (Number.isFinite(target) && target > 0 && target < pot.currentAmount) {
      setError(
        `L'objectif ne peut pas être inférieur au montant accumulé (${pot.currentAmount}€)`,
      );
      return;
    }

    try {
      await updatePot({
        variables: {
          potId: pot.id,
          title: title.trim(),
          targetAmount: Number.isFinite(target) ? target : undefined,
          withdrawalPolicy: policy,
        },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la modification');
    }
  }

  if (!editing) {
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button type="button" onClick={() => setEditing(true)}>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      <h4>Modifier la cagnotte</h4>
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
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        disabled={loading}
        style={{ marginLeft: '0.5rem' }}
      >
        Annuler
      </button>
    </form>
  );
}

// Bouton de suppression d'une cagnotte. Désactivé si currentAmount > 0
// (le backend refuse aussi la suppression d'une cagnotte non vide).
export function DeletePotButton({
  potId,
  currentAmount,
}: {
  potId: string;
  currentAmount: number;
}) {
  const router = useRouter();
  const [deletePot, { loading }] = useMutation(gql(DELETE_POT_MUTATION));
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deletePot({ variables: { potId } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur à la suppression');
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading || currentAmount > 0}
        style={{ color: '#c00' }}
      >
        {loading ? 'Suppression…' : 'Supprimer'}
      </button>
      {currentAmount > 0 && (
        <span style={{ marginLeft: '0.5rem', color: '#888', fontSize: '0.85rem' }}>
          (retirez l'argent d'abord)
        </span>
      )}
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </div>
  );
}
