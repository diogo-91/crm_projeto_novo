-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('TASK', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskEventKind" AS ENUM ('CREATED', 'UPDATED', 'COMPLETED', 'REOPENED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING');

-- CreateEnum
CREATE TYPE "ReminderState" AS ENUM ('PENDING', 'DISPATCHED', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(4000),
    "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "due_at" TIMESTAMPTZ(6),
    "remind_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "contact_id" UUID,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reminder_version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "kind" "TaskEventKind" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "record_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "contact_id" UUID,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reminders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "recipient_membership_id" UUID NOT NULL,
    "scheduled_version" INTEGER NOT NULL,
    "state" "ReminderState" NOT NULL DEFAULT 'PENDING',
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(64),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recipient_membership_id" UUID NOT NULL,
    "reminder_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_organization_id_created_at_id_idx" ON "tasks"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_owner_membership_id_due_at_id_idx" ON "tasks"("organization_id", "owner_membership_id", "due_at", "id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_branch_id_created_at_id_idx" ON "tasks"("organization_id", "branch_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_contact_id_idx" ON "tasks"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_lead_id_idx" ON "tasks"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_opportunity_id_idx" ON "tasks"("organization_id", "opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_id_key" ON "tasks"("organization_id", "id");

-- CreateIndex
CREATE INDEX "task_history_organization_id_created_at_id_idx" ON "task_history"("organization_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_history_organization_id_task_id_record_version_key" ON "task_history"("organization_id", "task_id", "record_version");

-- CreateIndex
CREATE INDEX "activities_organization_id_contact_id_created_at_id_idx" ON "activities"("organization_id", "contact_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "activities_organization_id_lead_id_created_at_id_idx" ON "activities"("organization_id", "lead_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "activities_organization_id_opportunity_id_created_at_id_idx" ON "activities"("organization_id", "opportunity_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_organization_id_id_key" ON "activities"("organization_id", "id");

-- CreateIndex
CREATE INDEX "task_reminders_state_available_at_lease_until_id_idx" ON "task_reminders"("state", "available_at", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminders_organization_id_id_recipient_membership_id_key" ON "task_reminders"("organization_id", "id", "recipient_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminders_organization_id_id_key" ON "task_reminders"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminders_organization_id_task_id_scheduled_version_key" ON "task_reminders"("organization_id", "task_id", "scheduled_version");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_membership_id_creat_idx" ON "notifications"("organization_id", "recipient_membership_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_reminder_recipient_key" ON "notifications"("organization_id", "reminder_id", "recipient_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_organization_id_id_key" ON "notifications"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_owner_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_opportunity_id_fkey" FOREIGN KEY ("organization_id", "opportunity_id") REFERENCES "opportunities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_organization_id_actor_membership_id_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_actor_membership_id_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_opportunity_id_fkey" FOREIGN KEY ("organization_id", "opportunity_id") REFERENCES "opportunities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_organization_id_recipient_membership_id_fkey" FOREIGN KEY ("organization_id", "recipient_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_recipient_membership_id_fkey" FOREIGN KEY ("organization_id", "recipient_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_reminder_id_recipient_member_fkey" FOREIGN KEY ("organization_id", "reminder_id", "recipient_membership_id") REFERENCES "task_reminders"("organization_id", "id", "recipient_membership_id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Prisma does not express these domain CHECKs. Direct SQL writes must obey them too.
ALTER TABLE tasks ADD CONSTRAINT tasks_target_cardinality CHECK (num_nonnulls(contact_id,lead_id,opportunity_id) <= 1);
ALTER TABLE tasks ADD CONSTRAINT tasks_positive_versions CHECK (version > 0 AND reminder_version > 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_name_trimmed CHECK (name = btrim(name) AND length(name) > 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_completion_consistent CHECK ((status = 'OPEN' AND completed_at IS NULL) OR (status = 'COMPLETED' AND completed_at IS NOT NULL));
ALTER TABLE tasks ADD CONSTRAINT tasks_reminder_date CHECK (remind_at IS NULL OR (due_at IS NOT NULL AND remind_at <= due_at));
ALTER TABLE task_history ADD CONSTRAINT task_history_positive_version CHECK (record_version > 0);
ALTER TABLE activities ADD CONSTRAINT activities_one_target CHECK (num_nonnulls(contact_id,lead_id,opportunity_id) = 1);
ALTER TABLE activities ADD CONSTRAINT activities_description CHECK (description = btrim(description) AND length(description) > 0);
ALTER TABLE task_reminders ADD CONSTRAINT reminders_attempt_bounds CHECK (attempt_count BETWEEN 0 AND 5 AND scheduled_version > 0);
ALTER TABLE task_reminders ADD CONSTRAINT reminders_completion CHECK ((state = 'COMPLETED' AND completed_at IS NOT NULL) OR (state <> 'COMPLETED' AND completed_at IS NULL));
ALTER TABLE task_reminders ADD CONSTRAINT reminders_lease CHECK ((state = 'DISPATCHED' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (state <> 'DISPATCHED' AND lease_token IS NULL AND lease_until IS NULL));
ALTER TABLE task_reminders ADD CONSTRAINT reminders_failure CHECK (state <> 'FAILED' OR attempt_count = 5);
