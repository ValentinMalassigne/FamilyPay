import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { ME_QUERY, type AppUser } from '@/lib/auth-operations';
import {
  MY_CHILDREN_QUERY,
  type ChildAccountSummary,
} from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { ImagePlaceholder } from '@/components/image-placeholder';
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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Espace parent</h1>
        <p className="mt-1 text-muted-foreground">
          Bonjour {me.firstName} {me.lastName}
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Mes enfants</h2>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun enfant pour le moment.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/parent/children/${child.user.id}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-4">
                    {/* TODO: replace with actual avatar image */}
                    <ImagePlaceholder className="size-10 shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="font-medium">
                        {child.user.firstName} {child.user.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Solde : {child.balance.toFixed(2)} €
                      </span>
                      <StatusBadge
                        status={child.blocked ? 'BLOCKED' : 'ACTIVE'}
                        label={
                          child.blocked
                            ? `Bloquée${child.blockedBy === 'PARENT' ? ' (par un parent)' : ''}`
                            : 'Active'
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Ajouter un enfant</h2>
        <AddChildForm />
      </section>
    </div>
  );
}
