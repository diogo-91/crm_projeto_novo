'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button, EmptyState, toast } from '@crm/ui';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { usePermission } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/api-client';
import { useNotifications, useReadNotification } from './queries';
export function NotificationsInbox() {
  const [open, setOpen] = useState(false),
    [unread, setUnread] = useState(true);
  const query = useNotifications(unread);
  const read = useReadNotification();
  const canRead = usePermission('notifications.read'),
    canUpdate = usePermission('notifications.update');
  if (!canRead) return null;
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Abrir notificações"
        onClick={() => setOpen(true)}
      >
        <Bell aria-hidden="true" />
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Notificações"
        description="Lembretes destinados a você nesta organização."
      >
        <Button variant="secondary" className="mb-4" onClick={() => setUnread(!unread)}>
          {unread ? 'Mostrar todas' : 'Somente não lidas'}
        </Button>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <QueryError
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : !rows.length ? (
          <EmptyState title="Nenhuma notificação" description="Seus lembretes aparecerão aqui." />
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border p-4">
                <p className="font-medium">Lembrete de tarefa</p>
                <Link
                  className="mt-1 block break-words text-foreground underline"
                  href={`/tasks/${row.task.id}`}
                  onClick={() => setOpen(false)}
                >
                  {row.task.name}
                </Link>
                <time className="text-caption text-muted" dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString('pt-BR')}
                </time>
                {!row.readAt && canUpdate && (
                  <Button
                    className="mt-3 block"
                    variant="secondary"
                    loading={read.isPending}
                    onClick={() => {
                      void read
                        .mutateAsync(row.id)
                        .catch((error) => toast.error(errorMessage(error)));
                    }}
                  >
                    Marcar como lida
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <Button
            className="mt-4"
            loading={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            Carregar mais notificações
          </Button>
        )}
      </RecordDialog>
    </>
  );
}
