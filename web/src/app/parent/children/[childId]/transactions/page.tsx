import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGraphQL, getTokenFromCookie } from '@/lib/graphql-server';
import {
  TRANSACTIONS_QUERY,
  CHILD_ACCOUNT_QUERY,
  type Transaction,
  type ChildAccountSummary,
} from '@/lib/queries';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Historique des transactions d'un enfant (Server Component, auth JWT parent).
//
// On charge en parallèle le compte (pour l'en-tête : prénom, solde) et la liste
// des transactions via `transactions(childId)`. Comme pour la page de détail,
// une ForbiddenException (enfant hors famille) redirige vers /parent.
export default async function TransactionsPage({
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
  type TxData = { transactions: Transaction[] };

  const [accountResult, txResult] = await Promise.all([
    serverGraphQL<AccountData>(CHILD_ACCOUNT_QUERY, { childId }, token),
    serverGraphQL<TxData>(TRANSACTIONS_QUERY, { childId }, token),
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

  const transactions = txResult.data?.transactions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/parent/children/${childId}`} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Transactions — {account.user.firstName} {account.user.lastName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Solde : {account.balance.toFixed(2)} €
        </p>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="default" size="sm">
          <Link href={`/parent/children/${childId}/recharge`}>Recharger</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/parent/children/${childId}/expense`}>
            Ajouter une dépense
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Historique</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune transaction.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catégorie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>{tx.label ?? '—'}</TableCell>
                    <TableCell
                      className={cn(
                        tx.amount >= 0
                          ? 'text-success font-medium'
                          : 'text-destructive font-medium',
                      )}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {tx.amount.toFixed(2)} €
                    </TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.category ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
