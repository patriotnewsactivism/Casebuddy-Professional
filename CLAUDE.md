# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CaseBuddy Professional is a comprehensive legal case management and AI-powered trial preparation platform. It helps legal professionals organize cases, process discovery documents, prepare for depositions, and conduct trial simulations with AI assistance.

## Tech Stack

- **Frontend**: React 19 + Vite + TailwindCSS + Radix UI + Wouter (routing) + React Query
- **Backend**: Express.js + TypeScript + WebSocket (collaboration)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Generative AI (@google/genai)
- **Video**: Daily.co for video conferencing
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **Security**: Helmet.js, rate limiting, CSRF protection, audit logging

## Development Commands

### Running the Application
```bash
# Development mode (runs both client and server)
npm run dev:client  # Client only (port 5000)
npm run dev         # Server only (development mode)

# Production
npm run build       # Build both client and server
npm start           # Start production server
```

### Database Operations
```bash
npm run db:push     # Push schema changes to database
```

### Type Checking and Testing
```bash
npm run check       # Run TypeScript type checking
npm test            # Run Node.js test suite (tests/**.test.ts)
```

## Architecture Overview

### Project Structure
```
/CaseBuddy-Professional
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions
│   │   └── pages/             # Page components (dashboard, case-view, trial-prep, etc.)
├── server/                    # Express backend
│   ├── index.ts               # Server entry point
│   ├── routes.ts              # API route definitions
│   ├── middleware/            # Security middleware
│   │   ├── auth.ts            # Authentication & session management
│   │   ├── security.ts        # Helmet, rate limiting, CSRF
│   │   └── fileUpload.ts      # Secure file upload handling
│   ├── routes/                # Route modules
│   │   └── auth.ts            # Authentication endpoints
│   ├── services/              # Business logic modules
│   │   ├── aiAssistant.ts     # AI-powered legal insights
│   │   ├── auditLog.ts        # Compliance audit logging
│   │   ├── briefGenerator.ts  # Legal brief generation
│   │   ├── collaboration.ts   # WebSocket collaboration (secured)
│   │   ├── documentProcessor.ts # PDF/document analysis
│   │   ├── googleDrive.ts     # Cloud storage integration
│   │   ├── newsAggregator.ts  # Legal news aggregation
│   │   └── videoRooms.ts      # Video conferencing
│   └── replit_integrations/   # Gemini chat integration
├── shared/                    # Shared types and schemas
│   └── schema.ts              # Drizzle database schema + Zod validation
├── migrations/                # Database migrations
└── script/                    # Build scripts
    └── build.ts               # Production build configuration
```

### Path Aliases
The project uses TypeScript path aliases configured in both `tsconfig.json` and `vite.config.ts`:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Database Schema Architecture

The database schema is defined in `shared/schema.ts` using Drizzle ORM. Key tables:

**Core Entities:**
- `users` - User authentication
- `cases` - Legal cases with representation context (plaintiff/defendant), case theory, winning/trapping factors
- `discoveryFiles` - Documents with Bates numbering, AI analysis (favorable/adverse findings, inconsistencies)
- `cloudFolders` - Google Drive folder sync configuration

**Case Analysis:**
- `timelineEvents` - Case chronology with linked evidence
- `depositionPrep` - Deposition questions and strategy
- `legalBriefs` - Generated legal briefs with precedents
- `suggestedFilings` - AI-recommended filings with deadlines

**AI & Collaboration:**
- `conversations` + `messages` - AI chat conversations
- `callRecordings` - Video call recordings with transcripts
- `trialPrepSessions` - Trial simulation sessions with feedback
- `newsArticles` - Cached legal news articles

All insert schemas are generated using `createInsertSchema` from drizzle-zod for automatic validation.

### API Architecture

Routes are organized by feature in `server/routes.ts`:
- Cases CRUD operations
- Discovery file upload and processing
- AI assistance (deposition prep, timeline generation, filing suggestions)
- Google Drive integration
- Video conferencing (Daily.co)
- Real-time collaboration via WebSocket
- Trial preparation and simulation
- Chat integration with Gemini

### Document Processing Pipeline

Document processing happens in `server/services/documentProcessor.ts`:
1. Files uploaded with Bates numbering (e.g., "CASE-001-001")
2. PDF text extraction and OCR
3. AI analysis extracts:
   - Summary and key facts
   - Favorable findings (supports case theory)
   - Adverse findings (hurts case)
   - Inconsistencies (contradicts other evidence)
   - Action items
4. Metadata stored in PostgreSQL with full-text search capability

### AI Integration Patterns

The application uses Google's Generative AI throughout:
- **Document Analysis**: Analyzes discovery documents for strategic insights
- **Deposition Prep**: Generates strategic questions based on case context
- **Timeline Generation**: Creates chronological timelines from documents
- **Filing Suggestions**: Recommends next legal filings
- **Brief Generation**: Assists with legal brief writing
- **Trial Simulation**: Interactive practice sessions with real-time feedback

Case context is passed to AI prompts including:
- Representation type (plaintiff/defendant)
- Case theory (what you're trying to prove)
- Key issues
- Winning factors (helpful evidence)
- Trapping factors (inconsistencies to exploit)

### Real-time Collaboration

WebSocket collaboration is implemented in `server/services/collaboration.ts`:
- Real-time presence tracking (who's viewing which case)
- Document updates broadcast to all viewers
- Cursor position sharing
- Implemented via the `ws` library with Express integration

### Build System

The build process (`script/build.ts`) uses:
1. **Vite** for client-side bundling (outputs to `dist/public`)
   - Custom `metaImagesPlugin` for processing meta images
   - Manual code splitting: vendor chunk (React), UI chunk (Radix components)
2. **esbuild** for server-side bundling (outputs to `dist/index.cjs`)
3. Server dependencies are bundled (except those in externals list) to reduce cold start times

## Environment Variables

See `.env.example` for all configuration options. Key variables:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_GENAI_API_KEY` - Gemini AI API key for AI features
- `SESSION_SECRET` - Session signing secret (min 32 chars, generate with: `openssl rand -hex 32`)

**Application Settings:**
- `NODE_ENV` - Set to "production" in production
- `PORT` - Server port (default: 5000)

**Optional Integrations:**
- `DAILY_API_KEY` - Daily.co API key for video conferencing
- `DAILY_DOMAIN` - Daily.co domain (e.g., your-domain.daily.co)
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` - Google Drive integration
- `GOOGLE_CLOUD_PROJECT` - GCP project ID

**Security & File Upload:**
- `ALLOW_PUBLIC_REGISTRATION` - Set to "true" to allow public signups (default: false)
- `MAX_FILE_SIZE` - Maximum upload size in bytes (default: 52428800 = 50MB)
- `UPLOAD_DIR` - Upload directory (default: uploads)

**Rate Limiting:**
- `API_RATE_LIMIT` - API requests per 15 minutes (default: 500)
- `AUTH_RATE_LIMIT` - Auth attempts per 15 minutes (default: 10)

## Key Development Patterns

### Type Safety
- All database schemas have corresponding TypeScript types exported from `shared/schema.ts`
- Use `InsertCase`, `Case`, `InsertDiscoveryFile`, etc. for type-safe operations
- Zod schemas provide runtime validation for API inputs

### Database Operations
- Access database through `storage` import from `server/storage`
- Use Drizzle query builder for type-safe queries
- Schema changes require `npm run db:push` to sync with database

### Adding New Features
1. Define database tables in `shared/schema.ts`
2. Create insert schemas with `createInsertSchema`
3. Add API routes in `server/routes.ts`
4. Implement business logic in `server/services/`
5. Create React components in `client/src/components/`
6. Create pages in `client/src/pages/`

### File Uploads
- Multer configured with 100MB limit in `server/routes.ts`
- Files temporarily stored in `uploads/` directory
- Processing functions in `server/services/documentProcessor.ts`
- Supports PDF, images, and media files

### AI Service Integration
When adding AI features:
- Import from `@google/genai`
- Pass case context (representationType, caseTheory, winningFactors, trappingFactors)
- Structure prompts to provide legal context
- Store results in appropriate database tables

### Collaboration Features
- Use `collaborationService` for real-time features
- Broadcast updates via WebSocket
- Track case presence with `getCasePresence(caseId)`

## Security Architecture

CaseBuddy Professional handles confidential attorney-client privileged communications. The security implementation follows OWASP guidelines and legal industry best practices.

### Security Middleware Stack (`server/middleware/`)

**Authentication (`auth.ts`)**
- Session-based authentication with secure token generation
- bcrypt password hashing (12 rounds)
- Session expiry and cleanup
- `requireAuth` middleware protects all API routes
- Auto-upgrade from plaintext passwords on login

**Security Headers (`security.ts`)**
- Helmet.js with strict CSP configuration
- HSTS enabled in production
- XSS protection, noSniff, referrer policy
- Request ID tracking for audit trails
- Input sanitization to prevent injection attacks

**Rate Limiting**
- General API: 500 requests per 15 minutes
- Authentication: 10 attempts per 15 minutes
- File uploads: 50 per hour
- AI operations: 100 per hour

**File Upload Security (`fileUpload.ts`)**
- MIME type whitelist validation
- Magic number verification (file signature)
- File extension validation
- Dangerous content scanning
- Secure filename generation (prevents path traversal)
- Category-specific size limits

### Audit Logging (`server/services/auditLog.ts`)

Comprehensive audit trail for legal compliance:
- All authentication events (login, logout, password changes)
- Case access and modifications
- Document uploads and views
- Collaboration sessions (WebSocket joins/leaves)
- Video call sessions
- AI operations

Database table `audit_logs` with indexes for efficient querying by user, action, and timestamp.

### WebSocket Security (`server/services/collaboration.ts`)

- Session-based authentication via cookie
- Token-based authentication fallback
- 5-second authentication timeout
- Message rate limiting (120/minute per user)
- Message size limits (64KB max)
- Content sanitization

### Protected Routes

All API routes require authentication via `requireAuth` middleware:
- Cases, discovery files, timeline, depositions
- Legal briefs, filings, cloud folders
- Video conferencing, call recordings
- Trial simulation and prep sessions
- AI-powered features have additional `aiRateLimiter`

### Authentication API (`server/routes/auth.ts`)

```
POST /api/auth/login      - Authenticate user
POST /api/auth/register   - Create new account
POST /api/auth/logout     - Terminate session
POST /api/auth/change-password - Change password
GET  /api/auth/me         - Get current user
GET  /api/auth/check      - Verify session validity
```

### Adding Secured Features

When adding new API endpoints:
1. Import `requireAuth` from `server/middleware/auth`
2. Add middleware to route: `app.get("/api/new-route", requireAuth, handler)`
3. Access user via `req.user.id` and `req.user.username`
4. Add audit logging with `auditLog()` for sensitive operations
5. Use `aiRateLimiter` for AI-powered endpoints
6. Use `uploadRateLimiter` for file upload endpoints

### Session Management

Session configuration:
- `SESSION_SECRET` - Required in production; auto-generated in development if not set
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Session expiry and cleanup handled automatically

## Production Deployment

The application supports multiple Google Cloud deployment options:

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run check        # TypeScript type checking
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio
```

### Google App Engine Deployment
```bash
# Build and deploy to App Engine
npm run deploy:gcloud

# Manual deployment
npm run build
gcloud app deploy app.yaml --quiet
```

Configuration in `app.yaml`:
- Node.js 20 runtime
- Automatic scaling (0-10 instances)
- Health checks configured
- Static file caching for assets

### Google Cloud Run Deployment
```bash
# Build and deploy to Cloud Run
npm run deploy:cloudrun

# Or using Docker
npm run docker:build
npm run docker:run
```

Configuration in `Dockerfile`:
- Multi-stage build for smaller images
- Non-root user for security
- Health check endpoint
- Graceful shutdown handling

### Firebase Hosting (with Cloud Run backend)
```bash
npm run deploy:firebase
```

Configuration in `firebase.json`:
- Static assets served from Firebase CDN
- API requests proxied to Cloud Run service
- Security headers configured

### Database Configuration

**Cloud SQL (PostgreSQL)**
```bash
# Start Cloud SQL Auth Proxy
npm run cloudsql:proxy

# Connection string format
DATABASE_URL=postgresql://user:pass@localhost:5432/casebuddy?host=/cloudsql/PROJECT:REGION:INSTANCE
```

### Cloud-Specific Environment Variables

For cloud deployments:
- `DATABASE_URL` - Connection string (required)
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `CLOUD_SQL_CONNECTION_NAME` - For Cloud SQL Unix socket connection
- `DB_SSL_REJECT_UNAUTHORIZED` - Set to "false" for self-signed certs
- `GCS_BUCKET_NAME` - Google Cloud Storage bucket for file uploads
- `STRUCTURED_LOGGING` - Enable for Cloud Logging integration

### CI/CD Pipeline

Cloud Build configuration in `cloudbuild.yaml`:
1. Install dependencies
2. Run type checking
3. Build application
4. Deploy to App Engine

Trigger on push to main branch or manual trigger.

### Health Check Endpoints

- `GET /api/health` - Basic liveness check
- `GET /api/health/ready` - Detailed readiness with DB check
- `GET /api/health/live` - Kubernetes liveness probe
- `GET /api/health/startup` - Startup probe for slow containers

### Production Configuration

- Server listens on `0.0.0.0:PORT` (default 8080 in cloud, 5000 local)
- Static files served from `dist/public` in production
- Vite dev server used only in development
- Database seeding runs on startup (see `server/seed.ts`)
- News aggregator scheduler starts automatically
- Audit log table auto-created on startup
- Connection pooling optimized for cloud environments
- Graceful shutdown on SIGTERM/SIGINT
