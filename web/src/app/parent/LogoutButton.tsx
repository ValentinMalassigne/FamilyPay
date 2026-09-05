'use client';

import { useRouter } from 'next/navigation';

// Bouton de déconnexion (client component car il déclenche une action navigateur).
//
// POST /api/auth/logout détruit le cookie httpOnly côté serveur, puis on
// redirige vers /login. Le cookie étant httpOnly, le navigateur ne peut pas le
// supprimer lui-même en JS — d'où l'appel au Route Handler.
export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{ marginTop: '1rem' }}
    >
      Se déconnecter
    </button>
  );
}
