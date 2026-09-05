import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { ME_QUERY, type AppUser } from '@/lib/auth-operations';
import {
  MY_CHILDREN_QUERY,
  type ChildAccountSummary,
} from '@/lib/queries';
import { LogoutButton } from './LogoutButton';
import { AddChildForm } from './AddChildForm';

// Espace parent (protégé par auth JWT parent).
//
// Server Component : la protection se fait côté serveur avant le rendu.
//  1. On lit le JWT dans le cookie httpOnly (le navigateur ne peut pas le lire).
//  2. Si absent → redirect vers /login.
//  3. On appelle `me` pour valider le token et `myChildren` pour la liste des
//     enfants de la famille. Si le token est invalide → /login.
//
// Affiche la liste des enfants (prénom/nom, solde, état carte) avec un lien vers
// la page de détail `/parent/children/[childId]`. `childId` = l'ID du User enfant
// (exposé via `account.user.id`, le champ `userId` n'étant pas exposé en GraphQL).
export default async function ParentPage() {
  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type MeData = { me: AppUser };
  type ChildrenData = { myChildren: ChildAccountSummary[] };

  const [meResult, childrenResult] = await Promise.all([
    serverGraphQL<MeData>(ME_QUERY, {}, token),
    serverGraphQL<ChildrenData>(MY_CHILDREN_QUERY, {}, token),
  ]);

  if (meResult.errors || !meResult.data?.me) {
    redirect('/login');
  }

  const me = meResult.data.me;
  // Une erreur sur myChildren (ex: pas d'enfant) ne doit pas casser l'espace :
  // on affiche juste la liste vide. Les erreurs d'auth ont déjà été traitées
  // côté `me`.
  const children = childrenResult.data?.myChildren ?? [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Espace parent</h1>
      <p>
        Bonjour {me.firstName} {me.lastName} ({me.email})
      </p>
      <LogoutButton />

      <h2 style={{ marginTop: '2rem' }}>Mes enfants</h2>

      {children.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun enfant pour le moment.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: '1rem',
          }}
        >
          {children.map((child) => (
            <li
              key={child.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <Link
                href={`/parent/children/${child.user.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <strong>
                  {child.user.firstName} {child.user.lastName}
                </strong>
                <div style={{ marginTop: '0.5rem' }}>
                  Solde : {child.balance.toFixed(2)} €
                </div>
                <div>
                  Carte :{' '}
                  {child.blocked ? (
                    <span style={{ color: '#c00' }}>
                      Bloquée
                      {child.blockedBy === 'PARENT' ? ' (par un parent)' : ''}
                    </span>
                  ) : (
                    <span style={{ color: '#080' }}>Active</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: '2rem' }}>Ajouter un enfant</h2>
      <AddChildForm />
    </main>
  );
}
