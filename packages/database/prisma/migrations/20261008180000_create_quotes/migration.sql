-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "root_quote_id" UUID NOT NULL,
    "previous_quote_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(160) NOT NULL,
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "contact_id" UUID,
    "company_id" UUID,
    "opportunity_id" UUID,
    "price_list_id" UUID NOT NULL,
    "price_list_name" VARCHAR(160) NOT NULL,
    "buyer_snapshot" JSONB NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,
    "valid_until" DATE,
    "notes" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "approved_by_membership_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "record_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "quote_id" UUID NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_organization_id_created_at_id_idx" ON "quotes"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_owner_membership_id_created_at_id_idx" ON "quotes"("organization_id", "owner_membership_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_branch_id_created_at_id_idx" ON "quotes"("organization_id", "branch_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_opportunity_id_created_at_id_idx" ON "quotes"("organization_id", "opportunity_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_organization_id_id_key" ON "quotes"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_organization_id_root_quote_id_revision_key" ON "quotes"("organization_id", "root_quote_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_organization_id_previous_quote_id_key" ON "quotes"("organization_id", "previous_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_items_organization_id_quote_id_product_id_key" ON "quote_items"("organization_id", "quote_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_items_organization_id_quote_id_position_key" ON "quote_items"("organization_id", "quote_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quote_history_organization_id_quote_id_record_version_key" ON "quote_history"("organization_id", "quote_id", "record_version");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_actor_operation_key" ON "quote_requests"("organization_id", "actor_membership_id", "operation", "key_hash");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_owner_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "owner_membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_created_by_membership_id_fkey" FOREIGN KEY ("organization_id", "created_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_approved_by_membership_id_fkey" FOREIGN KEY ("organization_id", "approved_by_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "companies"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_opportunity_id_fkey" FOREIGN KEY ("organization_id", "opportunity_id") REFERENCES "opportunities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_price_list_id_fkey" FOREIGN KEY ("organization_id", "price_list_id") REFERENCES "price_lists"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_root_quote_id_fkey" FOREIGN KEY ("organization_id", "root_quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_previous_quote_id_fkey" FOREIGN KEY ("organization_id", "previous_quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_organization_id_product_id_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_history" ADD CONSTRAINT "quote_history_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_history" ADD CONSTRAINT "quote_history_organization_id_actor_membership_id_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_organization_id_actor_membership_id_fkey" FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Financial invariants and immutable approved documents are not expressible in Prisma.
ALTER TABLE quotes ADD CONSTRAINT quotes_invariants CHECK (
  version >= 1 AND revision >= 1 AND currency IN ('BRL','USD','EUR','GBP')
  AND (contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int = 1
  AND subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND total = subtotal - discount
  AND subtotal = round(subtotal,2) AND discount = round(discount,2) AND total = round(total,2)
  AND ((status = 'DRAFT' AND approved_at IS NULL AND approved_by_membership_id IS NULL)
    OR (status = 'APPROVED' AND approved_at IS NOT NULL AND approved_by_membership_id IS NOT NULL))
  AND ((revision = 1 AND root_quote_id = id AND previous_quote_id IS NULL)
    OR (revision > 1 AND root_quote_id <> id AND previous_quote_id IS NOT NULL))
);
ALTER TABLE quote_items ADD CONSTRAINT quote_items_calculation CHECK (
  position >= 0 AND position < 100 AND quantity > 0 AND unit_price >= 0
  AND discount_percent BETWEEN 0 AND 100
  AND subtotal = round(quantity * unit_price,2)
  AND discount = round(subtotal * discount_percent / 100,2)
  AND total = subtotal - discount
);
ALTER TABLE quote_history ADD CONSTRAINT quote_history_kind CHECK (record_version >= 1 AND kind IN ('CREATED','UPDATED','APPROVED','REVISED'));
CREATE FUNCTION quote_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior quotes%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial document deletion prohibited' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'APPROVED' THEN RAISE EXCEPTION 'Approved document immutable' USING ERRCODE='23514'; END IF;
    IF ROW(NEW.organization_id,NEW.root_quote_id,NEW.previous_quote_id,NEW.revision,NEW.branch_id,NEW.owner_membership_id,NEW.contact_id,NEW.company_id,NEW.price_list_id,NEW.opportunity_id,NEW.buyer_snapshot,NEW.currency,NEW.price_list_name,NEW.name,NEW.created_by_membership_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.organization_id,OLD.root_quote_id,OLD.previous_quote_id,OLD.revision,OLD.branch_id,OLD.owner_membership_id,OLD.contact_id,OLD.company_id,OLD.price_list_id,OLD.opportunity_id,OLD.buyer_snapshot,OLD.currency,OLD.price_list_name,OLD.name,OLD.created_by_membership_id,OLD.created_at)
      THEN RAISE EXCEPTION 'Document identity immutable' USING ERRCODE='23514'; END IF;
    IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Document version must advance' USING ERRCODE='23514'; END IF;
  ELSE
    IF NEW.status <> 'DRAFT' OR NEW.version <> 1 THEN RAISE EXCEPTION 'New document must be draft' USING ERRCODE='23514'; END IF;
    IF NEW.previous_quote_id IS NOT NULL THEN
      SELECT * INTO prior FROM quotes WHERE organization_id = NEW.organization_id AND id = NEW.previous_quote_id FOR SHARE;
      IF NOT FOUND OR prior.status <> 'APPROVED' OR prior.root_quote_id <> NEW.root_quote_id OR prior.revision + 1 <> NEW.revision
        OR prior.branch_id <> NEW.branch_id OR prior.owner_membership_id <> NEW.owner_membership_id
        THEN RAISE EXCEPTION 'Invalid revision chain' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quote_guard BEFORE INSERT OR UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION quote_guard();
CREATE FUNCTION quote_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent quotes%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT * INTO parent FROM quotes WHERE organization_id = OLD.organization_id AND id = OLD.quote_id FOR UPDATE;
    IF parent.status = 'APPROVED' THEN RAISE EXCEPTION 'Approved items immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO parent FROM quotes WHERE organization_id = NEW.organization_id AND id = NEW.quote_id FOR UPDATE;
    IF parent.status = 'APPROVED' THEN RAISE EXCEPTION 'Approved items immutable' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER quote_item_guard BEFORE INSERT OR UPDATE OR DELETE ON quote_items FOR EACH ROW EXECUTE FUNCTION quote_item_guard();
CREATE FUNCTION quote_aggregate_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent quotes%ROWTYPE; count_items int; gross numeric; reduction numeric; net numeric;
BEGIN
  SELECT * INTO parent FROM quotes WHERE organization_id = NEW.organization_id AND id = NEW.id;
  SELECT count(*),sum(subtotal),sum(discount),sum(total) INTO count_items,gross,reduction,net FROM quote_items WHERE organization_id = parent.organization_id AND quote_id = parent.id;
  IF count_items < 1 OR count_items > 100 OR ROW(gross,reduction,net) IS DISTINCT FROM ROW(parent.subtotal,parent.discount,parent.total)
    THEN RAISE EXCEPTION 'Invalid quote aggregate totals' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM quote_history WHERE organization_id = parent.organization_id AND quote_id = parent.id AND record_version = parent.version)
    THEN RAISE EXCEPTION 'Quote audit missing' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER quote_aggregate_check AFTER INSERT OR UPDATE ON quotes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quote_aggregate_check();
CREATE FUNCTION quote_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Quote ledger immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER quote_history_append_only BEFORE UPDATE OR DELETE ON quote_history FOR EACH ROW EXECUTE FUNCTION quote_append_only();
CREATE TRIGGER quote_request_append_only BEFORE UPDATE OR DELETE ON quote_requests FOR EACH ROW EXECUTE FUNCTION quote_append_only();
-- Item-only SQL writes must preserve the aggregate as well, including both parents on reparenting.
CREATE FUNCTION quote_items_aggregate_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; target_org uuid; parent quotes%ROWTYPE; gross numeric; reduction numeric; net numeric; count_items int;
BEGIN
  FOR target_org,target_id IN
    SELECT NEW.organization_id,NEW.quote_id WHERE TG_OP <> 'DELETE'
    UNION SELECT OLD.organization_id,OLD.quote_id WHERE TG_OP <> 'INSERT'
  LOOP
    SELECT * INTO parent FROM quotes WHERE organization_id = target_org AND id = target_id;
    SELECT count(*),sum(subtotal),sum(discount),sum(total) INTO count_items,gross,reduction,net FROM quote_items WHERE organization_id = target_org AND quote_id = target_id;
    IF count_items < 1 OR count_items > 100 OR ROW(gross,reduction,net) IS DISTINCT FROM ROW(parent.subtotal,parent.discount,parent.total)
      THEN RAISE EXCEPTION 'Invalid quote aggregate totals' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER quote_items_aggregate_check AFTER INSERT OR UPDATE OR DELETE ON quote_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quote_items_aggregate_check();
