import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  POTS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Pot,
  type ChildAccountSummary,
} from '@/lib/queries';
import { CreatePotForm, WithdrawPotButton } from './PotActions';

// Liste des cagnottes d'un enfant (Server Component, auth JWT parent).
//
// Charge le compte (en-tête) et la liste des cagnottes via `pots(childId)`.
// Le formulaire de création et les boutons de retrait sont des Client
// Components (PotActions) car ce sont des mutations.
//
// Chaque cagnotte affiche la progression (currentAmount / targetAmount), la
// politique de retrait, un lien public de don (/donate/[publicToken]) et un
// bouton de retrait (un parent peut toujours retirer, quelle que soit la
// policy).
export default async function PotsPage({
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
  type PotsData = { pots: Pot[] };

  const [accountResult, potsResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<PotsData>(POTS_QUERY, { childId }, token),
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

  const pots = potsResult.data?.pots ?? [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}`}>← Retour</Link>
      </p>
      <h1>
        Cagnottes — {account.user.firstName} {account.user.lastName}
      </h1>

      <h2 style={{ marginTop: '1.5rem' }}>Cagnottes existantes</h2>
      {pots.length === 0 ? (
        <p style={{ color: '#888' }}>Aucune cagnotte.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
          {pots.map((pot) => {
            const pct =
              pot.targetAmount > 0
                ? Math.min(100, (pot.currentAmount / pot.targetAmount) * 100)
                : 0;
            return (
              <li
                key={pot.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1rem',
                }}
              >
                <strong>{pot.title}</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  {pot.currentAmount.toFixed(2)} € / {pot.targetAmount.toFixed(2)} €
                  {' '}({pct.toFixed(0)} %)
                </div>
                <div style={{ color: '#888' }}>
                  Politique : {pot.withdrawalPolicy}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <Link href={`/donate/${pot.publicToken}`}>
                    Lien public de don
                  </Link>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <WithdrawPotButton
                    potId={pot.id}
                    currentAmount={pot.currentAmount}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePotForm params={params} />
    </main>
  );
}
