import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/graphql-server';

// Route Handler de logout (POST /api/auth/logout).
//
// Détruit le cookie httpOnly `fp_token` côté serveur. Le navigateur ne peut
// pas le faire lui-même (cookie httpOnly non lisible en JS), d'où ce endpoint.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // maxAge=0 demande au navigateur de supprimer le cookie immédiatement.
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
