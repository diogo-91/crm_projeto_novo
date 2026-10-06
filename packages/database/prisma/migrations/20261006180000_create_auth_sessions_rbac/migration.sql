-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION', 'ALL');

-- CreateEnum
CREATE TYPE "PermissionDomain" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" VARCHAR(255),
ADD COLUMN     "security_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "domain" "PermissionDomain" NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "permission_domain" "PermissionDomain" NOT NULL DEFAULT 'ORGANIZATION',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("organization_id","role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope" "AccessScope" NOT NULL,
    "scope_key" VARCHAR(64) NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_branches" (
    "organization_id" UUID NOT NULL,
    "user_role_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "user_role_branches_pkey" PRIMARY KEY ("organization_id","user_role_id","branch_id")
);

-- CreateTable
CREATE TABLE "platform_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "permission_domain" "PermissionDomain" NOT NULL DEFAULT 'PLATFORM',
    "scope" "AccessScope" NOT NULL DEFAULT 'ALL',
    "reason" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_id" UUID,
    "context_version" INTEGER NOT NULL DEFAULT 0,
    "security_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "predecessor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_id_key" ON "roles"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_id_domain_key" ON "permissions"("id", "domain");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_permission_domain_idx" ON "role_permissions"("permission_id", "permission_domain");

-- CreateIndex
CREATE INDEX "user_roles_organization_id_role_id_idx" ON "user_roles"("organization_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_organization_id_id_membership_id_key" ON "user_roles"("organization_id", "id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_organization_id_membership_id_role_id_scope_scop_key" ON "user_roles"("organization_id", "membership_id", "role_id", "scope", "scope_key");

-- CreateIndex
CREATE INDEX "user_role_branches_organization_id_membership_id_branch_id_idx" ON "user_role_branches"("organization_id", "membership_id", "branch_id");

-- CreateIndex
CREATE INDEX "platform_grants_permission_id_permission_domain_idx" ON "platform_grants"("permission_id", "permission_domain");

-- CreateIndex
CREATE UNIQUE INDEX "platform_grants_user_id_permission_id_key" ON "platform_grants"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_predecessor_id_key" ON "refresh_tokens"("predecessor_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_session_id_id_key" ON "refresh_tokens"("session_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_user_id_id_key" ON "organization_memberships"("user_id", "id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "roles"("organization_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permission_domain_fkey" FOREIGN KEY ("permission_id", "permission_domain") REFERENCES "permissions"("id", "domain") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "organization_memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "roles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_role_branches" ADD CONSTRAINT "user_role_branches_organization_id_user_role_id_membership_fkey" FOREIGN KEY ("organization_id", "user_role_id", "membership_id") REFERENCES "user_roles"("organization_id", "id", "membership_id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_role_branches" ADD CONSTRAINT "user_role_branches_organization_id_membership_id_branch_id_fkey" FOREIGN KEY ("organization_id", "membership_id", "branch_id") REFERENCES "membership_branches"("organization_id", "membership_id", "branch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "platform_grants" ADD CONSTRAINT "platform_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "platform_grants" ADD CONSTRAINT "platform_grants_permission_id_permission_domain_fkey" FOREIGN KEY ("permission_id", "permission_domain") REFERENCES "permissions"("id", "domain") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_membership_id_fkey" FOREIGN KEY ("user_id", "membership_id") REFERENCES "organization_memberships"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_predecessor_id_fkey" FOREIGN KEY ("session_id", "predecessor_id") REFERENCES "refresh_tokens"("session_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Tenant grants cannot contain platform capabilities or ambiguous branch cardinality.
ALTER TABLE users ADD CONSTRAINT users_security_version_check CHECK (security_version >= 0),
 ADD CONSTRAINT users_password_hash_check CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%');
ALTER TABLE sessions ADD CONSTRAINT sessions_versions_check CHECK (context_version >= 0 AND security_version >= 0);
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_domain_check CHECK (permission_domain = 'ORGANIZATION');
ALTER TABLE platform_grants ADD CONSTRAINT platform_grants_domain_scope_check CHECK (permission_domain = 'PLATFORM' AND scope = 'ALL' AND length(trim(reason)) > 0);
ALTER TABLE user_roles ADD CONSTRAINT user_roles_tenant_scope_check CHECK (scope <> 'ALL'),
 ADD CONSTRAINT user_roles_scope_key_check CHECK ((scope IN ('OWN','ORGANIZATION') AND scope_key = 'none') OR (scope IN ('BRANCH','BRANCH_SET') AND scope_key ~ '^[a-f0-9]{64}$'));
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$');
CREATE FUNCTION check_grant_branches() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_id uuid; grant_scope "AccessScope"; branch_count bigint;
BEGIN
 IF TG_TABLE_NAME = 'user_roles' THEN grant_id := COALESCE(NEW.id, OLD.id);
 ELSE grant_id := COALESCE(NEW.user_role_id, OLD.user_role_id); END IF;
 SELECT scope INTO grant_scope FROM user_roles WHERE id = grant_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*) INTO branch_count FROM user_role_branches WHERE user_role_id = grant_id;
 IF (grant_scope = 'BRANCH' AND branch_count <> 1)
 OR (grant_scope = 'BRANCH_SET' AND branch_count < 1)
 OR (grant_scope IN ('OWN','ORGANIZATION') AND branch_count <> 0) THEN
  RAISE EXCEPTION 'Invalid grant branch cardinality' USING ERRCODE = '23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER user_roles_branches_check AFTER INSERT OR UPDATE ON user_roles
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_grant_branches();
CREATE CONSTRAINT TRIGGER user_role_branches_check AFTER INSERT OR UPDATE OR DELETE ON user_role_branches
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_grant_branches();
