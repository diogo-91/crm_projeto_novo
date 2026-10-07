import type { InfiniteData } from '@tanstack/react-query';
import type {
  OpportunityResponse,
  OpportunityListResponse,
  StageResponse,
  MoveOpportunity,
} from '@crm/contracts';
export function optimisticStage(
  record: OpportunityResponse,
  stage: StageResponse,
  input: MoveOpportunity,
): OpportunityResponse {
  return {
    ...record,
    stage,
    status: stage.kind,
    version: record.version + 1,
    closedAt: stage.kind === 'OPEN' ? null : new Date().toISOString(),
    lostReason: stage.kind === 'LOST' ? (input.reason ?? null) : null,
  };
}
export function moveColumn(
  data: InfiniteData<OpportunityListResponse>,
  record: OpportunityResponse,
  insert: boolean,
): InfiniteData<OpportunityListResponse> {
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      data: [
        ...(insert && index === 0 ? [record] : []),
        ...page.data.filter((row) => row.id !== record.id),
      ],
    })),
  };
}
