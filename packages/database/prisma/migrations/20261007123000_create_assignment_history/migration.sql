-- CreateTable
CREATE TABLE "contact_assignment_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "from_owner_membership_id" UUID NOT NULL,
    "to_owner_membership_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "record_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_assignment_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "from_owner_membership_id" UUID NOT NULL,
    "to_owner_membership_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "record_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_assignment_history_organization_id_contact_id_recor_key" ON "contact_assignment_history"("organization_id", "contact_id", "record_version");

-- CreateIndex
CREATE UNIQUE INDEX "company_assignment_history_organization_id_company_id_recor_key" ON "company_assignment_history"("organization_id", "company_id", "record_version");

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_from_branch_id_fkey" FOREIGN KEY ("organization_id", "from_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_to_branch_id_fkey" FOREIGN KEY ("organization_id", "to_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_from_owner_memb_fkey" FOREIGN KEY ("organization_id", "from_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_to_owner_member_fkey" FOREIGN KEY ("organization_id", "to_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_assignment_history" ADD CONSTRAINT "contact_assignment_history_organization_id_actor_membershi_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "companies"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_from_branch_id_fkey" FOREIGN KEY ("organization_id", "from_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_to_branch_id_fkey" FOREIGN KEY ("organization_id", "to_branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_from_owner_memb_fkey" FOREIGN KEY ("organization_id", "from_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_to_owner_member_fkey" FOREIGN KEY ("organization_id", "to_owner_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company_assignment_history" ADD CONSTRAINT "company_assignment_history_organization_id_actor_membershi_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Structural transfer history, not generic audit/event sourcing.
ALTER TABLE contact_assignment_history ADD CONSTRAINT contact_history_version_positive CHECK (record_version>1);
ALTER TABLE company_assignment_history ADD CONSTRAINT company_history_version_positive CHECK (record_version>1);
