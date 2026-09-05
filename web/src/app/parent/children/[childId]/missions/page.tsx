import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  MISSIONS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Mission,
  type ChildAccountSummary,
} from '@/lib/queries';
import { CreateMissionForm, ValidateMissionButtons } from './MissionActions';

// Liste des missions d'un enfant (Server Component, auth JWT parent).
//
// Charge le compte (en-tête) et la liste des missions via `missions(childId)`.
// Le formulaire de création et les boutons de validation/refus sont des
// Client Components (MissionActions) car ce sont des mutations.
//
// Badges de statut colorés : PENDING (gris), DONE_BY_CHILD (orange — en attente
// de validation parent), VALIDATED (vert), REJECTED (rouge). Les boutons
// Valider/Refuser ne s'affichent que pour DONE_BY_CHILD.
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#888',
  DONE_BY_CHILD: '#c80',
  VALIDATED: '#080',
  REJECTED: '#c00',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  DONE_BY_CHILD: 'Faite par l’enfant',
  VALIDATED: 'Validée',
  REJECTED: 'Refusée',
};

export default async function MissionsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const token = await getTokenFromCookie();
  if (!token) {
    redirect('/login');
  }

  type AccountData = { childAccount: ChildAccountSummary };
  type MissionsData = { missions: Mission[] };

  const [accountResult, missionsResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<MissionsData>(MISSIONS_QUERY, { childId }, token),
  ]);

  if (accountResult.errors) {
    const forbidden = accountResult.errors.some((e) =>
      e.message.toLowerCase().includes('pas accès') ||
      e.message.toLowerCase().includes('forbidden'),
    );
    redirect(forbidden ? '/parent' : '/login');
  }

  const account = accountResult.data?.childAccount;
  if (!account) {
    redirect('/parent');
  }

  const missions = missionsResult.data?.missions ?? [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <Link href={`/parent/children/${childId}`}>← Retour</Link>
      </p>
      <h1>
        Missions — {account.user.firstName} {account.user.lastName}
      </h1>

      <h2 style={{ marginTop: '1.5rem' }}>Missions</h2>
      {missions.length === 0 ? (
        <p style={{ color: '#888' }}>Aucune mission.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
          {missions.map((mission) => (
            <li
              key={mission.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <strong>{mission.title}</strong>
              <div style={{ marginTop: '0.5rem' }}>
                Récompense : {mission.reward.toFixed(2)} €
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <span
                  style={{
                    color: '#fff',
                    background: STATUS_COLORS[mission.status] ?? '#888',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                  }}
                >
                  {STATUS_LABELS[mission.status] ?? mission.status}
                </span>
              </div>
              {mission.status === 'DONE_BY_CHILD' && (
                <ValidateMissionButtons missionId={mission.id} />
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateMissionForm params={params} />
    </main>
  );
}
