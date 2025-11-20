# RenewalFlow: 30-Day Action Plan
**Fast-Track to Production**

---

## Week 1: Critical Decisions & Setup

### Day 1-2: Strategic Decisions
**What You Need to Decide:**

1. **Business Model**
   - [ ] Monthly subscription vs one-time license?
   - [ ] Pricing tiers (Starter/Growth/Pro)?
   - [ ] Trial period length (7/14/30 days)?
   - [ ] Recommended: Monthly SaaS ($29/$69/$129) with 14-day trial

2. **Architecture Path**
   - [ ] Standalone SaaS (recommended) vs WordPress plugin?
   - [ ] Self-hosted option or cloud-only?
   - [ ] Recommended: Cloud-only SaaS first, self-hosted later

3. **Partnership Structure**
   - [ ] DIY development vs partnership with me?
   - [ ] Budget available for specialists?
   - [ ] Timeline flexibility?

**Deliverables:**
- ✅ Completed decision matrix
- ✅ Budget allocated
- ✅ Timeline agreed upon

---

### Day 3-4: Environment Setup
**What to Do:**

1. **Development Environment**
```bash
# Clone your repo
cd renewalflow-main

# Set up PostgreSQL
# Install: https://www.postgresql.org/download/
createdb renewalflow_dev

# Install Redis (for caching)
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server

# Install dependencies
npm install
cd server && npm install

# Copy environment files
cp .env.example .env
cp server/.env.example server/.env

# Run migrations
cd server
npx prisma migrate dev
```

2. **Tools to Install**
- [ ] VS Code with extensions (Prisma, ESLint, TypeScript)
- [ ] Postman or Insomnia (for API testing)
- [ ] Docker Desktop (for containerization)
- [ ] GitHub account (for version control)

3. **Services to Sign Up**
- [ ] GitHub (code hosting)
- [ ] Stripe account (payment testing)
- [ ] SendGrid free tier (email sending)
- [ ] Sentry free tier (error tracking)
- [ ] Vercel or Railway (hosting - free tiers available)

**Deliverables:**
- ✅ Local environment running
- ✅ All accounts created
- ✅ API keys obtained

---

### Day 5: Product Spec Document
**What to Write:**

Create a document with:

1. **Feature List (MVP)**
   - [ ] Core features (must-have)
   - [ ] Nice-to-have features (post-launch)
   - [ ] Explicitly excluded features

2. **User Personas**
   - [ ] Who is your ideal customer?
   - [ ] What pain points do they have?
   - [ ] Why would they pay for this?

3. **Competitive Analysis**
   - [ ] WooCommerce Subscriptions: $199/year
   - [ ] Subscriptio: $49/year
   - [ ] Your differentiator: Rollover psychology + affordable

**Template:**
```markdown
## MVP Feature List

### Must-Have (Phase 1)
- Multi-tenant architecture
- User authentication (email/password)
- Subscriber management (CRUD)
- WooCommerce sync
- Email reminders (3 days, 1 day before)
- Rollover points tracking
- Payment integration (Stripe)
- Basic analytics dashboard

### Nice-to-Have (Phase 2)
- SMS reminders
- WhatsApp integration
- A/B testing for emails
- Advanced analytics
- White-label branding

### Excluded (For Now)
- Mobile apps
- WordPress plugin
- Enterprise SSO
```

**Deliverables:**
- ✅ Complete feature spec document
- ✅ User stories written
- ✅ Success metrics defined (MRR, churn rate, etc.)

---

## Week 2: Backend Foundation

### Day 6-8: Database Schema Migration
**What to Build:**

1. **New Prisma Schema**
```bash
cd server
# Edit prisma/schema.prisma
# Add: Tenant, User, License, RefreshToken models
# Update: Subscriber, EmailLog (add tenantId)
```

2. **Migration Script**
```bash
npx prisma migrate dev --name add_multi_tenancy
```

3. **Seed Script** (for testing)
```typescript
// server/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Company',
      subdomain: 'test',
      plan: 'PRO',
      status: 'ACTIVE',
      maxSubscribers: 100,
    }
  });

  // Create test user
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@test.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'OWNER',
      firstName: 'Test',
      lastName: 'Admin',
    }
  });

  console.log('Seed data created:', { tenant, user });
}

main();
```

**Testing:**
```bash
npm run prisma:seed
# Verify data in database
```

**Deliverables:**
- ✅ Updated Prisma schema
- ✅ Migration applied successfully
- ✅ Seed data created
- ✅ Can query tenants and users

---

### Day 9-11: Authentication System
**What to Build:**

1. **Auth Routes** (`server/src/routes/auth.ts`)
```typescript
// Endpoints to create:
POST /auth/register  → Create tenant + owner
POST /auth/login     → Login and get JWT
POST /auth/refresh   → Refresh access token
POST /auth/logout    → Invalidate refresh token
POST /auth/forgot-password
POST /auth/reset-password
```

2. **Password Utilities** (`server/src/utils/password.ts`)
```typescript
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

3. **JWT Utilities** (`server/src/utils/jwt.ts`)
```typescript
// Already shown in technical guide
// Copy from: renewalflow-technical-implementation-guide.md
```

**Testing:**
```bash
# Use Postman to test:
POST http://localhost:4000/auth/register
{
  "email": "test@example.com",
  "password": "Test123!",
  "firstName": "Test",
  "lastName": "User",
  "companyName": "Test Co",
  "subdomain": "testco"
}

# Should return:
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {...}
}
```

**Deliverables:**
- ✅ All auth endpoints working
- ✅ JWT tokens generated correctly
- ✅ Passwords hashed securely
- ✅ Postman collection created for testing

---

### Day 12-14: Tenant Middleware
**What to Build:**

1. **Tenant Middleware** (copy from technical guide)
   - Extract tenant from subdomain or JWT
   - Attach to `req.tenant`
   - Validate tenant status

2. **Update All Existing Routes**
```typescript
// Before:
const subscribers = await prisma.subscriber.findMany();

// After:
const subscribers = await prisma.subscriber.findMany({
  where: { tenantId: req.tenant.id }
});
```

3. **Prisma Middleware** (auto-inject tenantId)
```typescript
// Copy from technical guide
// server/src/middleware/prisma-tenant.ts
```

**Testing:**
```bash
# Create 2 test tenants
# Create subscribers for each
# Verify tenant A can't see tenant B's data
```

**Deliverables:**
- ✅ Tenant middleware working
- ✅ All routes are tenant-scoped
- ✅ Cross-tenant data leakage prevented
- ✅ Tests passing

---

## Week 3: Core Feature Updates

### Day 15-17: Enhanced WooCommerce Integration
**What to Build:**

1. **Per-Tenant Woo Settings**
```typescript
// Store in TenantSettings with encryption
key: 'woocommerce'
value: {
  url: 'https://store.example.com',
  consumerKey: 'ck_xxx', // encrypted
  consumerSecret: 'cs_xxx', // encrypted
  pointsPerCurrency: 1,
  syncEnabled: true,
  webhookSecret: 'whsec_xxx'
}
```

2. **Webhook Handler**
```typescript
// server/src/routes/webhooks.ts
POST /webhooks/woo/:tenantId

// Verify webhook signature
// Process order.created, order.completed events
// Update subscriber automatically
```

3. **Background Sync Job**
```typescript
// Use Bull queue
import Queue from 'bull';

const wooSyncQueue = new Queue('woo-sync', process.env.REDIS_URL);

wooSyncQueue.process(async (job) => {
  const { tenantId } = job.data;
  await syncWooOrdersForTenant(tenantId);
});

// Schedule every hour
wooSyncQueue.add({}, { repeat: { cron: '0 * * * *' } });
```

**Deliverables:**
- ✅ Per-tenant Woo credentials stored securely
- ✅ Webhook receiver working
- ✅ Background sync job running
- ✅ Manual sync button in UI

---

### Day 18-20: Advanced Reminder Logic
**What to Build:**

1. **Configurable Reminder Tiers**
```typescript
// Allow tenants to set custom reminder days
interface ReminderConfig {
  reminders: [
    { days: 7, type: 'FIRST', enabled: true },
    { days: 3, type: 'SECOND', enabled: true },
    { days: 1, type: 'FINAL', enabled: true },
    { days: 0, type: 'DAY_OF', enabled: false },
    { days: -3, type: 'POST_EXPIRY', enabled: true },
  ]
}
```

2. **Smart Send Times**
```typescript
// Analyze user's past open times
// Send at optimal time (default: 10am local time)
```

3. **A/B Testing Framework**
```typescript
// Randomly assign subscribers to variant A or B
// Track open rates, click rates
// Auto-select winning variant
```

**Deliverables:**
- ✅ Multi-tier reminders working
- ✅ Per-tenant reminder config
- ✅ Basic A/B testing structure

---

### Day 21: Rollover Enhancements
**What to Build:**

1. **Rollover Rules UI**
   - Toggle rollover on/off
   - Set max multiplier (1x, 2x, unlimited)
   - Set expiry days for rolled over points
   - Partial rollover percentage

2. **Visual Rollover Indicators**
   - Show "X points at risk" in dashboard
   - Email template: "You'll lose 50 points!"
   - Progress bar showing rollover vs lost

**Deliverables:**
- ✅ Rollover rules configurable per tenant
- ✅ Points at risk calculated correctly
- ✅ Email templates include rollover messaging

---

## Week 4: Frontend & Polish

### Day 22-24: Frontend Multi-Tenancy
**What to Build:**

1. **Subdomain Router**
```typescript
// App.tsx
useEffect(() => {
  const subdomain = window.location.hostname.split('.')[0];
  if (subdomain && subdomain !== 'www') {
    setTenantSubdomain(subdomain);
  }
}, []);
```

2. **Login Page Update**
```typescript
// Remove PIN auth
// Add proper login form with email/password
// JWT token storage in localStorage (or httpOnly cookie)
```

3. **Auth Context**
```typescript
// src/contexts/AuthContext.tsx
const AuthContext = createContext<{
  user: User | null;
  tenant: Tenant | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}>({...});
```

**Deliverables:**
- ✅ Subdomain routing working
- ✅ Login page redesigned
- ✅ JWT auth integrated
- ✅ Protected routes implemented

---

### Day 25-27: Dashboard Improvements
**What to Build:**

1. **Enhanced Analytics**
   - MRR/ARR calculation
   - Churn rate
   - Retention cohorts
   - Rollover impact metrics

2. **Email Template Builder**
   - Rich text editor (Quill or TinyMCE)
   - Variable picker ({{name}}, {{points}}, etc.)
   - Preview pane
   - Test email button

3. **Settings Pages**
   - Company profile
   - WooCommerce integration
   - Email templates
   - Reminder configuration
   - Rollover rules
   - Billing (link to Stripe portal)

**Deliverables:**
- ✅ Analytics dashboard complete
- ✅ Email builder working
- ✅ All settings pages built

---

### Day 28: Documentation
**What to Write:**

1. **User Documentation**
   - Getting started guide
   - WooCommerce setup instructions
   - Email template guide
   - FAQ

2. **API Documentation**
   - OpenAPI/Swagger spec
   - Example requests/responses
   - Authentication guide

3. **Deployment Guide**
   - Environment variables
   - Database setup
   - Deployment steps
   - Backup procedures

**Deliverables:**
- ✅ Complete documentation site
- ✅ Video tutorials recorded
- ✅ API docs published

---

## Immediate Hires Needed

### Payment Integration Specialist
**When:** Week 2 (Day 8-10)  
**Duration:** 1-2 weeks  
**Budget:** $3,000 - $5,000  

**What They'll Build:**
- Stripe subscription integration
- Checkout flow
- Webhook handler for subscription events
- Trial management
- Dunning management
- Invoice generation

**Where to Find:**
- Upwork (search "Stripe integration expert")
- Toptal
- Stripe's partner directory

---

### Email Deliverability Expert
**When:** Week 3 (Day 15-17)  
**Duration:** 1 week  
**Budget:** $2,000 - $3,000  

**What They'll Do:**
- Set up SendGrid/Mailgun
- Configure SPF/DKIM/DMARC
- Set up dedicated sending domain
- Configure bounce/complaint handling
- Set up email warm-up schedule
- Monitor deliverability metrics

**Where to Find:**
- Email deliverability consultants (Google search)
- SendGrid/Mailgun professional services
- Upwork (search "email deliverability expert")

---

## Critical Tools & Services Setup

### Week 1 Sign-ups (Free Tiers)
- [ ] GitHub → Code hosting
- [ ] Vercel/Railway → App hosting
- [ ] Supabase/Neon → Managed PostgreSQL
- [ ] Redis Cloud → Managed Redis
- [ ] SendGrid → Email (free: 100/day)
- [ ] Sentry → Error tracking
- [ ] Stripe → Payments (test mode free)

### Week 2 Sign-ups
- [ ] Domain registration (Namecheap)
- [ ] Cloudflare → DNS + CDN
- [ ] Google Workspace → Business email
- [ ] Linear/Jira → Project management

---

## Budget Breakdown (30 Days)

### Development Costs
- Payment specialist: $3,000 - $5,000
- Email specialist: $2,000 - $3,000
- **OR** Partner with me: $0 (equity/rev-share)

### Infrastructure (Month 1)
- Hosting: $50 - $100 (can start free)
- Database: $25 - $50 (free tier ok for now)
- Redis: $0 - $30 (free tier)
- Email sending: $0 - $50 (free tier)
- Domain: $15
- SSL: $0 (Let's Encrypt)
- **Total:** $90 - $245/month (can be $0 with free tiers)

### Miscellaneous
- Design assets (logo, etc.): $200 - $500
- Legal (terms, privacy): $500 - $1,500 (or use templates)
- **Total:** $700 - $2,000

**30-Day Total:** $5,700 - $10,245  
**OR with partnership:** $700 - $2,000 only

---

## Success Metrics (End of 30 Days)

### Technical Metrics
- [ ] Multi-tenant architecture live
- [ ] 5 test tenants created
- [ ] 100+ test subscribers imported
- [ ] Email reminders sending successfully
- [ ] WooCommerce sync working
- [ ] Payment flow complete (test mode)
- [ ] 0 critical bugs
- [ ] <200ms API response time

### Business Metrics
- [ ] Landing page live
- [ ] 100 email list sign-ups
- [ ] 5 beta users recruited
- [ ] Pricing page published
- [ ] Competitor analysis complete

---

## Day 30: Launch Checklist

### Pre-Launch
- [ ] All features tested
- [ ] Security audit passed
- [ ] Backups configured
- [ ] Monitoring working
- [ ] Support email set up
- [ ] Terms of service published
- [ ] Privacy policy published
- [ ] Pricing page live

### Launch Day
- [ ] DNS configured
- [ ] SSL certificates active
- [ ] Production database migrated
- [ ] Environment variables set
- [ ] Health checks passing
- [ ] Monitoring active
- [ ] Error tracking active
- [ ] Send launch email

### Post-Launch (Week 5)
- [ ] Monitor error rates
- [ ] Watch user feedback
- [ ] Fix critical bugs immediately
- [ ] Schedule user interviews
- [ ] Iterate based on feedback

---

## My Role (If You Choose Partnership)

### What I'll Do Daily
- Morning: Review progress, answer questions
- Day: Build features, write code, solve problems
- Evening: Code review, planning for next day

### What I Need From You
- Daily 30-min standup call
- Quick Slack/email responses
- Access to all accounts/tools
- Final approval on major decisions
- User feedback sharing

### Communication
- Slack: Daily updates
- GitHub: Code reviews
- Linear: Task tracking
- Weekly: 1-hour planning call

---

## Next Steps Right Now

### This Week (Your Action Items)
1. **Read both reports thoroughly** (this + the main report)
2. **Make key decisions** (business model, pricing, partnership)
3. **Set up development environment** (if building yourself)
4. **Sign up for free services** (GitHub, Vercel, etc.)
5. **Schedule call with me** (if interested in partnership)

### My Recommendation
**Let's hop on a 30-minute call to:**
- Clarify your vision
- Answer your technical questions
- Discuss partnership options
- Create a custom roadmap for YOUR situation

**I'm ready to start as soon as you are.** This is a solid opportunity with clear market need. Let's make it happen! 🚀

---

## Questions? Concerns?

**Common Questions:**

**Q: Is 30 days realistic?**  
A: To MVP - yes, with focus and help. To polished SaaS - 60-90 days is more realistic.

**Q: Can I build this myself?**  
A: Yes, but add 2-3x time. Technical parts are doable, business/payment parts need specialists.

**Q: What if I want to launch faster?**  
A: Cut scope to absolute minimum: just auth, tenants, reminders. Launch in 2 weeks, iterate.

**Q: What if I have no budget?**  
A: Use all free tiers, partner with me for equity, launch lean, iterate based on early revenue.

**Q: Should I build WordPress plugin or standalone?**  
A: Standalone SaaS reaches bigger market. Plugin limits you to WP users. Do SaaS first.

---

**Ready to get started? Let me know which path you want to take!**
