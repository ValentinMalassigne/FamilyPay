import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

// Client Apollo unique pour l'app web (côté navigateur).
//
// Le client pointe vers le proxy Next.js /api/graphql (URL relative, même
// origine que le front) plutôt que vers le backend directement. Le proxy lit
// le JWT dans le cookie httpOnly et injecte l'Authorization header vers le
// backend — le navigateur n'a donc jamais à manipuler le token (sécurité XSS).
//
// HttpLink : link de transport HTTP qui envoie les opérations GraphQL par POST.
// Depuis Apollo Client 4, le raccourci `uri` sur ApolloClient est supprimé → on
// passe un HttpLink explicite.
//
// InMemoryCache : cache côté client normalisé des résultats GraphQL. Pour
// cette init on garde la config par défaut ; on l'enrichira quand on aura des
// queries réelles (normalisation par __typename + id).
//
// Note : les subscriptions temps réel (WebSocket) ne passent pas par ce
// HttpLink — elles nécessiteront un link WS dédié dans une branche ultérieure.
export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: '/api/graphql' }),
  cache: new InMemoryCache(),
});
