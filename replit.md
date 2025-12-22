# CaseBuddy - AI Legal Case Management Platform

## Overview

CaseBuddy is an AI-powered legal case management and discovery organization platform built for attorneys and legal professionals. The application enables lawyers to manage cases, upload and process legal documents (PDFs, media, images), generate AI-assisted timelines, prepare deposition questions, and generate legal briefs. It integrates with Google Drive for cloud document syncing and uses Google's Gemini AI for document analysis, summarization, and legal assistance.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` (dashboard, case-view, not-found)
- Reusable UI components in `client/src/components/ui/`
- Custom hooks in `client/src/hooks/`
- API client functions in `client/src/lib/api.ts`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON APIs under `/api/*` prefix
- **File Uploads**: Multer middleware with 100MB file size limit
- **Database ORM**: Drizzle ORM with PostgreSQL

The backend is organized as:
- `server/index.ts` - Express app setup and middleware
- `server/routes.ts` - All API route definitions
- `server/storage.ts` - Database abstraction layer (IStorage interface)
- `server/services/` - Business logic services (AI, document processing, etc.)
- `server/replit_integrations/` - Replit-specific AI integration modules

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend/backend)
- **Migrations**: Drizzle Kit (`drizzle-kit push`)

Key database tables:
- `users` - User accounts
- `cases` - Legal cases with metadata
- `discoveryFiles` - Uploaded documents with Bates numbering, summaries, extracted text
- `timelineEvents` - Case timeline entries
- `depositionPrep` - AI-generated deposition questions
- `suggestedFilings` - AI-suggested next legal filings
- `cloudFolders` - Google Drive folder sync configuration
- `legalBriefs` - Generated legal documents
- `conversations` / `messages` - AI chat history

### AI Integration
The application uses Google's Gemini AI through Replit AI Integrations:
- **Document Processing**: OCR, summarization, relevance scoring, tag extraction
- **Deposition Prep**: Generate strategic examination questions
- **Timeline Generation**: Extract dates and events from documents
- **Brief Generation**: Draft legal documents based on case facts
- **Chat Interface**: General legal AI assistant

AI configuration uses environment variables:
- `AI_INTEGRATIONS_GEMINI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_BASE_URL`

Supported models: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-image`

### Authentication
Currently no authentication is implemented. The storage interface includes user methods but they are not actively used for session management.

## Recent Changes (December 2025)

### Case Management Features
- **New Case Intake Modal**: Dashboard now has a "New Case" button that opens a modal form with fields for title, case number, client name, and description. Uses `caseIntakeSchema` for validation.
- **Delete Case**: Cases can be deleted from the case view header with a confirmation dialog to prevent accidental deletions.
- **Export Case**: Export button downloads complete case data as JSON including all discovery files, timeline events, briefs, and conversations.

### AI Chat Interface
- **AI Tab in Case View**: Fully functional AI chat interface in the case view with:
  - Conversation management (create, list, delete conversations)
  - Message history with streaming responses from Gemini AI
  - Case-specific context for legal assistance
  - Suggested prompts for common legal tasks
- **Chat Routes**: `/api/conversations` endpoints for CRUD operations on conversations and messages

### Trial Preparation & Simulation
- **Voice-Powered Trial Practice**: Practice courtroom scenarios with AI-powered simulation
- **Web Speech API Integration**: Real-time voice recognition (speech-to-text) and text-to-speech for natural conversation
- **Simulation Modes**: Cross-examination, direct examination, opening statements, closing arguments
- **AI Coaching**: Live suggestions panel with:
  - Suggested responses the attorney could use
  - Warnings about potential pitfalls
  - Strategic tips based on the conversation
- **Case Context Awareness**: AI uses case theory, winning factors, and trap points to provide relevant coaching
- **API Endpoints**:
  - `POST /api/trial-simulation/start` - Initialize simulation with case context
  - `POST /api/trial-simulation/respond` - Process user statement and get AI response with coaching
- **Browser Requirements**: Chrome/WebKit for voice recognition support

### Key Components
- `client/src/pages/trial-prep.tsx` - Trial simulation page with voice controls
- `client/src/components/ai-chat.tsx` - AI chat interface component
- `client/src/pages/dashboard.tsx` - Dashboard with New Case modal
- `client/src/pages/case-view.tsx` - Case view with export/delete functionality
- `client/src/pages/my-cases.tsx` - Full case list with search, filter, create, delete
- `client/src/pages/calendar.tsx` - Calendar view with deadlines and quick stats
- `client/src/pages/research.tsx` - Legal research with database links and news
- `client/src/pages/settings.tsx` - User settings (profile, notifications, appearance, integrations)
- `server/replit_integrations/chat/routes.ts` - AI conversation API routes

### Navigation Routes
- `/` - Dashboard (overview with quick stats and recent cases)
- `/cases` - My Cases (full case list management)
- `/trial-prep` - Trial Prep (voice-powered trial simulation with AI coaching)
- `/calendar` - Calendar (deadline tracking and events)
- `/research` - Legal Research (database links and legal news)
- `/settings` - Settings (user preferences and integrations)
- `/case/:id` - Case View (detailed case management with tabs)

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (connection via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database queries and schema management

### AI Services
- **Google Gemini AI**: Document analysis, legal assistance, image generation (via Replit AI Integrations proxy)

### Cloud Storage
- **Google Drive API**: Document syncing and cloud folder management (via Replit Connectors)

### Video Conferencing
- **Daily.co**: Real-time video conferencing for case collaboration
- Configuration: `DAILY_API_KEY` environment variable
- Features:
  - Video/audio calls with mute/unmute controls
  - Screen sharing for document review
  - **Recording**: Start/stop recording with live elapsed timer (visible in both expanded and minimized modes)
  - **Live Transcription**: Real-time speech-to-text with auto-scrolling transcript panel
  - **Shareable Links**: Copy invite link to share with external participants
  - Recording and transcript persistence to database via `/api/cases/:caseId/call-recording`
- Rooms are created dynamically per case and cleaned up when all participants leave
- Call recordings table stores: roomName, transcriptText, duration, participants, status

### Strategic Document Analysis
- Document processor uses case context to analyze documents strategically
- **Case Context Fields**: representationType, opposingParty, caseTheory, winningFactors, trappingFactors
- **AI Analysis Outputs**:
  - Favorable findings (evidence that helps our client)
  - Adverse findings (potential weaknesses to address)
  - Inconsistencies (contradictions to exploit)
  - Action items (recommended attorney actions)
- Discovery files schema includes arrays for all strategic analysis fields

### Third-Party Libraries
- **pdf-parse**: PDF text extraction
- **rss-parser**: News feed aggregation from legal news sources
- **googleapis**: Google Drive integration
- **multer**: File upload handling

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the entire codebase