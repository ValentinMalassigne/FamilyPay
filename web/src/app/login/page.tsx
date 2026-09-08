import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { ME_QUERY, type AppUser } from '@/lib/auth-operations';
import LoginForm from './LoginForm';

// Page de connexion (Server Component).
//
// Garde d'auth côté serveur : un utilisateur déjà authentifié n'a rien à faire
// ici. On lit le cookie httpOnly, valide le JWT via la query `me` et redirige
// selon le rôle :
//  - PARENT → /parent (espace parent).
//  - CHILD  → /child (page de fallback : l'enfant n'a pas d'interface web).
// Si pas de token ou token invalide → on rend le formulaire (LoginForm).
//
// Pattern cohérent avec parent/layout.tsx : la vérification se fait côté
// serveur car le JWT est dans un cookie httpOnly inaccessible au navigateur.
export default async function LoginPage() {
  const token = await getTokenFromCookie();
  if (!token) {
    return <LoginForm />;
  }

  type MeData = { me: AppUser };
  const meResult = await serverGraphQL<MeData>(ME_QUERY, {}, token);

  if (meResult.errors || !meResult.data?.me) {
    return <LoginForm />;
  }

  const me = meResult.data.me;
  redirect(me.role === 'CHILD' ? '/child' : '/parent');
}
