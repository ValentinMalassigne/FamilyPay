import { redirect } from 'next/navigation';
import { getTokenFromCookie } from '@/lib/graphql-server';

// Page d'accueil publique.
//
// Redirige vers /parent si l'utilisateur a un cookie httpOnly valide
// (présence du cookie ; la validité du token est vérifiée côté /parent via
// la query `me`), sinon vers /login. On ne fait pas de redirection côté client
// pour éviter un flash : le Server Component décide avant le rendu.
export default async function HomePage() {
  const token = await getTokenFromCookie();
  redirect(token ? '/parent' : '/login');
}
