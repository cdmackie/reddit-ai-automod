# Resume Prompt

## Quick Context
Reddit AI Automod is a Devvit-based **user profiling & analysis system** that uses AI (Claude 3.5 Haiku or OpenAI gpt-4o-mini) to detect problematic posters: romance scammers, dating seekers, underage users, and spammers. Built with TypeScript, Redis storage, trust scoring, and strict cost controls.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude/OpenAI/DeepSeek)
**AI Providers**: Claude 3.5 Haiku (primary), OpenAI gpt-4o-mini (fallback), DeepSeek V3 (testing)
**Current Phase**: Phase 2 - AI Integration (Started 2025-10-26)
**Phase 1 Status**: COMPLETE ✅
**Target Subs**: r/FriendsOver40, r/FriendsOver50, r/bitcointaxes

---

## ⚠️ Major Architecture Change - 2025-10-25

**Original Plan**: Generic rule engine with 20 predetermined rules
**New Direction**: User profiling system analyzing new posters

**Why the change**: Actual use case is detecting specific user types (scammers, dating seekers, underage) in FriendsOver40/50 subs, not generic content moderation.

---

## What's Been Done

### Planning & Research (Complete ✅ - 2025-10-25)
- ✅ Created CLAUDE.md development workflow guide
- ✅ Researched Devvit platform capabilities
- ✅ Researched Reddit API user data access
- ✅ **Confirmed we can access**:
  - User account age, karma, email verified status
  - Last N posts/comments from ALL subreddits
  - Full text content of posts/comments
- ✅ Designed user profiling architecture
- ✅ Designed trust score system (0-100)
- ✅ Designed AI analysis with cost tracking
- ✅ Created implementation plan (4-5 weeks, 5 phases)
- ✅ Initialized git repository (7 commits)

### Phase 1: Foundation & User Profiling (COMPLETE ✅ - 2025-10-26)
- ✅ Installed Node.js v20.19.5 + Devvit CLI v0.12.1
- ✅ Created Devvit project structure
- ✅ Set up modular src/ directory
- ✅ Implemented type definitions (events.ts, storage.ts, config.ts, profile.ts)
- ✅ Implemented Redis storage layer (redis.ts, audit.ts)
- ✅ Implemented PostSubmit & CommentSubmit event handlers
- ✅ Deployed to playtest subreddit (r/ai_automod_app_dev)
- ✅ Tested with real Reddit events
- ✅ Fixed API compatibility issues
- ✅ **Implemented user profiling system**:
  - ✅ Rate limiter with exponential backoff
  - ✅ User profile fetcher (account age, karma, email verified)
  - ✅ Post history analyzer (last 20 posts/comments)
  - ✅ Trust score calculator (0-100 scoring algorithm)
  - ✅ Integrated with PostSubmit handler
- ✅ Deployed v0.0.2 to playtest

### Documentation Updates (Complete ✅ - 2025-10-25)
- ✅ Completely rewrote implementation-plan.md
- ✅ Updated project-status.md with architecture pivot
- ✅ Updated this resume-prompt.md

---

## Current State

**Status**: Phase 1 complete, user profiling system operational, ready for AI integration

**What Exists**:
- ✅ Working Devvit app deployed to playtest (v0.0.2)
- ✅ Event handlers capturing new posts/comments
- ✅ Redis storage and audit logging operational
- ✅ Type definitions for events, storage, config, profiles
- ✅ Rate limiter (60 req/min with exponential backoff)
- ✅ User profile fetcher (account age, karma, email verified)
- ✅ Post history analyzer (fetch last 20 posts from all subs)
- ✅ Trust score system (0-100 score, "trusted user" flag)
- ✅ Handler integration (trust check → profile fetch → score calculation)

**What's Missing** (Phase 2 - In Progress):
- ✅ **ContentSanitizer** (src/ai/sanitizer.ts) - **DONE 2025-10-26**
  - Removes PII before AI analysis (emails, phones, SSNs, credit cards, URLs)
  - 93 comprehensive tests passing
- ✅ **AIResponseValidator** (src/ai/validator.ts) - **DONE 2025-10-26**
  - Zod runtime schema validation for all AI responses
  - Strict validation with detailed error reporting
  - Partial validation for recovery scenarios
  - 42 comprehensive tests passing, 90.62% coverage
- ✅ **RequestCoalescer** (src/ai/requestCoalescer.ts) - **DONE 2025-10-26**
  - Redis-based request deduplication
  - 35 comprehensive tests passing, 100% coverage
- ✅ **CircuitBreaker** (src/ai/circuitBreaker.ts) - **DONE 2025-10-26**
  - Prevents cascading failures with state management
- ✅ **CostTracker** (src/ai/costTracker.ts) - **DONE 2025-10-26**
  - Daily/monthly cost tracking with budget enforcement
- ✅ **PromptManager** (src/ai/prompts.ts) - **DONE 2025-10-26**
  - A/B testing support, content sanitization integration
- ✅ **AI Provider Interface** (src/ai/provider.ts) - **DONE 2025-10-26**
  - Clean abstraction for all providers
- ✅ **Claude Client** (src/ai/claude.ts) - **DONE 2025-10-26**
  - Claude 3.5 Haiku with tool calling
  - Retry logic, error handling, token tracking
- ✅ **OpenAI Client** (src/ai/openai.ts) - **DONE 2025-10-26**
  - GPT-4o Mini with JSON mode
  - Same reliability as Claude
- ✅ **DeepSeek Client** (src/ai/deepseek.ts) - **DONE 2025-10-26**
  - DeepSeek V3 via OpenAI-compatible API
  - Low-cost option
- ❌ **ProviderSelector** (src/ai/selector.ts) - IN PROGRESS
  - Multi-provider management and failover
- ❌ **AI Analyzer** (src/ai/analyzer.ts)
  - Orchestrates provider selection, caching, analysis

**Reddit Infrastructure**:
- Test sub: r/AiAutomod ✅
- Bot account: u/aiautomodapp (moderator) ✅
- Playtest sub: r/ai_automod_app_dev ✅
- App: "AI-Automod-App" registered ✅

---

## What's Next

### Immediate (Phase 2 - AI Integration)

**Build 8 components** (see `docs/ai-provider-comparison.md` for provider analysis):

1. **AI Provider Interface** (`src/ai/provider.ts`)
   - Abstract interface for all AI providers
   - Support for Claude, OpenAI, and DeepSeek
   - Unified request/response format

2. **Claude Client** (`src/ai/claude.ts`)
   - Anthropic SDK with Claude 3.5 Haiku
   - Retry logic with exponential backoff
   - Structured output with tool use

3. **OpenAI Client** (`src/ai/openai.ts`)
   - OpenAI SDK with GPT-4o Mini
   - JSON mode for structured output
   - Retry logic

4. **DeepSeek Client** (`src/ai/deepseek.ts`)
   - DeepSeek API integration
   - Lowest cost option (~$0.02/analysis)
   - Test for quality vs cost tradeoff

5. **Provider Selector** (`src/ai/selector.ts`)
   - Primary/fallback logic
   - A/B testing capability
   - Provider health checking

6. **AI Analysis Prompts** (`src/ai/prompts.ts`)
   - Dating intent detection
   - Scammer pattern detection
   - Age estimation (FriendsOver40/50)
   - Provider-agnostic prompts

7. **AI Analyzer** (`src/ai/analyzer.ts`)
   - Coordinates provider selection
   - Handles retries and fallbacks
   - Caches results (24h TTL)
   - Returns structured analysis

8. **Cost Tracker** (`src/ai/costTracker.ts`)
   - Per-provider cost tracking
   - Daily/monthly totals
   - Budget enforcement ($5/day default)
   - Alerts at 50%, 75%, 90%

**Test**: Integrate AI analysis into PostSubmit handler for non-trusted users

---

## The System Flow (How It Works)

```
User posts to r/FriendsOver40
  ↓
1. Check: Is user trusted? (Redis lookup)
   YES → Approve immediately, done ✅
   NO → Continue ↓

2. Check: Cached analysis? (last 24h)
   YES → Use cached result, skip to step 5
   NO → Continue ↓

3. Fetch user profile + post history (20 posts)
   - Account age, karma, email verified
   - Last 20 posts/comments from ALL subs
   - Cache both (24h TTL)

4. AI Analysis (if budget allows)
   - Check daily budget first
   - Send profile + history to OpenAI
   - AI checks:
     * Dating intent? (YES/NO + confidence)
     * Scammer patterns? (LOW/MED/HIGH + confidence)
     * Age estimate (for FriendsOver subs)
   - Cache AI result (24h TTL)
   - Track cost

5. Evaluate Rules
   Hard rules:
   - Account < 30 days + low karma + unverified → FLAG
   AI rules:
   - Dating intent >80% confidence → REMOVE + comment
   - Scammer risk HIGH >75% confidence → FLAG
   - Appears underage >85% confidence → FLAG

6. Execute Action
   - APPROVE (default if no rules match)
   - FLAG (report to mod queue)
   - REMOVE (remove + auto-comment)
   - BAN (manual override only)

7. Update Trust Score
   - Approved posts increase score
   - If score > 70 → mark as "trusted"

8. Log Everything
   - Action taken, reason, cost, AI analysis
```

---

## Important Decisions

### Architecture: User Profiling (Not Generic Rules)
**Why**: Actual need is analyzing new posters, not content moderation
**What**: Fetch user profile + history, analyze with AI, take action based on patterns

### AI: Multi-Provider Strategy (See docs/ai-provider-comparison.md)

**Primary Options** (testing required):
1. **Claude 3.5 Haiku** - Best quality, proven reliability (~$0.05-0.08/analysis)
2. **DeepSeek V3** - Lowest cost, testing needed (~$0.02-0.03/analysis)

**Fallback**: OpenAI GPT-4o Mini (~$0.10-0.12/analysis)

**Recommended Approach**:
- **Phase 2 Week 1**: Implement Claude + OpenAI + DeepSeek
- **Phase 2 Week 2**: A/B test all three with real data (200 users)
- **Decision**: Choose primary based on quality/cost balance

**Estimated Costs**:
- With Claude primary: $9-14/month
- With DeepSeek primary (if quality sufficient): $4-5/month
- With mixed approach: $6-10/month

**Cost Controls**:
- Daily budget limit (default $5/day across all providers)
- Aggressive caching (24h TTL)
- Trust score system (bypass AI for trusted users)
- Multi-provider strategy reduces dependency risk

### Trust Score: 0-100 Score to Reduce AI Costs
**Why**: Returning users with good history don't need re-analysis
**Factors**: Account age + karma + email verified + approved post history
**Threshold**: Score >70 = "trusted" (configurable)
**Benefit**: Saves ~50% on AI costs

### Start FLAG-Only, Transition to Auto-Actions
**Why**: Validate accuracy before auto-removing posts
**Plan**: Deploy with FLAG only, monitor for false positives, enable REMOVE after validation

---

## Key Files

### Development Workflow
- `CLAUDE.md`: Development practices and 9-step workflow (CRITICAL - read first!)

### Planning Documents (Updated 2025-10-25)
- `docs/implementation-plan.md`: 5-phase plan (4-5 weeks) **COMPLETELY REWRITTEN**
- `docs/project-status.md`: Current status, decisions, progress **UPDATED**
- `docs/resume-prompt.md`: This file (quick session recovery) **UPDATED**
- `docs/architecture.md`: Original architecture (now outdated - to be updated)

### Source Code (Foundation Complete)
- `src/main.tsx`: Entry point ✅
- `src/handlers/postSubmit.ts`: PostSubmit handler ✅
- `src/handlers/commentSubmit.ts`: CommentSubmit handler ✅
- `src/storage/redis.ts`: Redis wrapper ✅
- `src/storage/audit.ts`: Audit logging ✅
- `src/types/*.ts`: Type definitions ✅
- **Next to create**: `src/profile/*.ts` (fetcher, historyAnalyzer, trustScore)

### Git Status
- Branch: `main` (8 commits)
- Remote: `origin` - https://github.com/cdmackie/reddit-ai-automod
- Last commit: `b05bff3 - feat: implement Phase 1.2 user profiling system`
- Phase 1 complete ✅, pushed to GitHub

---

## Cost Estimates

**Per User Analysis**:
- Profile fetch: FREE (Reddit API)
- History fetch (20 posts): FREE (Reddit API)
- **AI analysis (Claude 3.5 Haiku)**: ~1000 tokens × $0.00008 = **~$0.08**
- **AI analysis (OpenAI gpt-4o-mini)**: ~700 tokens × $0.00015 = **~$0.10** (fallback only)

**Monthly (3 subs, 20 posts/day) - Using Claude**:
- Base cost: 20 users/day × $0.08 = $1.60/day = $48/month
- With caching (50% hit rate): **~$24/month**
- With trust scores (bypass 30%): **~$17/month**
- **With both optimizations: ~$15/month**

**Fallback Costs**:
- If Claude unavailable and falling back to OpenAI: Add ~25% ($4-5/month)

**Budget Controls**:
- Daily limit: $5 (hard stop across all providers)
- Per-provider tracking
- Monthly aggregate
- Alert at 50%, 75%, 90% of daily budget

---

## Next Session Checklist

When resuming work:
1. [ ] Read `./docs/resume-prompt.md` (this file)
2. [ ] Read `./docs/project-status.md` for detailed status
3. [ ] Check git log to see recent commits
4. [ ] Review CLAUDE.md for workflow reminder
5. [ ] Ask user: "Ready to build user profiling system (Phase 1.2)?"
6. [ ] Create TodoWrite list for the session
7. [ ] Follow 9-step workflow for every task

---

## Architecture Summary

**Core System**: User Profiling & Analysis

**Components**:
1. **Profile Fetcher**: Get account age, karma, email verified
2. **History Analyzer**: Fetch last 20 posts/comments from ALL subs
3. **Trust Score**: 0-100 score, bypass AI for trusted users
4. **AI Analyzer**: OpenAI gpt-4o-mini analyzing for dating/scammer/age patterns
5. **Cost Tracker**: Daily/monthly tracking, hard budget limits
6. **Rules Engine**: Hard rules (age, karma) + AI rules (intent detection)
7. **Action Executors**: FLAG, REMOVE, COMMENT, BAN
8. **Audit Logger**: Log everything with costs and reasoning

**Target Use Cases**:
- **FriendsOver40/50**: Detect dating seekers, scammers, underage users
- **bitcointaxes**: Detect spam, off-topic posts

---

## Session Summary (2025-10-25 - Session 3)

**Achievements**:
1. ✅ Clarified real use case with user
2. ✅ Researched Reddit/Devvit API capabilities
3. ✅ Confirmed all needed data is accessible
4. ✅ Designed user profiling architecture
5. ✅ Designed trust score system
6. ✅ Designed AI analysis with cost tracking
7. ✅ Completely rewrote implementation-plan.md
8. ✅ Updated project-status.md
9. ✅ Updated resume-prompt.md

**Next Session**:
- Build user profiling system (Phase 1.2)
- Create: fetcher.ts, historyAnalyzer.ts, trustScore.ts
- Test with real user accounts
- Commit working profiling system

---

**Status**: Foundation ✅ | User Profiling (Next) | AI Integration (Week 2-3) | Rules (Week 3-4) | Production (Week 5)
**Ready for**: Phase 1.2 - Build user profile fetcher, history analyzer, and trust score system
**Estimated time to MVP**: 3-4 weeks remaining
