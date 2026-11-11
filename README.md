# PayPilot — Payment Operations Copilot

PayPilot is an AI-powered business payment operations copilot built for modern e-commerce and SaaS merchants. It unifies PayPal checkout telemetry, order fulfillment pipelines, and financial intelligence inside a modern **Clean Pearl** light interface with a custom **Pixel Trail** interactive effect.

---

## 1. Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.7+ (Strict mode)
- **Styling:** Tailwind CSS (Clean Pearl light design system)
- **Database / Backend Foundation:** Supabase PostgreSQL with `@supabase/supabase-js` (RLS enabled, zero public mutation)
- **Payment Gateway:** PayPal REST API (Orders v2 Sandbox integration)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Interactive Cursor Effect:** Custom Vanilla JavaScript & HTML Canvas API (No external particle/animation libraries)

---

## 2. Visual Identity — Clean Pearl Palette

| Token | Hex Code | Usage |
|---|---|---|
| **Canvas Background** | `#F8FAFC` | Primary application canvas |
| **Card & Surface Background** | `#FFFFFF` | Dashboard cards, tables, modals, sidebars |
| **Primary Text** | `#0F172A` | Typography, figures, labels |
| **Primary Action** | `#0284C7` | Primary buttons, active routes, brand highlights |
| **Positive Accent** | `#10B981` | Revenue growth, completed payments, healthy status |
| **Warm Highlight** | `#F59E0B` | Pending orders, warnings, authorization queues |
| **Subtle Hover Fill** | `#E0F2FE` | Table row hover, active tabs, subtle accents |
| **Error / Alert** | `#EF4444` | Payment declines, rejected items |

---

## 3. Project Structure

```
paypilot/
├── .env.example                          # Environment variable template
├── next.config.mjs                       # Next.js configuration
├── package.json                          # Dependencies & scripts
├── postcss.config.mjs                    # PostCSS configuration
├── tailwind.config.ts                    # Clean Pearl theme configuration
├── tsconfig.json                         # TypeScript configuration
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql        # Initial schema with RLS & seed data
│       └── 002_paypal_sandbox_integration.sql # Schema extensions for PayPal Order & Capture IDs
├── tests/
│   └── paypal-sandbox.test.mjs           # 12 automated unit & integration tests
└── src/
    ├── app/
    │   ├── api/
    │   │   └── paypal/
    │   │       ├── capture-order/route.ts# Server-side authoritative order capture
    │   │       ├── create-order/route.ts # Secure order creation with intent CAPTURE
    │   │       └── status/route.ts       # PayPal Sandbox connectivity & credentials probe
    │   ├── ai-copilot/page.tsx           # AI Command Centre
    │   ├── approvals/page.tsx            # Payment & Disbursement Approvals
    │   ├── intelligence/page.tsx         # Intelligence & Anomaly Preview
    │   ├── orders/page.tsx               # Customer Orders & PayPal Sandbox checkout
    │   ├── reports/page.tsx              # Financial Reports & CSV Export
    │   ├── settings/page.tsx             # Supabase & PayPal Sandbox configuration
    │   ├── transactions/page.tsx         # Searchable Transactions Ledger
    │   ├── globals.css                   # Global styles & Clean Pearl variables
    │   ├── layout.tsx                    # Root layout with AppShell & PixelTrail
    │   └── page.tsx                      # Overview Dashboard
    ├── components/
    │   ├── ai/AIChatInterface.tsx        # Copilot chat with verified backend tools
    │   ├── approvals/ApprovalsView.tsx   # Interactive approval workflows
    │   ├── dashboard/                    # KPI cards, charts, activity feed
    │   ├── effects/PixelTrail.tsx        # Custom canvas pixel trail cursor effect
    │   ├── layout/                       # Sidebar, TopNavbar, AppShell
    │   ├── orders/OrdersView.tsx         # Orders view with PayPal Sandbox checkout & capture
    │   ├── reports/ReportsView.tsx       # Performance summary & CSV export
    │   └── transactions/TransactionsView.tsx # Filterable ledger & details modal
    ├── lib/
    │   ├── ai/service.ts                 # Provider-independent AI tool handlers
    │   ├── demo-data.ts                  # Centralized fictional demo dataset
    │   ├── paypal/client.ts              # PayPal REST API client (OAuth token caching, Orders v2)
    │   ├── server/orders-store.ts        # Server-side authoritative orders & transactions store
    │   └── supabase/client.ts            # Safe Supabase client with status probe
    └── types/
        └── index.ts                      # Strict TypeScript data models
```

---

## 4. Phase 2A: PayPal Sandbox Checkout Integration

### Key Architecture Details
1. **Orders v2 REST API:** Built on `https://api-m.sandbox.paypal.com` using `intent: "CAPTURE"`.
2. **Server-Side Security:**
   - Client requests specify only `orderId`. The total amount is fetched authoritatively on the server side from the trusted store, completely preventing client tampering.
   - `PAYPAL_CLIENT_SECRET` and access tokens are strictly server-side and never exposed to browser bundles.
   - An idempotency mechanism (`PayPal-Request-Id`) prevents duplicate order creation or multiple charges.
3. **Checkout Experience in Orders:**
   - Pending orders present an explicit **"Pay with PayPal Sandbox"** CTA.
   - Transparently handles live sandbox redirect to PayPal buyer approval when sandbox credentials are provided, or activates an authentic in-app simulated test modal when credentials are not configured.
   - On approval return, the client invokes `/api/paypal/capture-order`, verifies the server response, records the authoritative capture ID, transitions the order status to `fulfilled`, and generates a tracking number and transaction ledger entry.
   - If the user cancels on PayPal, they are returned to PayPilot with an informational banner; the order remains safely pending with zero funds captured.
4. **Status & Diagnostics in Settings:**
   - Settings displays a real-time probe of PayPal REST API v2 Sandbox connectivity, masked configuration status, and developer setup instructions.

---

## 5. PayPal Developer Sandbox Configuration

1. Log in to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Under **Apps & Credentials**, select **Sandbox** and create or select a REST API app.
3. Add the following to `.env.local`:
   ```env
   PAYPAL_ENVIRONMENT=sandbox
   PAYPAL_CLIENT_ID=<your-sandbox-client-id>
   PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
   ```
4. If credentials are left unconfigured, PayPilot defaults gracefully to a simulated sandbox mode, allowing complete end-to-end testing without throwing uncaught errors.

---

## 6. Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Run Automated Tests
```bash
npm test
```
Executes all 12 unit and integration tests covering OAuth token retrieval, order creation, amount validation, capture verification, duplicate prevention, cancellation, and missing environment variables.

### Production Build
```bash
npm run build
npm run start
```
