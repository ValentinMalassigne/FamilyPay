import { NextResponse } from 'next/server';
import { serverGraphQL, AUTH_COOKIE } from '@/lib/graphql-server';
import { LOGIN_MUTATION } from '@/lib/auth-operations';

// Route Handler de login (POST /api/auth/login).
//
// Reçoit { email, password } en JSON, appelle la mutation `login` du backend
// côté serveur Next.js, puis pose le JWT retourné dans un cookie httpOnly.
//
// Le token n'est JAMAIS renvoyé au navigateur dans le corps de la réponse :
// seule une confirmation { user } est renvoyée. Le navigateur ne peut pas
// lire le cookie httpOnly (protection XSS). Les requêtes GraphQL ultérieures
// passent par le proxy /api/graphql qui lit ce cookie et injecte l'Authorization.
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email et mot de passe requis' },
      { status: 400 },
    );
  }

  type LoginData = { login: { token: string } };
  const result = await serverGraphQL<LoginData>(LOGIN_MUTATION, { email, password });

  if (result.errors || !result.data?.login?.token) {
    const message = result.errors?.[0]?.message ?? 'Identifiants invalides';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const token = result.data.login.token;

  // Pose le cookie httpOnly. SameSite=Lax protège contre CSRF pour les
  // requêtes cross-site simples. secure=false en dev (HTTP) ; en production
  // (HTTPS) il faudrait secure=true via une variable d'env.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 jours, aligné sur l'expiration du JWT backend.
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
