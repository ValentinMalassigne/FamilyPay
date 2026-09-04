// Page publique de don sur cagnotte (placeholder).
//
// Accessible sans auth via le publicToken de la cagnotte. Appellera la mutation
// GraphQL `contributeToPotPublic` (la seule mutation publique du backend, voir
// PROJECT_CONTEXT.md §6). Le paramètre [token] de l'URL correspond au
// `publicToken` de la cagnotte.
//
// Pas de JWT sur cette page — elle est servie publiquement.
export default async function DonatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Contribuer à une cagnotte</h1>
      <p>
        Token de la cagnotte : <code>{token}</code>
      </p>
      <p style={{ color: '#888' }}>
        (placeholder — formulaire de don à venir dans une branche feat/web-*)
      </p>
    </main>
  );
}
