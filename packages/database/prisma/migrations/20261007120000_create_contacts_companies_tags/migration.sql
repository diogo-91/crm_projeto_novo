-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'WHATSAPP', 'MARKETPLACE', 'WEBSITE', 'REFERRAL', 'OUTBOUND', 'PHONE', 'IMPORT', 'OTHER');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(64),
    "normalized_phone" VARCHAR(32),
    "email" VARCHAR(254),
    "document" VARCHAR(64),
    "normalized_document" VARCHAR(64),
    "notes" VARCHAR(4000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legal_name" VARCHAR(200),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(64) NOT NULL,
    "normalized_phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(254),
    "document" VARCHAR(64),
    "normalized_document" VARCHAR(64),
    "notes" VARCHAR(4000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "company_id" UUID,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalized_name" VARCHAR(80) NOT NULL,
    "variant" VARCHAR(16) NOT NULL DEFAULT 'neutral',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("organization_id","contact_id","tag_id")
);

-- CreateIndex
CREATE INDEX "companies_organization_id_branch_id_id_idx" ON "companies"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "companies_organization_id_owner_membership_id_id_idx" ON "companies"("organization_id", "owner_membership_id", "id");

-- CreateIndex
CREATE INDEX "companies_organization_id_created_at_id_idx" ON "companies"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "companies_organization_id_updated_at_id_idx" ON "companies"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "companies_organization_id_name_id_idx" ON "companies"("organization_id", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organization_id_id_key" ON "companies"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organization_id_normalized_document_key" ON "companies"("organization_id", "normalized_document");

-- CreateIndex
CREATE INDEX "contacts_organization_id_company_id_id_idx" ON "contacts"("organization_id", "company_id", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_branch_id_id_idx" ON "contacts"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_owner_membership_id_id_idx" ON "contacts"("organization_id", "owner_membership_id", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_created_at_id_idx" ON "contacts"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_updated_at_id_idx" ON "contacts"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_name_id_idx" ON "contacts"("organization_id", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_normalized_phone_key" ON "contacts"("organization_id", "normalized_phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_id_key" ON "contacts"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_normalized_document_key" ON "contacts"("organization_id", "normalized_document");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_id_key" ON "tags"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_normalized_name_key" ON "tags"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "contact_tags_organization_id_tag_id_contact_id_idx" ON "contact_tags"("organization_id", "tag_id", "contact_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_owner_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_owner_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "companies"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_organization_id_tag_id_fkey" FOREIGN KEY ("organization_id", "tag_id") REFERENCES "tags"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Prisma cannot express CHECKs. Reinforce canonical inputs and optimistic versions.
ALTER TABLE contacts ADD CONSTRAINT contacts_phone_canonical CHECK (normalized_phone = regexp_replace(btrim(phone), '[[:space:]().-]', '', 'g') AND normalized_phone ~ '^\+?[0-9]{7,15}$');
ALTER TABLE companies ADD CONSTRAINT companies_phone_canonical CHECK ((phone IS NULL AND normalized_phone IS NULL) OR (phone IS NOT NULL AND normalized_phone IS NOT NULL AND normalized_phone = regexp_replace(btrim(phone), '[[:space:]().-]', '', 'g') AND normalized_phone ~ '^\+?[0-9]{7,15}$'));
ALTER TABLE contacts ADD CONSTRAINT contacts_document_canonical CHECK ((document IS NULL AND normalized_document IS NULL) OR (document IS NOT NULL AND normalized_document IS NOT NULL AND normalized_document = upper(regexp_replace(btrim(document), '[[:space:]./-]', '', 'g')) AND normalized_document ~ '^[A-Z0-9]{1,64}$'));
ALTER TABLE companies ADD CONSTRAINT companies_document_canonical CHECK ((document IS NULL AND normalized_document IS NULL) OR (document IS NOT NULL AND normalized_document IS NOT NULL AND normalized_document = upper(regexp_replace(btrim(document), '[[:space:]./-]', '', 'g')) AND normalized_document ~ '^[A-Z0-9]{1,64}$'));
ALTER TABLE contacts ADD CONSTRAINT contacts_email_canonical CHECK (email IS NULL OR (email = lower(btrim(email)) AND length(email)>0));
ALTER TABLE companies ADD CONSTRAINT companies_email_canonical CHECK (email IS NULL OR (email = lower(btrim(email)) AND length(email)>0));
ALTER TABLE contacts ADD CONSTRAINT contacts_version_positive CHECK (version>0);
ALTER TABLE companies ADD CONSTRAINT companies_version_positive CHECK (version>0);
ALTER TABLE tags ADD CONSTRAINT tags_version_positive CHECK (version>0);
ALTER TABLE tags ADD CONSTRAINT tags_name_canonical CHECK (normalized_name = lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AND length(normalized_name)>0);
ALTER TABLE tags ADD CONSTRAINT tags_variant_safe CHECK (variant IN ('neutral','primary','success','warning','danger','info'));
