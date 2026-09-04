import { type ReactNode } from 'react';
import { ApolloProviderWrapper } from '@/components/ApolloProviderWrapper';

// Layout racine de l'app Next.js (App Router).
//
// Doit contenir <html> et <body> : c'est le seul endroit où ils apparaissent.
// On wrap tout l'arbre avec ApolloProviderWrapper pour que chaque page puisse
// exécuter queries/mutations/subscriptions via le hook useQuery etc.
export const metadata = {
  title: 'FamilyPay',
  description: "Espace parent FamilyPay — gestion de l'argent de poche",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ApolloProviderWrapper>{children}</ApolloProviderWrapper>
      </body>
    </html>
  );
}
