'use client';

import { ApolloProvider as BaseApolloProvider } from '@apollo/client';
import { type ReactNode } from 'react';
import { apolloClient } from '@/lib/apollo';

// Wrapper client pour le ApolloProvider.
//
// 'use client' : ApolloProvider utilise le contexte React, qui n'est disponible
// que côté client (Server Components n'ont pas de contexte). Ce composant fait
// la passerelle entre le layout racine (Server Component) et Apollo.
export function ApolloProviderWrapper({ children }: { children: ReactNode }) {
  return <BaseApolloProvider client={apolloClient}>{children}</BaseApolloProvider>;
}
