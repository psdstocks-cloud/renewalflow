-- Drop the incorrect unique index on "key" if it exists
DROP INDEX IF EXISTS "AppSettings_key_key";

-- Ensure the correct unique index on "workspaceId" + "key" exists
-- (If it already exists, this might error in older Postgres, using IF NOT EXISTS is safer)
CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_workspaceId_key_key" ON "AppSettings"("workspaceId", "key");
