'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, EmptyState, Alert, toast } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { usePermission } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/api-client';
import { useQuote, useQuoteHistory, useQuoteMutation } from './queries';
import { QuoteForm } from './quote-form';
export function QuoteDetail({ id }: { id: string }) {
  const backLink = useRef<HTMLAnchorElement | null>(null);
  const query = useQuote(id),
    history = useQuoteHistory(id),
    mutation = useQuoteMutation(),
    router = useRouter();
  const canRead = usePermission('quotes.read');
  const [editing, setEditing] = useState(false),
    [action, setAction] = useState<'approve' | 'revise' | null>(null),
    [error, setError] = useState<string | null>(null);
  const revisionKey = useRef<{ version: number; key: string } | null>(null);
  if (!canRead)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar orçamentos."
      />
    );
  if (query.isPending) return <ListSkeleton />;
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const row = query.data;
  const command = async () => {
    try {
      if (!action) return;
      if (action === 'approve')
        await mutation.mutateAsync({ type: 'approve', id, version: row.version });
      else {
        if (revisionKey.current?.version !== row.version)
          revisionKey.current = { version: row.version, key: crypto.randomUUID() };
        const next = await mutation.mutateAsync({
          type: 'revise',
          id,
          version: row.version,
          key: revisionKey.current.key,
        });
        router.push(`/quotes/${next.id}`);
      }
      toast.success(action === 'approve' ? 'Orçamento aprovado.' : 'Revisão criada.');
      setAction(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <>
      <PageHeader
        title={row.name}
        description={`Revisão ${row.revision} · versão ${row.version}`}
        breadcrumb={
          <Link
            ref={backLink}
            className="mb-3 inline-block text-body text-muted underline"
            href="/quotes"
          >
            Voltar para orçamentos
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {row.canUpdate && <Button onClick={() => setEditing(true)}>Editar orçamento</Button>}
            {row.canApprove && (
              <Button
                onClick={() => {
                  setError(null);
                  setAction('approve');
                }}
              >
                Aprovar orçamento
              </Button>
            )}
            {row.canRevise && (
              <Button
                onClick={() => {
                  setError(null);
                  setAction('revise');
                }}
              >
                Criar revisão
              </Button>
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.notes}
        items={[
          {
            label: 'Status',
            value: (
              <Badge variant={row.status === 'APPROVED' ? 'success' : 'neutral'}>
                {row.status === 'APPROVED' ? 'Aprovado' : 'Rascunho'}
              </Badge>
            ),
          },
          { label: 'Comprador', value: row.buyer.name },
          { label: 'Documento', value: row.buyer.document },
          { label: 'E-mail', value: row.buyer.email },
          { label: 'Telefone', value: row.buyer.phone },
          { label: 'Tabela de preços', value: row.priceListName },
          { label: 'Válido até (dia UTC)', value: row.validUntil },
          { label: 'Subtotal', value: row.currency + ' ' + row.subtotal },
          { label: 'Desconto', value: row.currency + ' ' + row.discount },
          { label: 'Total', value: row.currency + ' ' + row.total },
        ]}
      />
      {row.opportunityId && (
        <p className="mt-5">
          <Link className="text-body underline" href={`/crm/${row.opportunityId}`}>
            Abrir oportunidade vinculada
          </Link>
        </p>
      )}
      {row.previousQuoteId && (
        <p className="mt-3">
          <Link className="text-body underline" href={`/quotes/${row.previousQuoteId}`}>
            Ver revisão anterior preservada
          </Link>
        </p>
      )}
      <section className="mt-6 rounded-lg border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Itens da proposta</h2>
        <ul className="divide-y">
          {row.items.map((item) => (
            <li key={item.productId} className="space-y-2 py-4">
              <p className="break-words font-semibold">
                {item.sku} · {item.description}
              </p>
              <p className="break-words text-body">
                {item.quantity} {item.unit} × {row.currency} {item.unitPrice} · desconto{' '}
                {item.discountPercent}%
              </p>
              <p className="text-body">
                Total do item: {row.currency} {item.total}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-muted">
          Valores preservados neste documento; mudanças do catálogo não recalculam a proposta.
        </p>
      </section>
      <section className="mt-6 rounded-lg border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Histórico do orçamento</h2>
        {history.isError ? (
          <QueryError
            error={history.error}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : history.isPending ? (
          <ListSkeleton />
        ) : (
          <ol className="space-y-3">
            {history.data.pages
              .flatMap((page) => page.data)
              .map((item) => (
                <li key={item.id} className="text-body">
                  {
                    (
                      {
                        CREATED: 'Criado',
                        UPDATED: 'Editado',
                        APPROVED: 'Aprovado',
                        REVISED: 'Revisão criada',
                      } as const
                    )[item.kind]
                  }{' '}
                  · versão {item.recordVersion} · {new Date(item.createdAt).toLocaleString('pt-BR')}
                </li>
              ))}
          </ol>
        )}
        {history.hasNextPage && (
          <Button
            variant="link"
            loading={history.isFetchingNextPage}
            onClick={() => {
              void history.fetchNextPage();
            }}
          >
            Mais eventos
          </Button>
        )}
      </section>
      <RecordDialog
        open={editing}
        fallbackFocus={backLink}
        onOpenChange={setEditing}
        title="Editar orçamento"
        description="Itens existentes conservam o preço e a descrição desta proposta."
      >
        {editing && <QuoteForm record={row} onSaved={() => setEditing(false)} />}
      </RecordDialog>
      <RecordDialog
        open={action !== null}
        fallbackFocus={backLink}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={action === 'approve' ? 'Aprovar orçamento' : 'Criar revisão'}
        description={
          action === 'approve'
            ? 'A proposta aprovada será imutável. Confira comprador, preços, descontos e condições.'
            : 'Uma nova proposta será criada com os snapshots atuais; o original permanecerá preservado.'
        }
      >
        {error && <Alert>{error}</Alert>}
        <Button
          loading={mutation.isPending}
          onClick={() => {
            void command();
          }}
        >
          Confirmar {action === 'approve' ? 'aprovação' : 'revisão'}
        </Button>
      </RecordDialog>
    </>
  );
}
