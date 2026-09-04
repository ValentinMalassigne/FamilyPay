// Espace parent (placeholder).
//
// Sera protégé par auth JWT parent (httpOnly cookie) dans une branche
// feat/web-auth. Pour l'instant, simple placeholder pour valider le routage.
export default function ParentPage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Espace parent</h1>
      <p>Solde, transactions, missions, cagnottes, recharges, recommandations.</p>
      <p style={{ color: '#888' }}>
        (placeholder — fonctionnalités à venir dans les branches feat/web-*)
      </p>
    </main>
  );
}
