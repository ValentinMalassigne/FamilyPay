import { getTokenFromCookie } from '@/lib/graphql-server';
import { LogoutButton } from '../parent/LogoutButton';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/logo';

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
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <Logo className="size-12" />
          <h1 className="text-xl font-semibold">Compte enfant</h1>
          <p className="text-sm text-muted-foreground">
            Ton compte est un compte enfant. Accède à ton solde, tes missions et
            tes cagnottes depuis l&apos;application mobile FamilyPay.
          </p>
          {token && <LogoutButton />}
        </CardContent>
      </Card>
    </main>
  );
}
