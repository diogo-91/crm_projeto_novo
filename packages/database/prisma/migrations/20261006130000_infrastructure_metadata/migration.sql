CREATE TABLE "infrastructure_metadata" (
  "key" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "infrastructure_metadata_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "infrastructure_metadata_version_positive" CHECK ("version" > 0)
);
