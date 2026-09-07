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

  // Gestion des erreurs GraphQL : on distingue auth vs autres.
  //
  // - Erreur d'auth (token manquant/invalide/expiré, UNAUTHENTICATED) → /login.
  //   L'utilisateur doit se reconnecter. Le GqlAuthGuard backend lève
  //   UnauthorizedException ("Token JWT manquant", "Token JWT invalide ou
  //   expiré") → code GraphQL UNAUTHENTICATED.
  // - Toute autre erreur (ForbiddenException, NotFoundException, erreur
  //   interne, relation non chargeable) → /parent. L'utilisateur est encore
  //   authentifié : on le renvoie au dashboard au lieu de le déconnecter
  //   faussement. C'est le fix clé : avant, seule "pas accès"/"forbidden"
  //   allait vers /parent, tout le reste (y compris NotFound) partait vers
  //   /login.
  if (result.errors) {
    const authError = result.errors.some((e) => {
      const msg = e.message.toLowerCase();
      return (
        e.extensions?.code === 'UNAUTHENTICATED' ||
        msg.includes('token') ||
        msg.includes('jwt') ||
        msg.includes('expiré') ||
        msg.includes('unauthenticated') ||
        msg.includes('non authentifié') ||
        msg.includes('manquant')
      );
    });
    redirect(authError ? '/login' : '/parent');
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
