import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  ALLOWANCE_RULES_QUERY,
  CHILD_ACCOUNT_QUERY,
  type AllowanceRule,
  type ChildAccountSummary,
} from '@/lib/queries';
import { CreateAllowanceForm } from './AllowanceActions';

// Liste des virements automatiques d'un enfant (Server Component, auth parent).
//
// Charge le compte (en-tête) et la liste des règles via `allowanceRules(childId)`.
// nextRunAt n'étant pas exposé en GraphQL, on affiche le montant, la fréquence
// et le statut actif. Le formulaire de création est un Client Component
// (AllowanceActions) car c'est une mutation.
const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdomadaire',
  MONTHLY: 'Mensuel',
};

export default async function AllowancesPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type AccountData = { childAccount: ChildAccountSummary };
  type RulesData = { allowanceRules: AllowanceRule[] };

  const [accountResult, rulesResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<RulesData>(ALLOWANCE_RULES_QUERY, { childId }, token),
  ]);

  if (accountResult.errors) {
    const forbidden = accountResult.errors.some((e) =>
      e.message.toLowerCase().includes('pas accès') ||
      e.message.toLowerCase().includes('forbidden'),
    );
    redirect(forbidden ? '/parent' : '/login');
  }

  const account = accountResult.data?.childAccount;
  if (!account) {
    redirect('/parent');
  }

  const rules = rulesResult.data?.allowanceRules ?? [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}`}>← Retour</Link>
      </p>
      <h1>
        Virements automatiques — {account.user.firstName} {account.user.lastName}
      </h1>

      <h2 style={{ marginTop: '1.5rem' }}>Règles existantes</h2>
      {rules.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun virement automatique.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
          {rules.map((rule) => (
            <li
              key={rule.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <strong>{rule.amount.toFixed(2)} €</strong>
              {' — '}
              {FREQUENCY_LABELS[rule.frequency] ?? rule.frequency}
              <div style={{ marginTop: '0.25rem' }}>
                Statut :{' '}
                {rule.active ? (
                  <span style={{ color: '#080' }}>Actif</span>
                ) : (
                  <span style={{ color: '#888' }}>Suspendu</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAllowanceForm params={params} />
    </main>
  );
}
