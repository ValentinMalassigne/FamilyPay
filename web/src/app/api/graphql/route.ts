import { NextResponse } from 'next/server';
import { getTokenFromCookie } from '@/lib/graphql-server';

const GRAPHQL_URL =
  process.env.GRAPHQL_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  'http://localhost:3000/graphql';

// Proxy GraphQL (POST /api/graphql).
//
// Le client Apollo (navigateur) appelle cette route au lieu du backend
// directement. Ce proxy :
//  1. lit le JWT dans le cookie httpOnly `fp_token` (que le JS navigateur ne
//     peut pas lire) ;
//  2. l'injecte dans l'header `Authorization: Bearer <token>` ;
//  3. forward le body GraphQL tel quel vers le backend.
//
// Avantage : le token reste dans un cookie httpOnly (protection XSS) et le
// navigateur n'a jamais besoin de manipuler le JWT. Les requêtes non
// authentifiées (page de don publique plus tard) passent aussi par ici sans
// token — le backend autorise via @Public().
//
// Note : seules les opérations HTTP (query/mutation) passent ici. Les
// subscriptions temps réel (WebSocket) nécessiteront un proxy WS dédié dans
// une branche ultérieure.
export async function POST(request: Request) {
  const token = await getTokenFromCookie();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Le body de la requête GraphQL ( { query, variables } ) est forwardé tel quel.
  const body = await request.text();

  const backendRes = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  });

  // On retransmet la réponse JSON du backend au client, en préservant le
  // status code (200 pour un résultat OK, 400 en cas d'erreur GraphQL, etc.).
  const data = await backendRes.text();
  return new NextResponse(data, {
    status: backendRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
