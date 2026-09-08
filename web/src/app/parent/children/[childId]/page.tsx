import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftRight, PiggyBank, Target, Repeat, CreditCard, UserRound } from 'lucide-react';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { CHILD_ACCOUNT_QUERY, type ChildAccountSummary } from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { IconBadge } from '@/components/icon-badge';
import { StatusBadge } from '@/components/status-badge';

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
    { href: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { href: 'pots', label: 'Cagnottes', icon: PiggyBank },
    { href: 'missions', label: 'Missions', icon: Target },
    { href: 'allowances', label: 'Virements automatiques', icon: Repeat },
    { href: 'card', label: 'Carte (blocage)', icon: CreditCard },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/parent" />

      <div className="flex items-center gap-4">
        <IconBadge icon={UserRound} className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {account.user.firstName} {account.user.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{account.user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-lg">
        <span className="text-muted-foreground">Solde :</span>
        <span className="font-semibold">{account.balance.toFixed(2)} €</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Carte :</span>
        <StatusBadge
          status={account.blocked ? 'BLOCKED' : 'ACTIVE'}
          label={
            account.blocked
              ? `Bloquée${account.blockedBy === 'PARENT' ? ' (par un parent)' : ''}`
              : 'Active'
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sections</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={`/parent/children/${childId}/${s.href}`}>
                <div className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent">
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="font-medium">{s.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
