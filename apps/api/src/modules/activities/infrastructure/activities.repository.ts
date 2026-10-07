import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateActivity,
  ResourceTarget,
  TimelineQuery,
  TimelineEntry,
  ActivityResponse,
} from '@crm/contracts';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService, permits } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { TaskTargetGateway, TasksLookupGateway, targetFields } from '../../tasks/index.js';
import { OpportunitiesGateway } from '../../opportunities/index.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
@Injectable()
export class ActivitiesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(TaskTargetGateway) private readonly targets: TaskTargetGateway,
    @Inject(TasksLookupGateway) private readonly tasks: TasksLookupGateway,
    @Inject(OpportunitiesGateway) private readonly opportunities: OpportunitiesGateway,
  ) {}
  async create(context: TenantContext, input: CreateActivity): Promise<ActivityResponse> {
    const row = await persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'activities.create',
          'collection',
        );
        const parent = await this.targets.require(tx, fresh, input.target);
        if (!parent.active) throw new ApplicationError('RESOURCE_CONFLICT', 'Target archived.');
        if (
          !permits(fresh, 'activities.create', parent) ||
          !permits(fresh, 'activities.read', parent)
        )
          throw new ApplicationError('FORBIDDEN', 'Activity outside action scope.');
        return tx.activity.create({
          data: {
            organizationId: fresh.organizationId,
            actorMembershipId: fresh.membershipId,
            kind: input.kind,
            description: input.description,
            ...targetFields(input.target),
          },
        });
      }),
    );
    return {
      id: row.id,
      target: input.target,
      kind: row.kind,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    };
  }
  async timeline(context: TenantContext, target: ResourceTarget, query: TimelineQuery) {
    const tx = this.database.client;
    const parent = await this.targets.require(tx, context, target);
    if (!permits(context, 'activities.read', parent))
      throw new ApplicationError('FORBIDDEN', 'Timeline outside action scope.');
    const rows = await tx.activity.findMany({
      where: {
        AND: [
          { organizationId: context.organizationId, ...targetFields(target) },
          cursorFilter({ ...query, sort: 'createdAt', direction: 'desc' }),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const notes: TimelineEntry[] = rows.map((r) => ({
      id: r.id,
      type: 'ACTIVITY',
      name: r.kind,
      description: r.description,
      taskId: null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.createdAt.toISOString(),
    }));
    const tasks = context.grants.some((g) => g.permissions.includes('tasks.read'))
      ? await this.tasks.timeline(tx, context, target, query)
      : [];
    const stages =
      target.type === 'opportunity'
        ? await this.opportunities.timeline(tx, context, target.id, query)
        : [];
    const combined = [...notes, ...tasks, ...stages].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    return commercialPage(combined, { ...query, sort: 'createdAt', direction: 'desc' });
  }
}
