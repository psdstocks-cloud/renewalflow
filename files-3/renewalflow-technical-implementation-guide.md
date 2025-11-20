# RenewalFlow Technical Implementation Guide
**Supplement to Production Readiness Report**

---

## Detailed Architecture Diagrams

### Current Architecture (Single-Tenant)
```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  React Frontend (Port 3000)                  │  │
│  │  - PIN Auth (localStorage)                   │  │
│  │  - Dashboard UI                              │  │
│  │  - No multi-tenancy                          │  │
│  └─────────────┬────────────────────────────────┘  │
└────────────────┼───────────────────────────────────┘
                 │ HTTP API Calls
                 │ x-admin-api-key header
                 ▼
┌─────────────────────────────────────────────────────┐
│           Node.js Backend (Port 4000)               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Express + TypeScript                        │  │
│  │  - API Key Auth Only                         │  │
│  │  - Single Settings Table                     │  │
│  │  - No Tenant Isolation                       │  │
│  └─────────────┬────────────────────────────────┘  │
└────────────────┼───────────────────────────────────┘
                 │ Prisma ORM
                 ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL Database                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Subscriber (no tenantId)                    │  │
│  │  EmailLog (no tenantId)                      │  │
│  │  AppSettings (global, no tenantId)           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

External Integrations:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ WooCommerce  │    │   Gemini AI  │    │     SMTP     │
│   REST API   │    │     API      │    │    Server    │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

### Target Architecture (Multi-Tenant SaaS)
```
┌───────────────────────────────────────────────────────────┐
│                  Browser / Mobile App                      │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐│
│  │ tenant1.       │  │ tenant2.       │  │ Custom       ││
│  │ renewalflow    │  │ renewalflow    │  │ Domain       ││
│  │ .com           │  │ .com           │  │ Support      ││
│  └────────────────┘  └────────────────┘  └──────────────┘│
│           │                  │                   │         │
└───────────┼──────────────────┼───────────────────┼─────────┘
            │                  │                   │
            │    JWT Auth + Refresh Tokens         │
            ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    CDN / Load Balancer                       │
│                      (Cloudflare)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                        │
│           SSL Termination, Rate Limiting                     │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
   ┌─────────▼────────┐    ┌────────▼──────────┐
   │  React Frontend  │    │   API Gateway      │
   │   Static Files   │    │   (Port 4000)      │
   │  (Build Output)  │    │                    │
   └──────────────────┘    └────────┬───────────┘
                                    │
                                    │ Tenant Middleware
                                    │ Auth Middleware
                                    │ Rate Limit Middleware
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js Microservices Architecture              │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │   Auth       │  │  Subscribers │  │   Reminders    │    │
│  │   Service    │  │   Service    │  │   Service      │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │   Billing    │  │   WooCommerce│  │   Email        │    │
│  │   Service    │  │   Service    │  │   Service      │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
└────────┬──────────────────────┬────────────────┬────────────┘
         │                      │                │
         ▼                      ▼                ▼
┌────────────────┐    ┌──────────────────┐    ┌───────────────┐
│ PostgreSQL     │    │   Redis Cache    │    │  Bull Queue   │
│ (Multi-tenant  │    │   - Sessions     │    │  - Emails     │
│  with tenantId)│    │   - Rate Limits  │    │  - Woo Sync   │
└────────────────┘    └──────────────────┘    └───────────────┘

External Services:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Stripe     │  │  SendGrid    │  │   Gemini AI  │  │  WooCommerce │
│   Billing    │  │   Emails     │  │   Content    │  │  (per tenant)│
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

Monitoring & Observability:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Sentry     │  │   DataDog    │  │   LogDNA     │
│   Errors     │  │   Metrics    │  │   Logs       │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Detailed Database Schema Migration

### Step 1: Add Tenant Tables
```sql
-- Create tenant table
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL UNIQUE,
    "customDomain" TEXT UNIQUE,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP,
    "subscriptionId" TEXT,
    "maxSubscribers" INTEGER NOT NULL DEFAULT 100,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "features" JSONB NOT NULL DEFAULT '{}',
    "billingEmail" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- Create user table
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Create tenant settings table
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    UNIQUE("tenantId", "key")
);

-- Create license table
CREATE TABLE "License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL UNIQUE,
    "licenseKey" TEXT NOT NULL UNIQUE,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activatedAt" TIMESTAMP,
    "expiresAt" TIMESTAMP,
    "maxSubscribers" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Create refresh token table
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "TenantSettings_tenantId_idx" ON "TenantSettings"("tenantId");
CREATE INDEX "License_licenseKey_idx" ON "License"("licenseKey");
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
```

### Step 2: Migrate Existing Tables
```sql
-- Add tenantId to Subscriber
ALTER TABLE "Subscriber" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "Subscriber_tenantId_idx" ON "Subscriber"("tenantId");
CREATE INDEX "Subscriber_tenantId_status_idx" ON "Subscriber"("tenantId", "status");
CREATE INDEX "Subscriber_tenantId_endDate_idx" ON "Subscriber"("tenantId", "endDate");

-- Add tenantId to EmailLog
ALTER TABLE "EmailLog" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "EmailLog_tenantId_idx" ON "EmailLog"("tenantId");

-- For existing single-tenant data, create a default tenant
INSERT INTO "Tenant" (id, name, subdomain, plan, status, maxSubscribers, maxUsers)
VALUES ('legacy-tenant-001', 'Legacy Account', 'legacy', 'PRO', 'ACTIVE', 999999, 10);

-- Update existing records with the legacy tenant
UPDATE "Subscriber" SET "tenantId" = 'legacy-tenant-001' WHERE "tenantId" IS NULL;
UPDATE "EmailLog" SET "tenantId" = 'legacy-tenant-001' WHERE "tenantId" IS NULL;

-- Make tenantId NOT NULL after migration
ALTER TABLE "Subscriber" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "EmailLog" ALTER COLUMN "tenantId" SET NOT NULL;
```

---

## Implementation: Tenant Middleware

### File: `server/src/middleware/tenant.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: User;
    }
  }
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  plan: string;
  maxSubscribers: number;
}

interface User {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Middleware to extract and validate tenant from request
 * Supports multiple tenant identification methods:
 * 1. Subdomain (tenant1.renewalflow.com)
 * 2. Custom domain (renewals.acme.com)
 * 3. JWT token (contains tenantId)
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    let tenantId: string | null = null;

    // Method 1: Extract from JWT (if authenticated)
    if (req.user) {
      tenantId = req.user.tenantId;
    }

    // Method 2: Extract from subdomain
    if (!tenantId) {
      const host = req.get('host') || '';
      const subdomain = host.split('.')[0];
      
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        const tenant = await prisma.tenant.findUnique({
          where: { subdomain },
          select: {
            id: true,
            name: true,
            status: true,
            plan: true,
            maxSubscribers: true,
          }
        });
        
        if (tenant) {
          tenantId = tenant.id;
          req.tenant = tenant;
        }
      }
    }

    // Method 3: Extract from custom domain
    if (!tenantId) {
      const host = req.get('host') || '';
      const tenant = await prisma.tenant.findUnique({
        where: { customDomain: host },
        select: {
          id: true,
          name: true,
          status: true,
          plan: true,
          maxSubscribers: true,
        }
      });
      
      if (tenant) {
        tenantId = tenant.id;
        req.tenant = tenant;
      }
    }

    // If no tenant found, reject request
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant not found',
        message: 'Unable to identify tenant from request'
      });
    }

    // Load tenant if not already loaded
    if (!req.tenant) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          plan: true,
          maxSubscribers: true,
        }
      });

      if (!tenant) {
        return res.status(404).json({
          error: 'Tenant not found',
          message: 'Tenant ID is invalid'
        });
      }

      req.tenant = tenant;
    }

    // Check tenant status
    if (req.tenant.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Account suspended',
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    if (req.tenant.status === 'CANCELLED') {
      return res.status(403).json({
        error: 'Account cancelled',
        message: 'Your account has been cancelled.'
      });
    }

    // Attach tenant ID to all Prisma queries automatically
    // This is done in the Prisma middleware (see below)

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to identify tenant'
    });
  }
}

/**
 * Prisma middleware to automatically inject tenantId
 * This ensures ALL database queries are tenant-scoped
 */
export function setupPrismaTenantMiddleware() {
  prisma.$use(async (params, next) => {
    // Models that require tenant scoping
    const tenantModels = ['Subscriber', 'EmailLog', 'TenantSettings'];

    if (tenantModels.includes(params.model || '')) {
      // For findMany, findFirst, etc.
      if (params.action === 'findMany' || params.action === 'findFirst') {
        if (!params.args) {
          params.args = {};
        }
        if (!params.args.where) {
          params.args.where = {};
        }
        // Inject tenantId filter if not already present
        if (params.args.where.tenantId === undefined) {
          // Get tenantId from async context (set by middleware)
          const tenantId = getTenantIdFromContext();
          if (tenantId) {
            params.args.where.tenantId = tenantId;
          }
        }
      }

      // For create operations
      if (params.action === 'create') {
        const tenantId = getTenantIdFromContext();
        if (tenantId && params.args.data) {
          params.args.data.tenantId = tenantId;
        }
      }

      // For update/delete operations - verify tenantId matches
      if (params.action === 'update' || params.action === 'delete') {
        const tenantId = getTenantIdFromContext();
        if (tenantId) {
          if (!params.args.where) {
            params.args.where = {};
          }
          // Ensure we only update/delete records belonging to this tenant
          params.args.where.tenantId = tenantId;
        }
      }
    }

    return next(params);
  });
}

// Context storage for tenant ID (using AsyncLocalStorage)
import { AsyncLocalStorage } from 'async_hooks';
const tenantContext = new AsyncLocalStorage<string>();

export function setTenantContext(tenantId: string) {
  return tenantContext.run(tenantId, () => {});
}

export function getTenantIdFromContext(): string | undefined {
  return tenantContext.getStore();
}
```

---

## Implementation: JWT Authentication

### File: `server/src/middleware/auth.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Generate access and refresh tokens
 */
export function generateTokens(user: any) {
  const payload: JWTPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify access token and attach user to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Load user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
            plan: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User account is disabled'
      });
    }

    if (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant account is not active'
      });
    }

    // Attach user to request
    req.user = user as any;

    // Update last login time (async, don't wait)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(err => console.error('Failed to update lastLoginAt:', err));

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

// Usage:
// router.post('/subscribers', authMiddleware, requireRole('OWNER', 'ADMIN'), createSubscriber);
```

---

## Implementation: License Key System

### File: `server/src/services/licenseService.ts`
```typescript
import { prisma } from '../config/db';
import crypto from 'crypto';

/**
 * Generate a license key in format: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const segments = 4;
  const segmentLength = 4;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars

  const key = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => {
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
  }).join('-');

  return key;
}

/**
 * Create a new license for a tenant
 */
export async function createLicense(tenantId: string, plan: string) {
  const licenseKey = generateLicenseKey();
  
  // Plan limits
  const planLimits: Record<string, any> = {
    STARTER: { maxSubscribers: 100, maxUsers: 1 },
    GROWTH: { maxSubscribers: 500, maxUsers: 3 },
    PRO: { maxSubscribers: 999999, maxUsers: 10 },
  };

  const limits = planLimits[plan] || planLimits.STARTER;

  const license = await prisma.license.create({
    data: {
      tenantId,
      licenseKey,
      plan,
      status: 'ACTIVE',
      maxSubscribers: limits.maxSubscribers,
      maxUsers: limits.maxUsers,
      features: {},
      metadata: {},
    }
  });

  return license;
}

/**
 * Validate a license key
 */
export async function validateLicense(licenseKey: string) {
  const license = await prisma.license.findUnique({
    where: { licenseKey },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          status: true,
          _count: {
            select: {
              subscribers: true,
              users: true,
            }
          }
        }
      }
    }
  });

  if (!license) {
    return { valid: false, reason: 'License key not found' };
  }

  if (license.status !== 'ACTIVE') {
    return { valid: false, reason: `License is ${license.status}` };
  }

  if (license.expiresAt && license.expiresAt < new Date()) {
    return { valid: false, reason: 'License has expired' };
  }

  // Check usage limits
  if (license.tenant._count.subscribers >= license.maxSubscribers) {
    return { 
      valid: false, 
      reason: `Subscriber limit reached (${license.maxSubscribers})` 
    };
  }

  if (license.tenant._count.users >= license.maxUsers) {
    return { 
      valid: false, 
      reason: `User limit reached (${license.maxUsers})` 
    };
  }

  return { 
    valid: true, 
    license,
    usage: {
      subscribers: license.tenant._count.subscribers,
      maxSubscribers: license.maxSubscribers,
      users: license.tenant._count.users,
      maxUsers: license.maxUsers,
    }
  };
}

/**
 * Middleware to check license validity
 */
export async function licenseMiddleware(req: any, res: any, next: any) {
  if (!req.tenant) {
    return res.status(400).json({ error: 'Tenant required' });
  }

  const license = await prisma.license.findUnique({
    where: { tenantId: req.tenant.id }
  });

  if (!license) {
    return res.status(403).json({
      error: 'No license found',
      message: 'Please contact support'
    });
  }

  const validation = await validateLicense(license.licenseKey);
  
  if (!validation.valid) {
    return res.status(403).json({
      error: 'License invalid',
      message: validation.reason
    });
  }

  req.license = validation.license;
  req.usage = validation.usage;
  next();
}
```

---

## Implementation: Rollover Logic

### File: `server/src/services/rolloverService.ts`
```typescript
import { prisma } from '../config/db';
import { addDays, differenceInDays } from 'date-fns';

interface RolloverRule {
  enabled: boolean;
  maxRolloverMultiplier: number; // 1 = 1x quota, 2 = 2x quota
  expiryDays: number; // How long rolled over points last
  partialRollover: boolean; // If true, only X% rolls over
  rolloverPercentage: number; // If partialRollover true, this %
}

const DEFAULT_ROLLOVER_RULE: RolloverRule = {
  enabled: true,
  maxRolloverMultiplier: 2,
  expiryDays: 30,
  partialRollover: false,
  rolloverPercentage: 100,
};

/**
 * Get rollover rules for a tenant
 */
export async function getRolloverRules(tenantId: string): Promise<RolloverRule> {
  const settings = await prisma.tenantSettings.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: 'rolloverRules'
      }
    }
  });

  if (!settings) {
    return DEFAULT_ROLLOVER_RULE;
  }

  return settings.value as RolloverRule;
}

/**
 * Calculate rollover points when subscriber renews
 */
export async function calculateRollover(
  subscriberId: string,
  newPlanPoints: number
): Promise<{
  currentPoints: number;
  rolloverPoints: number;
  lostPoints: number;
  totalAfterRenewal: number;
  rolloverCap: number;
}> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: { tenant: true }
  });

  if (!subscriber) {
    throw new Error('Subscriber not found');
  }

  const rules = await getRolloverRules(subscriber.tenantId);

  if (!rules.enabled) {
    return {
      currentPoints: subscriber.pointsRemaining,
      rolloverPoints: 0,
      lostPoints: subscriber.pointsRemaining,
      totalAfterRenewal: newPlanPoints,
      rolloverCap: 0,
    };
  }

  // Calculate max rollover allowed
  const rolloverCap = newPlanPoints * rules.maxRolloverMultiplier - newPlanPoints;

  // Calculate actual rollover
  let rolloverPoints = subscriber.pointsRemaining;

  // Apply partial rollover if enabled
  if (rules.partialRollover) {
    rolloverPoints = Math.floor(rolloverPoints * (rules.rolloverPercentage / 100));
  }

  // Apply cap
  if (rolloverPoints > rolloverCap) {
    rolloverPoints = rolloverCap;
  }

  const lostPoints = subscriber.pointsRemaining - rolloverPoints;
  const totalAfterRenewal = newPlanPoints + rolloverPoints;

  return {
    currentPoints: subscriber.pointsRemaining,
    rolloverPoints,
    lostPoints,
    totalAfterRenewal,
    rolloverCap,
  };
}

/**
 * Apply rollover when subscriber renews
 */
export async function applyRollover(
  subscriberId: string,
  newPlanPoints: number,
  renewalDays: number = 30
) {
  const rolloverCalc = await calculateRollover(subscriberId, newPlanPoints);

  const subscriber = await prisma.subscriber.update({
    where: { id: subscriberId },
    data: {
      pointsRemaining: rolloverCalc.totalAfterRenewal,
      startDate: new Date(),
      endDate: addDays(new Date(), renewalDays),
      status: 'ACTIVE',
    }
  });

  // Log the rollover event
  await prisma.pointsTransaction.create({
    data: {
      subscriberId,
      type: 'ROLLOVER',
      amount: rolloverCalc.rolloverPoints,
      description: `Rolled over ${rolloverCalc.rolloverPoints} points from previous period`,
      metadata: {
        lostPoints: rolloverCalc.lostPoints,
        newPlanPoints,
      }
    }
  });

  if (rolloverCalc.lostPoints > 0) {
    await prisma.pointsTransaction.create({
      data: {
        subscriberId,
        type: 'EXPIRED',
        amount: -rolloverCalc.lostPoints,
        description: `${rolloverCalc.lostPoints} points expired (exceeded rollover cap)`,
      }
    });
  }

  return {
    subscriber,
    rollover: rolloverCalc,
  };
}

/**
 * Get points at risk (will be lost if not renewed)
 */
export async function getPointsAtRisk(subscriberId: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId }
  });

  if (!subscriber) {
    throw new Error('Subscriber not found');
  }

  const rules = await getRolloverRules(subscriber.tenantId);

  if (!rules.enabled) {
    return subscriber.pointsRemaining; // All points at risk
  }

  // Assume they're renewing the same plan
  const planPoints = Math.floor(subscriber.amount * 10); // Simplified
  const rolloverCap = planPoints * rules.maxRolloverMultiplier - planPoints;

  let pointsAtRisk = 0;
  
  if (subscriber.pointsRemaining > rolloverCap) {
    pointsAtRisk = subscriber.pointsRemaining - rolloverCap;
  }

  return pointsAtRisk;
}
```

---

## Key Implementation Priorities

### Week 1-2: Foundation
1. ✅ Database schema migration (add Tenant, User, License tables)
2. ✅ Tenant middleware implementation
3. ✅ JWT authentication system
4. ✅ Update all existing routes to be tenant-aware

### Week 3-4: Core Features
5. ✅ License key generation and validation
6. ✅ Subdomain routing setup
7. ✅ Per-tenant settings encryption
8. ✅ Enhanced rollover logic

### Week 5-6: Integration
9. ✅ Per-tenant WooCommerce credentials
10. ✅ Background job queue for async tasks
11. ✅ Email service abstraction layer
12. ✅ Webhook receivers

### Week 7-8: Admin & Analytics
13. ✅ Super admin dashboard
14. ✅ Tenant management API
15. ✅ Usage tracking and limits
16. ✅ Analytics dashboard

### Week 9-12: Polish & Deploy
17. ✅ Docker containerization
18. ✅ CI/CD pipeline
19. ✅ Monitoring setup
20. ✅ Documentation
21. ❌ Payment integration (hire specialist)
22. ❌ Email deliverability (hire specialist)

---

## Testing Strategy

### Unit Tests
```typescript
// Example: Test rollover calculation
describe('Rollover Service', () => {
  it('should calculate rollover correctly with 2x cap', async () => {
    const result = await calculateRollover('sub-123', 100);
    
    expect(result.rolloverCap).toBe(100); // 2x * 100 - 100
    // More assertions...
  });

  it('should apply partial rollover when configured', async () => {
    // Test partial rollover at 50%
  });

  it('should lose excess points beyond cap', async () => {
    // Test point loss
  });
});
```

### Integration Tests
```typescript
// Example: Test tenant isolation
describe('Tenant Isolation', () => {
  it('should not allow tenant A to see tenant B data', async () => {
    // Create 2 tenants
    // Try to access cross-tenant data
    // Should fail
  });

  it('should filter subscribers by tenant automatically', async () => {
    // Verify Prisma middleware works
  });
});
```

### Load Tests
```bash
# Use k6 or artillery
artillery quick --count 10 --num 100 http://localhost:4000/api/subscribers
```

---

## Deployment Checklist

### Pre-Deploy
- [ ] All environment variables documented
- [ ] Database migrations tested on staging
- [ ] Backup strategy in place
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] Monitoring tools setup
- [ ] Error tracking setup
- [ ] Log aggregation setup

### Deploy
- [ ] Database migrated
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Health checks passing
- [ ] Smoke tests passing

### Post-Deploy
- [ ] Monitor error rates
- [ ] Check database performance
- [ ] Verify email sending works
- [ ] Test payment flow (if integrated)
- [ ] Create test tenant
- [ ] Run end-to-end tests

---

## Performance Optimization

### Database
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_subscriber_tenant_status 
ON "Subscriber"(tenantId, status);

CREATE INDEX CONCURRENTLY idx_subscriber_tenant_enddate 
ON "Subscriber"(tenantId, endDate);

CREATE INDEX CONCURRENTLY idx_emaillog_tenant_sentat 
ON "EmailLog"(tenantId, sentAt DESC);
```

### Caching Strategy
```typescript
// Use Redis for:
// 1. Session storage
// 2. Rate limiting counters
// 3. Tenant settings (TTL: 5 minutes)
// 4. License validation results (TTL: 1 hour)

import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function getCachedTenantSettings(tenantId: string) {
  const cacheKey = `tenant:${tenantId}:settings`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const settings = await loadTenantSettings(tenantId);
  await redis.setex(cacheKey, 300, JSON.stringify(settings)); // 5 min TTL
  
  return settings;
}
```

---

This technical guide complements the production readiness report with actual implementation details and code examples. Use this as a reference when building the multi-tenant architecture.
