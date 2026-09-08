import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  MISSIONS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Mission,
  type ChildAccountSummary,
} from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { CreateMissionForm, ValidateMissionButtons, EditMissionForm, DeleteMissionButton } from './MissionActions';

// Liste des missions d'un enfant (Server Component, auth JWT parent).
//
// Charge le compte (en-tête) et la liste des missions via `missions(childId)`.
// Le formulaire de création et les boutons de validation/refus sont des
// Client Components (MissionActions) car ce sont des mutations.
//
// Badges de statut colorés : PENDING (gris), DONE_BY_CHILD (orange — en attente
// de validation parent), VALIDATED (vert), REJECTED (rouge). Les boutons
// Valider/Refuser ne s'affichent que pour DONE_BY_CHILD.
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
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}`} />

      <h1 className="text-2xl font-semibold tracking-tight">
        Missions — {account.user.firstName} {account.user.lastName}
      </h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Missions</h2>
        {missions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune mission.</p>
        ) : (
          <div className="grid gap-4">
            {missions.map((mission) => (
              <Card key={mission.id}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{mission.title}</span>
                    <StatusBadge
                      status={mission.status}
                      label={STATUS_LABELS[mission.status] ?? mission.status}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Récompense : {mission.reward.toFixed(2)} €
                  </p>
                  {mission.status === 'DONE_BY_CHILD' && (
                    <ValidateMissionButtons missionId={mission.id} />
                  )}
                  <div className="flex gap-2">
                    <EditMissionForm mission={mission} />
                    <DeleteMissionButton missionId={mission.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateMissionForm params={params} />
    </div>
  );
}
