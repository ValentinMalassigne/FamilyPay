import { cookies } from 'next/headers';

// Helper GraphQL côté serveur (Route Handlers + Server Components).
//
// Contrairement au client Apollo (qui tourne dans le navigateur et pointe vers
// le proxy /api/graphql), cet helper appelle directement le backend depuis le
// serveur Next.js. Il est utilisé pour :
//  - les Route Handlers d'auth (/api/auth/*) : appeler login/signup côté serveur
//    afin de ne jamais exposer le JWT au navigateur (le token reste dans un
//    cookie httpOnly posé par le Route Handler) ;
//  - les Server Components protégés (/parent) : vérifier le token via la query
//    `me` et récupérer le profil avant le rendu.
//
// L'URL du backend est lue depuis NEXT_PUBLIC_GRAPHQL_URL. Le préfixe
// NEXT_PUBLIC_ l'expose aussi au navigateur, mais elle reste accessible côté
// serveur ; on l'utilise ici pour ne pas multiplier les variables d'env.
const GRAPHQL_URL =
  process.env.GRAPHQL_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  'http://localhost:3000/graphql';

export const AUTH_COOKIE = 'fp_token';

export type GraphQLResult<T> = { data?: T; errors?: Array<{ message: string }> };

/*
 * serverGraphQL : exécute une opération GraphQL (query ou mutation) côté serveur.
 *
 * @param query : la chaîne GraphQL (query ou mutation) à exécuter.
 * @param variables : les variables de l'opération.
 * @param token : JWT optionnel à envoyer dans l'Authorization header. Quand
 *   fourni (depuis le cookie httpOnly), le backend GqlAuthGuard authentifie
 *   l'appel. Quand absent, l'appel est anonyme (utile pour login/signup qui
 *   sont marqués @Public).
 *
 * Retourne le payload GraphQL parsé. En cas d'erreur réseau, on lève pour que
 * l'appelant (Route Handler / Server Component) puisse gérer (401, 500...).
 */
export async function serverGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GraphQLResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  return (await res.json()) as GraphQLResult<T>;
}

/*
 * getTokenFromCookie : lit le JWT depuis le cookie httpOnly `fp_token`.
 *
 * cookies() vient de next/headers et ne fonctionne que côté serveur (Server
 * Components, Route Handlers). Retourne undefined si le cookie est absent
 * (utilisateur non authentifié).
 */
export async function getTokenFromCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value;
}
