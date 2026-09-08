import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  POTS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Pot,
  type ChildAccountSummary,
} from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CreatePotForm, WithdrawPotButton, EditPotForm, DeletePotButton } from './PotActions';

// Liste des cagnottes d'un enfant (Server Component, auth JWT parent).
//
// Charge le compte (en-tête) et la liste des cagnottes via `pots(childId)`.
// Le formulaire de création et les boutons de retrait sont des Client
// Components (PotActions) car ce sont des mutations.
//
// Chaque cagnotte affiche la progression (currentAmount / targetAmount), la
// politique de retrait, un lien public de don (/donate/[publicToken]) et un
// bouton de retrait (un parent peut toujours retirer, quelle que soit la
// policy).
export default async function PotsPage({
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
  type PotsData = { pots: Pot[] };

  const [accountResult, potsResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<PotsData>(POTS_QUERY, { childId }, token),
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

  const pots = potsResult.data?.pots ?? [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}`} />

      <h1 className="text-2xl font-semibold tracking-tight">
        Cagnottes — {account.user.firstName} {account.user.lastName}
      </h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cagnottes existantes</h2>
        {pots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune cagnotte.</p>
        ) : (
          <div className="grid gap-4">
            {pots.map((pot) => {
              const pct =
                pot.targetAmount > 0
                  ? Math.min(100, (pot.currentAmount / pot.targetAmount) * 100)
                  : 0;
              return (
                <Card key={pot.id}>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{pot.title}</span>
                      {pot.status === 'CLOSED' && (
                        <Badge variant="outline">Clôturée</Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {pot.currentAmount.toFixed(2)} € /{' '}
                          {pot.targetAmount.toFixed(2)} €
                        </span>
                        <span className="text-muted-foreground">
                          {pct.toFixed(0)} %
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Politique : {pot.withdrawalPolicy}
                    </p>

                    {pot.status === 'OPEN' && (
                      <>
                        <Separator />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/donate/${pot.publicToken}`}>
                              Lien public de don
                            </Link>
                          </Button>
                          <WithdrawPotButton
                            potId={pot.id}
                            currentAmount={pot.currentAmount}
                          />
                        </div>
                        <EditPotForm pot={pot} />
                      </>
                    )}

                    <DeletePotButton
                      potId={pot.id}
                      currentAmount={pot.currentAmount}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreatePotForm params={params} />
    </div>
  );
}
