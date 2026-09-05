import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import { ME_QUERY, type AppUser } from '@/lib/auth-operations';
import { LogoutButton } from './LogoutButton';

// Espace parent (protégé par auth JWT parent).
//
// Server Component : la protection se fait côté serveur avant le rendu.
//  1. On lit le JWT dans le cookie httpOnly (le navigateur ne peut pas le lire).
//  2. Si absent → redirect vers /login.
//  3. On appelle la query `me` du backend avec le token pour valider qu'il est
//     encore valide et récupérer le profil. Si le backend refuse (token
//     expiré/invalide) → redirect vers /login.
//
// Pour cette PR, l'espace affiche juste le profil + un bouton de déconnexion
// pour valider l'auth de bout en bout. Les vraies features (solde, missions,
// cagnottes…) viendront dans les branches feat/web-* suivantes.
export default async function ParentPage() {
  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type MeData = { me: AppUser };
  const result = await serverGraphQL<MeData>(ME_QUERY, {}, token);

  if (result.errors || !result.data?.me) {
    // Token invalide ou expiré : on renvoie vers la connexion.
    redirect('/login');
  }

  const me = result.data.me;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Espace parent</h1>
      <p>
        Bonjour {me.firstName} {me.lastName} ({me.email})
      </p>
      <p style={{ color: '#888' }}>
        Solde, transactions, missions, cagnottes, recharges, recommandations — à venir.
      </p>
      <LogoutButton />
    </main>
  );
}
