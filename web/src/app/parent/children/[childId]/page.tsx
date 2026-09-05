import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { CHILD_ACCOUNT_QUERY, type ChildAccountSummary } from '@/lib/queries';

// Page de détail d'un enfant (Server Component, protégée par auth JWT parent).
//
// Route imbriquée : /parent/children/[childId]. `childId` = l'ID du User enfant
// (role=CHILD). On appelle `childAccount(childId)` côté serveur avec le JWT du
// cookie httpOnly.
//
// Vérification famille : le backend renvoie une ForbiddenException si l'enfant
// n'appartient pas à la famille du parent. On détecte cette erreur et on
// redirige vers /parent (au lieu d'afficher une page d'erreur brute).
//
// La page affiche le solde, l'état de blocage de la carte, et des liens vers
// les sous-sections (transactions, cagnottes, missions, allowances). Le contenu
// de ces sections viendra dans les branches feat/web-* suivantes.
export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type Data = { childAccount: ChildAccountSummary };
  const result = await serverGraphQL<Data>(
    CHILD_ACCOUNT_QUERY,
    { childId },
    token,
  );

  // Forbidden = enfant hors famille → retour au dashboard parent.
  // Token invalide → /login.
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

  const sections = [
    { href: 'transactions', label: 'Transactions' },
    { href: 'pots', label: 'Cagnottes' },
    { href: 'missions', label: 'Missions' },
    { href: 'allowances', label: 'Virements automatiques' },
    { href: 'card', label: 'Carte (blocage)' },
  ];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href="/parent">← Retour</Link>
      </p>
      <h1>
        {account.user.firstName} {account.user.lastName}
      </h1>
      <p style={{ color: '#888' }}>{account.user.email}</p>

      <div style={{ margin: '1rem 0', fontSize: '1.1rem' }}>
        Solde : <strong>{account.balance.toFixed(2)} €</strong>
      </div>
      <div style={{ margin: '1rem 0' }}>
        Carte :{' '}
        {account.blocked ? (
          <span style={{ color: '#c00' }}>
            Bloquée
            {account.blockedBy === 'PARENT' ? ' (par un parent)' : ''}
          </span>
        ) : (
          <span style={{ color: '#080' }}>Active</span>
        )}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Sections</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={`/parent/children/${childId}/${s.href}`}>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
