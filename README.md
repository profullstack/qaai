# QAAI - AI-Driven QA Platform

An intelligent QA assistant that automatically plans, generates, and executes Playwright E2E tests from PR diffs and specifications. Similar to how Strix works for penetration testing, QAAI provides AI-powered test coverage with human-in-the-loop approval.

## 🎯 Key Features

- **AI Test Planning**: Automatically analyzes PR diffs and generates comprehensive test plans
- **Intelligent Test Generation**: Creates Playwright tests from natural language specifications
- **Multi-LLM Support**: Works with OpenAI, Anthropic Claude, and local Ollama models
- **Deterministic Execution**: Stable test runs with retries, fixtures, and seeded data
- **Rich Artifacts**: Captures traces, videos, screenshots, and HAR files
- **GitHub Integration**: Seamless PR workflow with GitHub Checks and webhooks
- **Flake Detection**: Automatically identifies and tracks flaky tests
- **Coverage Tracking**: Route and API coverage visualization
- **Multi-tenant**: Organization-based access control with RLS

## 🏗️ Architecture

QAAI consists of three main components:

1. **Next.js Web App** - Dashboard, test management, and artifact viewer
2. **Runner Service** - Background workers for planning, generation, and execution
3. **Supabase Backend** - PostgreSQL database, authentication, and storage

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Supabase   │◀────│   Runner    │
│   Web App   │     │   Backend    │     │   Service   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                     │
       │                    │                     │
       ▼                    ▼                     ▼
  Dashboard            PostgreSQL           Playwright
  Artifacts            Storage              AI Workers
  API Routes           Auth/RLS             Job Queue
```

## 📚 Documentation

- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete user guide and tutorials
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Implementation instructions
- **[GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md)** - GitHub integration guide
- **[PHASE5_COMPLETE.md](./PHASE5_COMPLETE.md)** - Analytics & coverage features
- **[PHASE6_COMPLETE.md](./PHASE6_COMPLETE.md)** - Production hardening features

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Supabase account
- Railway account (for deployment)
- OpenAI/Anthropic API key OR Ollama

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/qaai.git
cd qaai

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev:web      # Next.js on :3000
pnpm dev:runner   # Runner service
```

## 🗂️ Project Structure

```
qaai/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages
│       ├── components/         # React components
│       └── lib/                # Utilities and clients
├── services/
│   └── runner/                 # Background worker service
│       ├── workers/            # Planner, Generator, Runner
│       ├── lib/                # LLM client, job queue
│       └── Dockerfile
├── packages/
│   └── playwright-tests/       # Generated test files
├── infra/
│   ├── supabase/              # Database schema and policies
│   ├── railway/               # Deployment configs
│   └── github/                # CI/CD workflows
└── docs/                      # Additional documentation
```

## 🔧 Technology Stack

### Frontend
- Next.js 15 (App Router)
- Tailwind CSS
- Supabase Auth

### Backend
- Supabase (PostgreSQL + Storage + Auth)
- Next.js API Routes
- Row Level Security (RLS)

### Runner
- Node.js
- Playwright
- Docker
- Railway

### AI/LLM
- OpenAI (GPT-4o-mini)
- Anthropic (Claude Sonnet)
- Ollama (Local models)

## 📋 Implementation Status

### ✅ Phase 1: Foundation (COMPLETE)
- [x] Project structure and monorepo setup
- [x] Next.js app with Tailwind
- [x] Supabase integration
- [x] Database schema and RLS
- [x] Authentication flow
- [x] Base UI components

### ✅ Phase 2: Runner Infrastructure (COMPLETE)
- [x] Job polling system
- [x] Playwright configuration
- [x] Test execution engine
- [x] Artifact upload (traces, videos, screenshots)
- [x] Result recording and storage

### ✅ Phase 3: AI Planning & Generation (COMPLETE)
- [x] Multi-LLM client (OpenAI, Anthropic, Ollama)
- [x] Planner worker
- [x] Generator worker
- [x] Plan approval UI
- [x] Test file management

### ✅ Phase 4: GitHub Integration (COMPLETE)
- [x] GitHub App webhook handler
- [x] PR diff analysis
- [x] GitHub Checks reporter
- [x] Automatic issue creation
- [x] Issue templates and tracking

### ✅ Phase 5: Flake Detection & Coverage (COMPLETE)
- [x] Statistical flake detection algorithm
- [x] Flake heatmap dashboard
- [x] Route/API coverage tracking
- [x] Coverage matrix visualization
- [x] Analytics API endpoints

### ✅ Phase 6: Production Hardening (COMPLETE)
- [x] Test data seeding strategy
- [x] Retry and timeout configuration
- [x] Settings management UI
- [x] CI/CD pipeline (GitHub Actions)
- [x] Comprehensive user documentation

## 🎉 Project Status: 100% COMPLETE

**All 41 tasks completed!** QAAI is production-ready with:
- ✅ AI-powered test generation
- ✅ Automated test execution
- ✅ GitHub integration
- ✅ Flake detection & analytics
- ✅ Coverage tracking
- ✅ Test data management
- ✅ CI/CD pipeline
- ✅ Complete documentation

## 🔐 Security

- Supabase Auth with JWT tokens
- Row Level Security (RLS) for multi-tenancy
- Private storage buckets with signed URLs
- Service role key only on server-side
- GitHub App with minimal permissions

## 🚢 Deployment

### Railway Deployment

```bash
# Deploy web app
railway up --service web

# Deploy runner service
railway up --service runner
```

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for detailed deployment instructions.

## 📊 Monitoring

- Job queue metrics
- Test execution duration
- Flake rate tracking
- API response times
- Storage usage

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Inspired by Strix for penetration testing, adapted for QA automation.

## 📞 Support

- Documentation: [docs/](./docs/)
- Issues: GitHub Issues
- Discussions: GitHub Discussions

---

Built with ❤️ for better software quality