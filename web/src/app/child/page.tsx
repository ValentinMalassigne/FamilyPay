import { getTokenFromCookie } from '@/lib/graphql-server';
import { LogoutButton } from '../parent/LogoutButton';

// Page de fallback pour un compte enfant (Server Component).
//
// Le web est l'espace parent : un enfant (role=CHILD) n'a pas d'interface
// ici — son parcours se fait via l'application mobile Flutter. Cette page est
// la destination unique quand un enfant tente de se connecter sur le web :
//  - depuis /login après authentification (redirection basée sur le rôle) ;
//  - depuis /parent/* si un enfant atteint une route protégée (layout guard).
//
// On ne fait pas de query `me` ici : pas besoin du profil pour afficher un
// message d'information. On vérifie juste la présence d'un token pour savoir
// si l'utilisateur est connecté (afin d'afficher ou non le bouton de
// déconnexion).
export default async function ChildPage() {
  const token = await getTokenFromCookie();

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 480,
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1rem',
      }}
    >
      <h1>Compte enfant</h1>
      <p>
        Ton compte est un compte enfant. Accède à ton solde, tes missions et tes
        cagnottes depuis l’application mobile FamilyPay.
      </p>
      {token && <LogoutButton />}
    </main>
  );
}
