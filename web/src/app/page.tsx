import Link from 'next/link';

// Page d'accueil publique. Pour l'instant un simple point d'entrée qui
// redirige vers l'espace parent. L'auth viendra dans une branche suivante.
export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>FamilyPay</h1>
      <p>Gestion d&apos;argent de poche pour ados.</p>
      <Link href="/parent">Espace parent</Link>
    </main>
  );
}
