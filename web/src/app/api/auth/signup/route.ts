import { NextResponse } from 'next/server';
import { serverGraphQL, AUTH_COOKIE } from '@/lib/graphql-server';
import { SIGNUP_MUTATION } from '@/lib/auth-operations';

// Route Handler de signup (POST /api/auth/signup).
//
// Crée la première Family + le premier parent (mutation `signup` du backend,
// marquée @Public). Reçoit les champs du formulaire, appelle le backend côté
// serveur, et pose le JWT dans le cookie httpOnly — comme pour /login, le token
// n'est pas exposé au navigateur.
export async function POST(request: Request) {
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    familyName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const { firstName, lastName, email, password, familyName } = body;
  if (!firstName || !lastName || !email || !password || !familyName) {
    return NextResponse.json(
      { error: 'Tous les champs sont requis' },
      { status: 400 },
    );
  }

  type SignupData = { signup: { token: string } };
  const result = await serverGraphQL<SignupData>(SIGNUP_MUTATION, {
    firstName,
    lastName,
    email,
    password,
    familyName,
  });

  if (result.errors || !result.data?.signup?.token) {
    const message = result.errors?.[0]?.message ?? 'Inscription impossible';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const token = result.data.signup.token;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
