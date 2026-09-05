import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { CHILD_ACCOUNT_QUERY, type ChildAccountSummary } from '@/lib/queries';
import { CardBlockToggle } from './CardBlockToggle';

// Page de gestion de carte (Server Component, auth JWT parent).
//
// Charge le compte (solde + état de blocage) via `childAccount(childId)` et
// passe l'état initial au Client Component CardBlockToggle qui appelle
// `setCardBlocked`. Une ForbiddenException (enfant hors famille) redirige
// vers /parent.
export default async function CardPage({
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
  const result = await serverGraphQL<AccountData>(
    CHILD_ACCOUNT_QUERY,
    { childId },
    token,
  );

  if (result.errors) {
    const forbidden = result.errors.some((e) =>
      e.message.toLowerCase().includes('pas accès') ||
      e.message.toLowerCase().includes('forbidden'),
    );
    redirect(forbidden ? '/parent' : '/login');
  }

  const account = result.data?.childAccount;
  if (!account) {
    redirect('/parent');
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>
        Carte — {account.user.firstName} {account.user.lastName}
      </h1>
      <p>Solde : {account.balance.toFixed(2)} €</p>
      <CardBlockToggle
        params={params}
        initialBlocked={account.blocked}
        initialBlockedBy={account.blockedBy}
      />
    </main>
  );
}
