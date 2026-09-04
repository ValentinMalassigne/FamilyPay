import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

// Création du client Apollo unique pour l'app web.
//
// L'URI du endpoint GraphQL est lue depuis la variable d'environnement publique
// NEXT_PUBLIC_GRAPHQL_URL (préfixe NEXT_PUBLIC_ → exposée au navigateur par Next.js).
// En dev local : http://localhost:3000/graphql (voir .env.example).
//
// HttpLink : link de transport HTTP qui envoie les opérations GraphQL au backend
// par POST. Depuis Apollo Client 3.14, le raccourci `uri` sur ApolloClient est
// déprécié → on passe un HttpLink explicite.
//
// InMemoryCache : cache côté client normalisé des résultats GraphQL. Pour cette
// init on garde la config par défaut ; on l'enrichira quand on aura des queries
// réelles (normalisation par __typename + id).
export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL }),
  cache: new InMemoryCache(),
});
