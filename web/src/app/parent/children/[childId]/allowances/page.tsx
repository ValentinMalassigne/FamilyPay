import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  ALLOWANCE_RULES_QUERY,
  CHILD_ACCOUNT_QUERY,
  type AllowanceRule,
  type ChildAccountSummary,
} from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { CreateAllowanceForm, EditAllowanceForm, DeleteAllowanceButton } from './AllowanceActions';

// Liste des virements automatiques d'un enfant (Server Component, auth parent).
//
// Charge le compte (en-tête) et la liste des règles via `allowanceRules(childId)`.
// nextRunAt n'étant pas exposé en GraphQL, on affiche le montant, la fréquence
// et le statut actif. Le formulaire de création est un Client Component
// (AllowanceActions) car c'est une mutation.
const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdomadaire',
  MONTHLY: 'Mensuel',
};

export default async function AllowancesPage({
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
  type RulesData = { allowanceRules: AllowanceRule[] };

  const [accountResult, rulesResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<RulesData>(ALLOWANCE_RULES_QUERY, { childId }, token),
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

  const rules = rulesResult.data?.allowanceRules ?? [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}`} />

      <h1 className="text-2xl font-semibold tracking-tight">
        Virements automatiques — {account.user.firstName}{' '}
        {account.user.lastName}
      </h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Règles existantes</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun virement automatique.
          </p>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {rule.amount.toFixed(2)} €
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {FREQUENCY_LABELS[rule.frequency] ?? rule.frequency}
                    </span>
                    <StatusBadge
                      status={rule.active ? 'ACTIVE' : 'SUSPENDED'}
                      label={rule.active ? 'Actif' : 'Suspendu'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <EditAllowanceForm rule={rule} />
                    <DeleteAllowanceButton ruleId={rule.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateAllowanceForm params={params} />
    </div>
  );
}
