# QAAI - Final Implementation Plan

## Executive Summary

Complete plan for building QAAI - an AI-driven QA platform that automatically plans, generates, and executes Playwright E2E tests from PR diffs and specifications, with integrated GitHub issue creation for discovered bugs.

## Key Features

### Core Functionality
✅ AI test planning from PR diffs and specifications
✅ Multi-LLM support (OpenAI, Claude, Ollama)
✅ Automated Playwright test generation
✅ Deterministic test execution with artifacts
✅ GitHub integration (webhooks, checks, PRs)
✅ Flake detection and tracking
✅ Coverage visualization

### NEW: GitHub Issue Integration
✅ **Automatic issue creation** for test failures (optional)
✅ **Manual issue creation** from UI with pre-filled templates
✅ **Duplicate detection** to avoid spam
✅ **Configurable per project** (on/off, labels, templates)
✅ **Rich issue content** with links to artifacts and traces

## Documentation Created

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** (673 lines)
   - System architecture with PlantUML diagrams
   - Technology stack and decisions
   - Database schema and RLS policies
   - Security considerations

2. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** (1000 lines)
   - Step-by-step Phase 1-2 implementation
   - Complete code examples
   - SQL scripts and configurations
   - Testing strategies

3. **[README.md](./README.md)** (227 lines)
   - Project overview
   - Quick start guide
   - Phase checklist
   - Technology stack

4. **[GITHUB_ISSUE_INTEGRATION.md](./GITHUB_ISSUE_INTEGRATION.md)** (545 lines)
   - Feature specification
   - Database schema updates
   - API routes and flows
   - UI components
   - PlantUML workflow diagrams

5. **[PLAN_SUMMARY.md](./PLAN_SUMMARY.md)** (267 lines)
   - Implementation overview
   - Timeline estimates
   - Success criteria

## Implementation Todo List (41 Items)

### Phase 1: Foundation (Items 1-10)
- [x] Project structure with pnpm workspace
- [x] Next.js 15 with App Router and Tailwind
- [x] Supabase setup and configuration
- [x] Database schema with RLS
- [x] Storage buckets
- [x] Auth integration
- [x] Base UI components
- [x] Dashboard
- [x] Project management
- [x] Signed URL helpers

### Phase 2: Runner Infrastructure (Items 11-17)
- [ ] Railway runner service
- [ ] Job polling system
- [ ] Playwright configuration
- [ ] Test execution
- [ ] Artifact upload
- [ ] JUnit parser
- [ ] Result recording

### Phase 3: AI Planning & Generation (Items 13-14, 18)
- [ ] Multi-LLM client (OpenAI/Claude/Ollama)
- [ ] Planner worker
- [ ] Generator worker
- [ ] API routes (plan/generate/run)

### Phase 4: GitHub Integration (Items 21-28)
- [ ] GitHub App setup
- [ ] Webhook handler
- [ ] Checks reporter
- [ ] PR diff analyzer
- [ ] **Issue creation API**
- [ ] **Manual issue creation UI**
- [ ] **Issue templates**
- [ ] **Project settings for issues**

### Phase 5: Flake Detection & Coverage (Items 29-32)
- [ ] Flake detection algorithm
- [ ] Heatmap visualization
- [ ] Coverage tracking
- [ ] Coverage matrix

### Phase 6: Production Hardening (Items 33-41)
- [ ] Test data seeding
- [ ] Login helpers
- [ ] Retry configuration
- [ ] Org management
- [ ] Environment variable UI
- [ ] Test suite
- [ ] Deployment docs
- [ ] CI/CD pipeline
- [ ] User documentation

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Language**: JavaScript ESM (not TypeScript)
- **Package Manager**: pnpm

### Backend
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth with RLS
- **Storage**: Supabase Storage (private buckets)
- **API**: Next.js API Routes

### Runner Service
- **Runtime**: Node.js
- **Testing**: Playwright
- **Container**: Docker (mcr.microsoft.com/playwright)
- **Deployment**: Railway

### AI/LLM
- **Providers**: OpenAI, Anthropic Claude, Ollama
- **Models**: GPT-4o-mini, Claude Sonnet, Llama 3.1/Qwen
- **Strategy**: Environment-based provider selection

### DevOps
- **Hosting**: Railway (web + runner)
- **CI/CD**: GitHub Actions
- **VCS**: GitHub with App integration

## Database Schema Highlights

### Core Tables
- `organizations` - Multi-tenant org management
- `org_members` - Membership with roles
- `projects` - Test projects with GitHub config
- `suites` - Test suite groupings
- `test_cases` - Individual test definitions
- `plans` - AI-generated test plans
- `runs` - Test execution runs
- `run_tests` - Individual test results
- `jobs_queue` - Background job queue

### NEW: GitHub Integration Tables
- `github_issues` - Track created issues
- `projects` - Extended with GitHub settings:
  - `github_installation_id`
  - `github_repo_owner`
  - `github_repo_name`
  - `auto_create_issues` (boolean)
  - `issue_labels` (text[])

## GitHub Issue Integration Flow

### Automatic Creation
```
Test Fails → Check Settings → Check Duplicates → Create Issue → Save Record
```

### Manual Creation
```
User Views Failure → Click Button → Edit Template → Create Issue → Link to Test
```

### Issue Content
- Test name and description
- Error message and stack trace
- Link to QAAI artifacts (trace/video)
- Environment information
- Reproduction steps
- Configurable labels

## Timeline Estimate

### Phase-by-Phase
- **Phase 1**: 2-3 days (Foundation)
- **Phase 2**: 2-3 days (Runner)
- **Phase 3**: 3-4 days (AI Integration)
- **Phase 4**: 3-4 days (GitHub + Issues)
- **Phase 5**: 2-3 days (Analytics)
- **Phase 6**: 2-3 days (Polish)

**Total**: 16-23 days for complete MVP

### Parallel Work Opportunities
- UI development can happen alongside runner work
- Documentation can be written during testing phases
- Deployment setup can happen early

## Success Criteria

### Technical
✅ Users can sign up and create organizations
✅ Projects link to GitHub repositories
✅ AI generates valid test plans from PR diffs
✅ Playwright tests execute successfully
✅ Artifacts captured (trace/video/screenshots)
✅ GitHub Checks show pass/fail on PRs
✅ Issues created automatically for failures
✅ Flaky tests detected and tracked
✅ Coverage metrics visible in dashboard
✅ System deployed on Railway

### Quality Metrics
- **Test Generation**: 90%+ success rate
- **Execution Stability**: <5% flake rate
- **Performance**: <5 min for typical PR
- **Coverage**: 80%+ route coverage
- **User Adoption**: 70%+ approve AI tests
- **Issue Quality**: <10% duplicate issues

## Security Considerations

### Authentication & Authorization
- Supabase Auth with JWT tokens
- Row Level Security (RLS) for all tables
- Service role key only on server-side
- GitHub App with minimal permissions

### Data Protection
- Private storage buckets with signed URLs
- 1-hour URL expiry
- No secrets in client-side code
- Environment variables for sensitive data

### GitHub Integration
- OAuth flow for repository access
- Scoped permissions (issues, checks, PRs)
- Rate limiting respect (5000/hour)
- No sensitive data in issue bodies

## Next Steps

### Option 1: Start Implementation ✅ RECOMMENDED
Switch to Code mode and begin Phase 1:
1. Create project structure
2. Initialize Next.js app
3. Set up Supabase
4. Implement authentication
5. Build base UI

### Option 2: Expand Documentation
Add more detail to:
- Phase 3-6 implementation guides
- API endpoint specifications
- Component library documentation
- Testing strategies

### Option 3: Prototype First
Build a minimal proof-of-concept:
- Single test generation
- Basic execution
- Simple UI
- Then expand to full MVP

## Questions Before Starting?

1. **Scope**: Satisfied with the feature set?
2. **GitHub Issues**: Happy with the automatic + manual approach?
3. **Timeline**: 16-23 days acceptable?
4. **Technology**: Any concerns about the stack?
5. **Priorities**: Any phase more urgent than others?

## Ready to Build!

All planning is complete. We have:
- ✅ Comprehensive architecture
- ✅ Detailed implementation guide
- ✅ Complete database schema
- ✅ 41-item todo list
- ✅ GitHub issue integration spec
- ✅ PlantUML diagrams
- ✅ Code examples
- ✅ Security considerations
- ✅ Testing strategies

**Let's switch to Code mode and start building Phase 1!**

---

*Created: 2025-11-02*
*Total Documentation: ~3,000 lines across 5 files*
*Estimated Implementation: 16-23 days*