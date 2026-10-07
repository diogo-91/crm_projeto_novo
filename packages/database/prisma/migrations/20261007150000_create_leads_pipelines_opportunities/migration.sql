-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "kind" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(4000),
    "contact_id" UUID,
    "company_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "phone" VARCHAR(64),
    "normalized_phone" VARCHAR(32),
    "email" VARCHAR(254),
    "company_name" VARCHAR(160),
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "converted_at" TIMESTAMPTZ(6),
    "conversion_request_hash" VARCHAR(64),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(4000),
    "contact_id" UUID,
    "company_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "lead_id" UUID,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "closed_at" TIMESTAMPTZ(6),
    "lost_reason" VARCHAR(500),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "from_pipeline_id" UUID,
    "to_pipeline_id" UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "from_stage_name" VARCHAR(160),
    "to_stage_name" VARCHAR(160) NOT NULL,
    "from_status" "DealStatus",
    "to_status" "DealStatus" NOT NULL,
    "reason" VARCHAR(500),
    "record_version" INTEGER NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignment_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "from_owner_membership_id" UUID NOT NULL,
    "to_owner_membership_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "record_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_assignment_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "from_owner_membership_id" UUID NOT NULL,
    "to_owner_membership_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "record_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_organization_id_branch_id_id_idx" ON "pipelines"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_organization_id_id_key" ON "pipelines"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_organization_id_normalized_name_key" ON "pipelines"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "pipeline_stages_organization_id_pipeline_id_position_id_idx" ON "pipeline_stages"("organization_id", "pipeline_id", "position", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_organization_id_pipeline_id_id_key" ON "pipeline_stages"("organization_id", "pipeline_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_organization_id_pipeline_id_id_kind_key" ON "pipeline_stages"("organization_id", "pipeline_id", "id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_organization_id_pipeline_id_normalized_name_key" ON "pipeline_stages"("organization_id", "pipeline_id", "normalized_name");

-- CreateIndex
CREATE INDEX "leads_organization_id_branch_id_id_idx" ON "leads"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "leads_organization_id_owner_membership_id_id_idx" ON "leads"("organization_id", "owner_membership_id", "id");

-- CreateIndex
CREATE INDEX "leads_organization_id_created_at_id_idx" ON "leads"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "leads_organization_id_updated_at_id_idx" ON "leads"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "leads_organization_id_name_id_idx" ON "leads"("organization_id", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organization_id_id_key" ON "leads"("organization_id", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_pipeline_id_stage_id_created__idx" ON "opportunities"("organization_id", "pipeline_id", "stage_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_branch_id_id_idx" ON "opportunities"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_owner_membership_id_id_idx" ON "opportunities"("organization_id", "owner_membership_id", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_created_at_id_idx" ON "opportunities"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_updated_at_id_idx" ON "opportunities"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_name_id_idx" ON "opportunities"("organization_id", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_organization_id_lead_id_key" ON "opportunities"("organization_id", "lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_organization_id_id_key" ON "opportunities"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_stage_history_organization_id_opportunity_id_re_key" ON "opportunity_stage_history"("organization_id", "opportunity_id", "record_version");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignment_history_organization_id_lead_id_record_vers_key" ON "lead_assignment_history"("organization_id", "lead_id", "record_version");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_assignment_history_organization_id_opportunity__key" ON "opportunity_assignment_history"("organization_id", "opportunity_id", "record_version");

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_pipeline_id_fkey" FOREIGN KEY ("organization_id", "pipeline_id") REFERENCES "pipelines"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_owner_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "companies"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_owner_membership_id_branch_i_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "companies"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_pipeline_id_fkey" FOREIGN KEY ("organization_id", "pipeline_id") REFERENCES "pipelines"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_pipeline_id_stage_id_status_fkey" FOREIGN KEY ("organization_id", "pipeline_id", "stage_id", "status") REFERENCES "pipeline_stages"("organization_id", "pipeline_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_organization_id_opportunity_id_fkey" FOREIGN KEY ("organization_id", "opportunity_id") REFERENCES "opportunities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_organization_id_actor_membership_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "stage_history_from_pipeline_fk" FOREIGN KEY ("organization_id", "from_pipeline_id") REFERENCES "pipelines"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "stage_history_to_pipeline_fk" FOREIGN KEY ("organization_id", "to_pipeline_id") REFERENCES "pipelines"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "stage_history_from_stage_fk" FOREIGN KEY ("organization_id", "from_pipeline_id", "from_stage_id") REFERENCES "pipeline_stages"("organization_id", "pipeline_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "stage_history_to_stage_fk" FOREIGN KEY ("organization_id", "to_pipeline_id", "to_stage_id") REFERENCES "pipeline_stages"("organization_id", "pipeline_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_lead_id_fkey" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_from_branch_id_fkey" FOREIGN KEY ("organization_id", "from_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_to_branch_id_fkey" FOREIGN KEY ("organization_id", "to_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_from_owner_members_fkey" FOREIGN KEY ("organization_id", "from_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_to_owner_membershi_fkey" FOREIGN KEY ("organization_id", "to_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_organization_id_actor_membership_i_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_opportunity_fkey" FOREIGN KEY ("organization_id", "opportunity_id") REFERENCES "opportunities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_from_branch_fkey" FOREIGN KEY ("organization_id", "from_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_to_branch_i_fkey" FOREIGN KEY ("organization_id", "to_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_from_owner__fkey" FOREIGN KEY ("organization_id", "from_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_to_owner_me_fkey" FOREIGN KEY ("organization_id", "to_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "opportunity_assignment_history" ADD CONSTRAINT "opportunity_assignment_history_organization_id_actor_membe_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Canonical values, lifecycle and history invariants not representable in Prisma.
ALTER TABLE leads ADD CONSTRAINT leads_phone_canonical CHECK ((phone IS NULL AND normalized_phone IS NULL) OR (phone IS NOT NULL AND normalized_phone IS NOT NULL AND normalized_phone = regexp_replace(btrim(phone), '[[:space:]().-]', '', 'g') AND normalized_phone ~ '^\+?[0-9]{7,15}$'));
ALTER TABLE leads ADD CONSTRAINT leads_email_canonical CHECK (email IS NULL OR (email = lower(btrim(email)) AND length(email)>0));
ALTER TABLE leads ADD CONSTRAINT leads_conversion_consistent CHECK ((status='CONVERTED' AND converted_at IS NOT NULL AND conversion_request_hash IS NOT NULL AND conversion_request_hash ~ '^[a-f0-9]{64}$') OR (status<>'CONVERTED' AND converted_at IS NULL AND conversion_request_hash IS NULL));
ALTER TABLE opportunities ADD CONSTRAINT opportunities_amount_nonnegative CHECK (amount >= 0);
ALTER TABLE opportunities ADD CONSTRAINT opportunities_currency_supported CHECK (currency IN ('BRL','USD','EUR','GBP'));
ALTER TABLE opportunities ADD CONSTRAINT opportunities_outcome_consistent CHECK ((status='OPEN' AND closed_at IS NULL AND lost_reason IS NULL) OR (status='WON' AND closed_at IS NOT NULL AND lost_reason IS NULL) OR (status='LOST' AND closed_at IS NOT NULL AND lost_reason IS NOT NULL AND length(btrim(lost_reason))>0));
ALTER TABLE pipelines ADD CONSTRAINT pipelines_name_canonical CHECK (normalized_name = lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AND length(normalized_name)>0);
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_name_canonical CHECK (normalized_name = lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AND length(normalized_name)>0);
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_position_nonnegative CHECK (position >= 0);
ALTER TABLE opportunity_stage_history ADD CONSTRAINT stage_history_source_complete CHECK ((from_pipeline_id IS NULL AND from_stage_id IS NULL AND from_stage_name IS NULL AND from_status IS NULL AND record_version=1) OR (from_pipeline_id IS NOT NULL AND from_stage_id IS NOT NULL AND from_stage_name IS NOT NULL AND from_status IS NOT NULL AND record_version>1));
ALTER TABLE opportunity_stage_history ADD CONSTRAINT stage_history_loss_reason CHECK ((to_status='LOST' AND reason IS NOT NULL AND length(btrim(reason))>0) OR (to_status<>'LOST' AND reason IS NULL));
ALTER TABLE leads ADD CONSTRAINT leads_version_positive CHECK (version > 0);
ALTER TABLE opportunities ADD CONSTRAINT opportunities_version_positive CHECK (version > 0);
ALTER TABLE pipelines ADD CONSTRAINT pipelines_version_positive CHECK (version > 0);
ALTER TABLE lead_assignment_history ADD CONSTRAINT lead_assignment_history_version_valid CHECK (record_version > 1);
ALTER TABLE opportunity_assignment_history ADD CONSTRAINT opportunity_assignment_history_version_valid CHECK (record_version > 1);
