'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Formulaire de connexion (Client Component) extrait de login/page.tsx.
//
// La page /login est désormais un Server Component qui redirige les
// utilisateurs déjà authentifiés (PARENT → /parent, CHILD → /child). Ce
// composant n'est rendu que pour les visiteurs non authentifiés.
//
// Flux : POST /api/auth/login → le Route Handler appelle la mutation `login`
// du backend, pose le JWT dans un cookie httpOnly et renvoie le rôle. On
// redirige ensuite selon le rôle. Le token n'est jamais manipulé côté
// navigateur.
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Connexion impossible');
        return;
      }

      const data = await res.json();
      if (data.role === 'CHILD') {
        router.push('/child');
        router.refresh();
      } else {
        router.push('/parent');
        router.refresh();
      }
    } catch {
      setError('Erreur réseau, réessaie plus tard');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          {/* TODO: replace with actual logo image */}
          <ImagePlaceholder className="size-12" />
          <CardTitle className="text-2xl">Connexion parent</CardTitle>
          <CardDescription>
            Accède à l&apos;espace de gestion de l&apos;argent de poche
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Pas encore de famille ?{' '}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Créer un compte
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
