import { type ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ApolloProviderWrapper } from '@/components/ApolloProviderWrapper';
import './globals.css';

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
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <ApolloProviderWrapper>{children}</ApolloProviderWrapper>
      </body>
    </html>
  );
}
