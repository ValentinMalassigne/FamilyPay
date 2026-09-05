import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  TRANSACTIONS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Transaction,
  type ChildAccountSummary,
} from '@/lib/queries';

// Historique des transactions d'un enfant (Server Component, auth JWT parent).
//
// On charge en parallèle le compte (pour l'en-tête : prénom, solde) et la liste
// des transactions via `transactions(childId)`. Comme pour la page de détail,
// une ForbiddenException (enfant hors famille) redirige vers /parent.
export default async function TransactionsPage({
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
  type TxData = { transactions: Transaction[] };

  const [accountResult, txResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<TxData>(TRANSACTIONS_QUERY, { childId }, token),
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

  const transactions = txResult.data?.transactions ?? [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}`}>← Retour</Link>
      </p>
      <h1>
        Transactions — {account.user.firstName} {account.user.lastName}
      </h1>
      <p>Solde : {account.balance.toFixed(2)} €</p>

      <p style={{ marginTop: '1rem' }}>
        <Link href={`/parent/children/${childId}/recharge`}>Recharger</Link>
        {' · '}
        <Link href={`/parent/children/${childId}/expense`}>
          Ajouter une dépense
        </Link>
      </p>

      <h2 style={{ marginTop: '1.5rem' }}>Historique</h2>
      {transactions.length === 0 ? (
        <p style={{ color: '#888' }}>Aucune transaction.</p>
      ) : (
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            marginTop: '1rem',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>Date</th>
              <th style={{ padding: '0.5rem' }}>Libellé</th>
              <th style={{ padding: '0.5rem' }}>Montant</th>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem' }}>Catégorie</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>
                  {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td style={{ padding: '0.5rem' }}>{tx.label ?? '—'}</td>
                <td
                  style={{
                    padding: '0.5rem',
                    color: tx.amount >= 0 ? '#080' : '#c00',
                  }}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount.toFixed(2)} €
                </td>
                <td style={{ padding: '0.5rem' }}>{tx.type}</td>
                <td style={{ padding: '0.5rem' }}>{tx.category ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
