'use client';
import { Select, FormField, Button } from '@crm/ui';
import { usePipelines, usePipeline } from './queries';
import { QueryError } from '@/features/commercial/query-feedback';
export function PipelinePicker({
  pipelineId,
  stageId,
  onPipeline,
  onStage,
  branchId = '',
  openOnly = false,
  existing,
  error,
}: {
  pipelineId: string;
  stageId?: string;
  onPipeline: (id: string) => void;
  onStage?: (id: string) => void;
  branchId?: string;
  openOnly?: boolean;
  existing?: { id: string; name: string };
  error?: string | undefined;
}) {
  const list = usePipelines(branchId),
    detail = usePipeline(pipelineId);
  const options = (list.data?.pages.flatMap((page) => page.data) ?? []).map((row) => ({
    value: row.id,
    label: row.name,
  }));
  if (existing && !options.some((option) => option.value === existing.id))
    options.unshift({ value: existing.id, label: existing.name });
  if (pipelineId && detail.data && !options.some((option) => option.value === pipelineId))
    options.unshift({ value: pipelineId, label: detail.data.name });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="sales-pipeline" label="Pipeline" error={error}>
        <Select
          id="sales-pipeline"
          label="Pipeline"
          value={pipelineId}
          options={[{ value: '', label: 'Selecione um pipeline' }, ...options]}
          onValueChange={onPipeline}
          disabled={list.isPending}
        />
        {list.isError && (
          <QueryError
            error={list.error}
            retry={() => {
              void list.refetch();
            }}
          />
        )}
        {list.hasNextPage && (
          <Button
            variant="link"
            onClick={() => {
              void list.fetchNextPage();
            }}
          >
            Mais pipelines
          </Button>
        )}
      </FormField>
      {onStage && (
        <FormField id="sales-stage" label="Etapa">
          <Select
            id="sales-stage"
            label="Etapa"
            value={stageId ?? ''}
            options={[
              { value: '', label: 'Selecione uma etapa' },
              ...(
                detail.data?.stages.filter(
                  (stage) => stage.active && (!openOnly || stage.kind === 'OPEN'),
                ) ?? []
              ).map((stage) => ({ value: stage.id, label: stage.name })),
            ]}
            onValueChange={onStage}
            disabled={!pipelineId || detail.isPending}
          />
          {detail.isError && (
            <QueryError
              error={detail.error}
              retry={() => {
                void detail.refetch();
              }}
            />
          )}
        </FormField>
      )}
    </div>
  );
}
