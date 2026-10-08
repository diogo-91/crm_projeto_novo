-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "unit" VARCHAR(32) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_organization_id_name_id_idx" ON "products"("organization_id", "name", "id");

-- CreateIndex
CREATE INDEX "products_organization_id_created_at_id_idx" ON "products"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "products_organization_id_updated_at_id_idx" ON "products"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_id_key" ON "products"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_branch_id_id_idx" ON "price_lists"("organization_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_name_id_idx" ON "price_lists"("organization_id", "name", "id");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_created_at_id_idx" ON "price_lists"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_updated_at_id_idx" ON "price_lists"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_organization_id_id_key" ON "price_lists"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_organization_id_normalized_name_key" ON "price_lists"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "price_list_items_organization_id_price_list_id_id_idx" ON "price_list_items"("organization_id", "price_list_id", "id");

-- CreateIndex
CREATE INDEX "price_list_items_organization_id_product_id_idx" ON "price_list_items"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_organization_id_price_list_id_product_id_key" ON "price_list_items"("organization_id", "price_list_id", "product_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_branch_id_fkey" FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_organization_id_price_list_id_fkey" FOREIGN KEY ("organization_id", "price_list_id") REFERENCES "price_lists"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_organization_id_product_id_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_organization_id_updated_by_membership_id_fkey" FOREIGN KEY ("organization_id", "updated_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Domain checks not expressible in Prisma. Reject precision overflow in DTOs before storage.
ALTER TABLE "products" ADD CONSTRAINT "products_content_check" CHECK (sku ~ '^[A-Z0-9][A-Z0-9_.-]{0,63}$' AND name = btrim(name) AND length(name) > 0 AND unit = btrim(unit) AND length(unit) > 0 AND version >= 1);
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_content_check" CHECK (name = btrim(name) AND length(name) > 0 AND normalized_name = lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AND currency IN ('BRL','USD','EUR','GBP') AND version >= 1);
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_check" CHECK (unit_price >= 0);
