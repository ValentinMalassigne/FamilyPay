'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Page de connexion (POST /api/auth/login).
//
// Formulaire client qui poste les identifiants au Route Handler server-side.
// Le Route Handler appelle la mutation `login` du backend et pose le JWT dans
// un cookie httpOnly, puis renvoie le rôle (PARENT | CHILD). On redirige :
//  - PARENT → /parent (espace parent) ;
//  - CHILD  → /child (page de fallback : l'enfant n'a pas d'interface web,
//    son parcours est sur l'application mobile).
// Le token n'est jamais manipulé côté navigateur.
export default function LoginPage() {
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
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 420 }}>
      <h1>Connexion parent</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Pas encore de famille ? <Link href="/signup">Créer un compte</Link>
      </p>
    </main>
  );
}
