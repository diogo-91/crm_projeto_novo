import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TaskList } from '@/features/tasks/task-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Tarefas' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TaskList />
    </Suspense>
  );
}
