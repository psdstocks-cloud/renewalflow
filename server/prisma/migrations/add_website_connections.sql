-- Create WebsiteConnection table
CREATE TABLE IF NOT EXISTS "WebsiteConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConnection_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on apiKey
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteConnection_apiKey_key" ON "WebsiteConnection"("apiKey");

-- Create unique constraint on workspaceId + websiteUrl
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteConnection_workspaceId_websiteUrl_key" ON "WebsiteConnection"("workspaceId", "websiteUrl");

-- Create index on apiKey for faster lookups
CREATE INDEX IF NOT EXISTS "WebsiteConnection_apiKey_idx" ON "WebsiteConnection"("apiKey");

-- Add foreign key constraint
ALTER TABLE "WebsiteConnection" ADD CONSTRAINT "WebsiteConnection_workspaceId_fkey" 
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

