import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { ME_QUERY, type AppUser } from '@/lib/auth-operations';
import { ParentNav } from '@/components/parent-nav';
import { PageContainer } from '@/components/page-container';

// Layout de l'espace parent (Server Component).
//
// Garde de rôle côté serveur pour TOUTE la section /parent/* (dashboard +
// sous-routes /parent/children/...). Le rôle n'est pas vérifiable côté
// navigateur : le JWT est dans un cookie httpOnly, seul le serveur peut le
// valider via la query `me`.
//
//  1. Pas de token → /login (pas authentifié).
//  2. Token invalide (me en erreur) → /login.
//  3. me.role !== PARENT → /child : un enfant n'a rien à faire sur l'espace
//     parent du web. Le backend refuse déjà myChildren/childAccount pour un
//     enfant (RolesGuard), mais on court-circuite ici pour rediriger proprement
//     vers la page de fallback dédiée plutôt que d'afficher un dashboard vide.
//
// Ce layout ne remplace pas les checks de token des pages filles (qui restent
// utiles pour leurs propres redirects), il ajoute le contrôle de rôle qui
// manquait.
//
// Le layout rend aussi l'en-tête partagé (ParentNav) avec le profil de l'utilisateur
// et le PageContainer pour un espacement cohérent sur toutes les sous-pages.
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type MeData = { me: AppUser };
  const meResult = await serverGraphQL<MeData>(ME_QUERY, {}, token);

  if (meResult.errors || !meResult.data?.me) {
    redirect('/login');
  }

  const me = meResult.data.me;
  if (me.role !== 'PARENT') {
    redirect('/child');
  }

  return (
    <div className="min-h-screen">
      <ParentNav
        email={me.email}
        firstName={me.firstName}
        lastName={me.lastName}
      />
      <PageContainer>{children}</PageContainer>
    </div>
  );
}
