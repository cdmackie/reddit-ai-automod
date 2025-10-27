# Resume Prompt

## Quick Context
Reddit AI Automod is a Devvit-based **user profiling & analysis system** that uses AI (Claude 3.5 Haiku or OpenAI gpt-4o-mini) to detect problematic posters: romance scammers, dating seekers, underage users, and spammers. Built with TypeScript, Redis storage, trust scoring, and strict cost controls.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude/OpenAI/DeepSeek)
**AI Providers**: Claude 3.5 Haiku (primary), OpenAI gpt-4o-mini (fallback), DeepSeek V3 (testing)
**Current Phase**: Phase 3 - Configurable Rules Engine & Actions (Design Complete ✅)
**Phase 1 Status**: COMPLETE ✅
**Phase 2 Status**: COMPLETE ✅
**Phase 3 Status**: Design Approved, Ready for Implementation
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

### Phase 2: AI Integration (COMPLETE ✅ - 2025-10-26)
- ✅ **All 11 AI components implemented and tested**:
  - ✅ ContentSanitizer (PII removal) - 93 tests
  - ✅ AIResponseValidator (Zod schema validation) - 42 tests
  - ✅ RequestCoalescer (request deduplication) - 35 tests
  - ✅ CircuitBreaker (fault tolerance)
  - ✅ CostTracker (budget enforcement)
  - ✅ PromptManager (A/B testing support)
  - ✅ AI Config (centralized configuration)
  - ✅ Provider Interface (IAIProvider abstraction)
  - ✅ Claude Provider (3.5 Haiku with tool calling)
  - ✅ OpenAI Provider (GPT-4o Mini with JSON mode)
  - ✅ DeepSeek Provider (DeepSeek V3 low-cost option)
  - ✅ ProviderSelector (multi-provider failover)
  - ✅ AIAnalyzer (main orchestrator)
- ✅ **Code review: APPROVED FOR PRODUCTION**
- ✅ **156 tests passing, 90%+ coverage on critical paths**
- ✅ ~8,905 lines production code, ~3,182 lines test code
- ✅ Installed dependencies: @anthropic-ai/sdk, openai, zod, uuid

### Phase 3: Configurable Rules Engine (DESIGN COMPLETE ✅ - 2025-10-27)
- ✅ Created Phase 3 design document
- ✅ Deployed architect-reviewer for validation
- ✅ **Critical design insight**: Custom AI questions instead of hardcoded detection
- ✅ User approval of configurable rules approach
- ✅ **Design highlights**:
  - ✅ Moderators write custom AI questions in natural language
  - ✅ No hardcoded detection types - fully flexible
  - ✅ Hard rules: account age, karma, email, content matching (`contains`, `in`)
  - ✅ AI rules: custom questions with YES/NO + confidence responses
  - ✅ Rules stored in Redis, configured via Settings (JSON)
  - ✅ Dry-run mode for safe testing
  - ✅ Actions: FLAG, REMOVE, COMMENT
- ✅ Updated all documentation with new approach

### Documentation Updates (Complete ✅ - 2025-10-25/27)
- ✅ Completely rewrote implementation-plan.md
- ✅ Updated project-status.md with architecture pivot
- ✅ Updated this resume-prompt.md

---

## Current State

**Status**: Phases 1 & 2 complete, all AI components production-ready, ready for Phase 3 integration

**What Exists**:
- ✅ Working Devvit app deployed to playtest (v0.0.2)
- ✅ Event handlers capturing new posts/comments
- ✅ Redis storage and audit logging operational
- ✅ Type definitions for events, storage, config, profiles, AI
- ✅ Rate limiter (60 req/min with exponential backoff)
- ✅ User profile fetcher (account age, karma, email verified)
- ✅ Post history analyzer (fetch last 20 posts from all subs)
- ✅ Trust score system (0-100 score, "trusted user" flag)
- ✅ Handler integration (trust check → profile fetch → score calculation)
- ✅ **All 11 AI components operational**:
  - ✅ Multi-provider support (Claude, OpenAI, DeepSeek)
  - ✅ Circuit breakers and health checks
  - ✅ Cost tracking with budget enforcement
  - ✅ PII sanitization
  - ✅ Request deduplication
  - ✅ Response validation
  - ✅ A/B testing framework
  - ✅ Differential caching (12-48h TTL)

**What's Next** (Phase 3 - Rules Engine & Actions):
- ❌ **AI Integration** - Wire AIAnalyzer into PostSubmit handler
- ❌ **API Configuration** - Set up Devvit Settings with API keys (Claude, OpenAI, DeepSeek)
- ❌ **Rules Engine** (`src/rules/engine.ts`)
  - Define hard rules (account age, karma thresholds)
  - Define AI-based rules (dating intent, scammer patterns, age estimation)
  - Implement rule evaluation logic
- ❌ **Action Executors** (`src/actions/`)
  - FLAG: Report to mod queue
  - REMOVE: Remove post + auto-comment with reason
  - COMMENT: Add warning comment
  - BAN: Manual override only (not auto-executed)
- ❌ **Integration Testing**
  - Test with real user profiles in playtest sub
  - Validate multi-provider failover
  - Measure actual costs
  - Verify rule accuracy

**Reddit Infrastructure**:
- Test sub: r/AiAutomod ✅
- Bot account: u/aiautomodapp (moderator) ✅
- Playtest sub: r/ai_automod_app_dev ✅
- App: "AI-Automod-App" registered ✅

---

## What's Next

### Immediate (Phase 3 - Implementation)

**Design Complete ✅** - Now ready for implementation

**Priority 1: Update Phase 2 for Custom Questions** (~4-5 hours)
1. **Modify AI System** (`src/ai/prompts.ts`, `src/ai/analyzer.ts`)
   - Change from hardcoded detection to custom Q&A format
   - **Old**: Return `{ datingIntent: {detected, confidence}, ageEstimate: {...} }`
   - **New**: Return `{ answers: [{ questionId, answer: "YES"/"NO", confidence, reasoning }] }`
   - Support batching multiple questions in one AI call
   - Cache responses by question ID

**Priority 2: Rule Storage & Configuration** (~3-4 hours)
2. **Implement Rule Storage** (`src/types/rules.ts`, `src/rules/storage.ts`)
   - HardRule type (account/content conditions)
   - AIRule type (custom question + conditions)
   - Redis storage: `rules:{subreddit}:hard:{ruleId}`, `rules:{subreddit}:ai:{ruleId}`
   - Default rule sets for FriendsOver40/50 and bitcointaxes
   - Devvit Settings for JSON rule configuration

**Priority 3: Rule Evaluation** (~6-9 hours)
3. **Condition Evaluator** (`src/rules/conditions.ts`)
   - Operators: `>`, `<`, `>=`, `<=`, `==`, `!=`, `contains`, `not_contains`, `in`
   - Logical operators: `AND`, `OR`
   - Dot notation: `aiAnalysis.confidence`

4. **Rules Engine** (`src/rules/engine.ts`)
   - Load rules from Redis (5-minute cache)
   - Evaluate rules in priority order
   - Per-rule error handling (continue on failure)
   - Return ActionDecision: action, reason, confidence, matchedRules

**Priority 4: Actions & Integration** (~5-7 hours)
5. **Action Executors** (`src/actions/executor.ts`)
   - FLAG: `context.reddit.report(post, { reason })`
   - REMOVE: `context.reddit.remove(post.id)` + comment
   - COMMENT: Add warning without removing
   - Variable substitution: `{confidence}`, `{reason}`, `{username}`

6. **PostSubmit Integration** (`src/handlers/postSubmit.ts`)
   - Wire rules engine evaluation
   - Check dry-run mode before executing
   - Enhanced audit logging with matched rules

**Priority 5: Testing** (~4-6 hours)
7. **Comprehensive Testing**
   - Unit tests: conditions, rules engine, actions
   - Integration tests: complete flow with mock rules
   - Manual testing in playtest with custom rules
   - Validate dry-run mode
   - Test text operators (`contains`, `in`)

**Total Estimated Time**: 19-27 hours (2.5-3.5 days)

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

## Session Summary (2025-10-27 - Session 6: Phase 3 Design Complete)

**Achievements**:
1. ✅ Reviewed Phase 2 completion status
2. ✅ Updated documentation to reflect Phase 2 completion
3. ✅ Created initial Phase 3 design with hardcoded rules
4. ✅ Deployed architect-reviewer for validation
5. ✅ **Critical discovery**: Identified hardcoded detection types as inflexible
6. ✅ User clarification: System must be **fully configurable**
7. ✅ **Key insight**: Moderators write custom AI questions in natural language
8. ✅ Completely redesigned Phase 3 as configurable rules system
9. ✅ User approved new design approach
10. ✅ Updated all documentation with custom AI questions approach
11. ✅ **Phase 3 design complete and approved** ✅

**Design Highlights**:
- Moderators write custom AI questions (no hardcoded detection)
- Rules stored in Redis, configured via Settings (JSON)
- Text operators: `contains`, `not_contains`, `in`
- Actions: FLAG, REMOVE, COMMENT (no MESSAGE, no BAN)
- Dry-run mode for safe testing

**Next Session**:
- Update Phase 2 AI system to support custom questions
- Implement rule storage and configuration
- Implement condition evaluation engine
- Implement rules execution engine
- Implement action executors
- Integrate with PostSubmit handler
- Comprehensive testing

---

**Status**: Foundation ✅ | User Profiling ✅ | AI Integration ✅ | Rules Design ✅ | **Rules Implementation (Next)** | Production (Week 4-5)
**Ready for**: Phase 3 - Implementation of configurable rules system
**Estimated time to MVP**: 2-3 weeks remaining
