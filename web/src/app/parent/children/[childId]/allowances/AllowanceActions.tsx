'use client';

import { useRouter } from 'next/navigation';
import { use, useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  CREATE_ALLOWANCE_RULE_MUTATION,
  UPDATE_ALLOWANCE_RULE_MUTATION,
  DELETE_ALLOWANCE_RULE_MUTATION,
  type AllowanceFrequency,
  type AllowanceRule,
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

const FREQUENCIES: AllowanceFrequency[] = ['WEEKLY', 'MONTHLY'];

// Formulaire d'édition inline d'un virement. Pré-rempli avec les valeurs
// actuelles. Toggle via le bouton "Modifier".
export function EditAllowanceForm({ rule }: { rule: AllowanceRule }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(rule.amount));
  const [frequency, setFrequency] = useState<AllowanceFrequency>(rule.frequency);
  const [active, setActive] = useState(rule.active);
  const [error, setError] = useState<string | null>(null);
  const [updateRule, { loading }] = useMutation(
    gql(UPDATE_ALLOWANCE_RULE_MUTATION),
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Le montant doit être positif');
      return;
    }

    try {
      await updateRule({
        variables: {
          ruleId: rule.id,
          amount: value,
          frequency,
          active,
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
      <h4>Modifier le virement</h4>
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
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f === 'WEEKLY' ? 'Hebdomadaire (WEEKLY)' : 'Mensuel (MONTHLY)'}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          style={{ marginRight: '0.5rem' }}
        />
        Actif
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

// Bouton de suppression d'un virement.
export function DeleteAllowanceButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [deleteRule, { loading }] = useMutation(
    gql(DELETE_ALLOWANCE_RULE_MUTATION),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteRule({ variables: { ruleId } });
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
        disabled={loading}
        style={{ color: '#c00' }}
      >
        {loading ? 'Suppression…' : 'Supprimer'}
      </button>
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </div>
  );
}
