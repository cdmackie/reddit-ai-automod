# Resume Prompt

## Quick Context
Reddit AI Automod is a Devvit-based **user profiling & analysis system** that uses AI (Claude 3.5 Haiku or OpenAI gpt-4o-mini) to detect problematic posters: romance scammers, dating seekers, underage users, and spammers. Built with TypeScript, Redis storage, trust scoring, and strict cost controls.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude/OpenAI/DeepSeek)
**AI Providers**: Claude 3.5 Haiku (primary), OpenAI gpt-4o-mini (fallback), DeepSeek V3 (testing)
**Current Phase**: Phase 3 - Configurable Rules Engine & Actions
**Phase 1 Status**: COMPLETE ✅
**Phase 2 Status**: COMPLETE ✅
**Phase 3.1 Status**: AI System Refactor - COMPLETE ✅
**Phase 3.2 Status**: Rules Engine Implementation - COMPLETE ✅
**Phase 3.3 Status**: Rules Engine Integration - COMPLETE ✅
**Next**: Phase 3.4 - Implement action executors (FLAG, REMOVE, COMMENT)
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

### Phase 3.1: AI System Refactor for Custom Questions (COMPLETE ✅ - 2025-10-27)
- ✅ Created Phase 3 design document
- ✅ Deployed architect-reviewer for validation
- ✅ **Critical design insight**: Custom AI questions instead of hardcoded detection
- ✅ User approval of configurable rules approach
- ✅ **AI System Updated** (~830 lines):
  - ✅ New types: AIQuestion, AIAnswer, AIQuestionBatchResult
  - ✅ buildQuestionPrompt() for custom questions
  - ✅ analyzeUserWithQuestions() orchestrator
  - ✅ MD5-based cache keys (collision-safe)
  - ✅ Input validation and dynamic cost estimation
  - ✅ All 156 tests passing

### Phase 3.2: Rules Engine Implementation (COMPLETE ✅ - 2025-10-27)
- ✅ **Complete type system** (src/types/rules.ts):
  - ✅ HardRule and AIRule types
  - ✅ Condition tree with nested AND/OR support
  - ✅ All Reddit AutoMod operators: comparison, text, array, regex, logical
  - ✅ Field registry with 30+ accessible fields
  - ✅ CurrentPost interface with media types, URLs, domains
- ✅ **Condition evaluator** (src/rules/evaluator.ts - 303 lines):
  - ✅ Recursive condition evaluation
  - ✅ All operators: <, >, <=, >=, ==, !=, contains, contains_i, regex, regex_i, in
  - ✅ Field whitelist validation
  - ✅ Security: depth limits, prototype pollution prevention
- ✅ **Variable substitution** (src/rules/variables.ts - 160 lines)
- ✅ **Redis storage** (src/rules/storage.ts - 343 lines):
  - ✅ Rule CRUD operations
  - ✅ Priority-based ZSET storage
  - ✅ Redis key sanitization
- ✅ **Rules engine** (src/rules/engine.ts - 246 lines):
  - ✅ Priority-based evaluation
  - ✅ Combines subreddit + global rules
  - ✅ Dry-run mode support
- ✅ **Default rule sets** (src/rules/defaults.ts - 561 lines):
  - ✅ FriendsOver40: 6 rules
  - ✅ FriendsOver50: 5 rules
  - ✅ bitcointaxes: 4 rules
  - ✅ Global: 1 rule
- ✅ **Security hardening** (13 tests):
  - ✅ Regex injection prevention
  - ✅ Redis injection prevention
  - ✅ Field access whitelist
- ✅ **Profile type updates**:
  - ✅ Split karma: commentKarma, postKarma, totalKarma
  - ✅ User attributes: hasUserFlair, hasPremium, isVerified
  - ✅ Post history: totalPosts, totalComments, subreddits[]
- ✅ **All 169 tests passing** (13 new security tests)

### Documentation Updates (Complete ✅ - 2025-10-25/27)
- ✅ Completely rewrote implementation-plan.md
- ✅ Updated project-status.md with architecture pivot
- ✅ Updated this resume-prompt.md

---

## Current State

**Status**: Phases 1, 2, 3.1, and 3.2 complete - Rules engine fully implemented and tested

**What Exists**:
- ✅ Working Devvit app deployed to playtest (v0.0.2)
- ✅ Event handlers capturing new posts/comments
- ✅ Redis storage and audit logging operational
- ✅ Type definitions for events, storage, config, profiles, AI, rules
- ✅ Rate limiter (60 req/min with exponential backoff)
- ✅ User profile fetcher with split karma (commentKarma, postKarma)
- ✅ Post history analyzer (totalPosts, totalComments, subreddits tracking)
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
  - ✅ Custom AI questions support (analyzeUserWithQuestions)
- ✅ **Complete rules engine system**:
  - ✅ Type system with HardRule and AIRule
  - ✅ Condition evaluator with all Reddit AutoMod operators
  - ✅ Variable substitution for dynamic messages
  - ✅ Redis storage with priority-based evaluation
  - ✅ Rules engine with dry-run mode
  - ✅ Default rule sets for all 3 target subreddits
  - ✅ Security hardening (13 tests passing)
- ✅ **169 tests passing** (13 new security tests)
- ✅ **~10,500 lines production code**

**What's Next** (Phase 3.4):

**Phase 3.3: Rules Engine Integration** - COMPLETE ✅
- ✅ PostBuilder helper created
- ✅ PostSubmit handler integration complete
- ✅ Conditional AI analysis
- ✅ Enhanced audit logging
- ✅ Dry-run mode support
- ✅ Security hardening (6 issues fixed)

**Phase 3.4: Action Executors (NEXT)**
- ❌ **Action Executors** (`src/actions/executor.ts`)
  - FLAG: Report to mod queue (context.reddit.report)
  - REMOVE: Remove post + auto-comment (context.reddit.remove)
  - COMMENT: Add warning without removing (context.reddit.submitComment)
  - Variable substitution in messages: {confidence}, {reason}, {username}, etc.
  - Dry-run logging support

**Reddit Infrastructure**:
- Test sub: r/AiAutomod ✅
- Bot account: u/aiautomodapp (moderator) ✅
- Playtest sub: r/ai_automod_app_dev ✅
- App: "AI-Automod-App" registered ✅

---

## What's Next

### Security Fixes Complete (2025-10-27)
**CRITICAL**: Fixed 5 critical security vulnerabilities in rules engine:
- ✅ Regex injection (ReDoS) prevention
- ✅ Redis injection sanitization
- ✅ Unbounded field access controls
- ✅ Cache size limits
- ✅ Error handling (FLAG on error, not APPROVE)

All security tests passing (13 tests). See `docs/security-fixes-phase3.md` for details.

### Immediate (Phase 3 - Integration & Actions)

**Phase 3.1 ✅ | Phase 3.2 ✅** - Rules engine fully implemented, now ready for integration

**Priority 1: PostSubmit Handler Integration** (NEXT - ~3-4 hours)
1. **Integrate Rules Engine** (`src/handlers/postSubmit.ts`)
   - Build CurrentPost object from submission
   - Wire rules engine evaluation into flow
   - Handle dry-run mode (log only vs execute)
   - Enhanced audit logging with matched rules
   - Error handling for rule evaluation failures

**Priority 2: Action Executors** (~5-7 hours)
2. **Action Executors** (`src/actions/executor.ts`)
   - FLAG: `context.reddit.report(post, { reason })`
   - REMOVE: `context.reddit.remove(post.id)` + auto-comment
   - COMMENT: Add warning without removing
   - Variable substitution: `{confidence}`, `{reason}`, `{username}`, `{aiAnalysis.answers.*.confidence}`
   - Dry-run logging support

**Priority 3: Default Rules Initialization** (~2-3 hours)
3. **Initialize Default Rules**
   - Load default rule sets into Redis on app install
   - Per-subreddit initialization
   - Devvit Settings for rule management (JSON)
   - API key configuration UI

**Priority 4: Testing** (~4-6 hours)
4. **Comprehensive Testing**
   - Integration tests: complete flow with real rules
   - Test hard rules (account age, karma, content matching)
   - Test AI rules (custom questions + confidence thresholds)
   - Manual testing in playtest subreddit
   - Validate dry-run mode
   - Validate variable substitution in messages
   - Test all action types (FLAG, REMOVE, COMMENT)

**Priority 5: Production Deployment** (~3-4 hours)
5. **Deploy to Target Subreddits**
   - Deploy to r/FriendsOver40 (dry-run mode initially)
   - Deploy to r/FriendsOver50 (dry-run mode initially)
   - Deploy to r/bitcointaxes (dry-run mode initially)
   - Monitor for 24-48 hours
   - Disable dry-run mode after validation

**Total Estimated Time**: 17-24 hours (2-3 days)

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

## Session Summary

### Session 6 (2025-10-27): Phase 3.0 - Design Complete

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

### Session 7 (2025-10-27): Phase 3.1 - AI System Refactor Complete

**Achievements**:
1. ✅ Removed old design document with hardcoded approach
2. ✅ Reviewed current AI system structure
3. ✅ Implemented custom questions infrastructure (~830 lines)
   - New types: AIQuestion, AIAnswer, AIQuestionRequest, AIQuestionBatchResult
   - buildQuestionPrompt() for dynamic prompt creation
   - validateQuestionBatchResponse() for Q&A validation
   - analyzeUserWithQuestions() main orchestrator
   - MD5-based cache key generation
   - Comprehensive input validation
   - Dynamic cost estimation
4. ✅ Deployed javascript-pro agent for implementation
5. ✅ All 156 tests passing
6. ✅ Deployed code-reviewer
7. ✅ Fixed moderate issues (cache collision, validation)
8. ✅ **Phase 3.1 COMPLETE** ✅

### Session 8 (2025-10-27): Phase 3.2 - Rules Engine Implementation

**Achievements**:
1. ✅ Implemented complete rules engine system (~2,100 lines):
   - src/types/rules.ts: Complete type system with all operators
   - src/rules/evaluator.ts: Condition evaluator (303 lines)
   - src/rules/variables.ts: Variable substitution (160 lines)
   - src/rules/storage.ts: Redis storage with CRUD (343 lines)
   - src/rules/engine.ts: Rules engine with priority evaluation (246 lines)
   - src/rules/defaults.ts: Default rule sets for 3 subs (561 lines)
   - src/rules/__tests__/security.test.ts: Security test suite (13 tests)
2. ✅ Deployed code-reviewer → identified 5 CRITICAL security issues
3. ✅ Deployed security-auditor → fixed all critical issues
4. ✅ **Security hardening complete** (13 security tests passing)

### Session 9 (2025-10-27): Phase 3.2 Complete - Profile Updates & Type Fixes

**Achievements**:
1. ✅ Updated profile and history types:
   - Split karma: commentKarma, postKarma, totalKarma
   - User attributes: hasUserFlair, userFlairText, hasPremium, isVerified
   - Post history: totalPosts, totalComments, subreddits[]
   - CurrentPost interface: media types, URLs, domains, word counts
2. ✅ Updated implementation files:
   - profile/fetcher.ts: Populate split karma from API
   - profile/historyAnalyzer.ts: Calculate post/comment counts, track subreddits
   - Fixed all test mocks (3 locations in prompts.test.ts)
3. ✅ Cleaned up unused variables (5 locations in storage.ts)
4. ✅ All 169 tests passing (13 new security tests)
5. ✅ Production code: ~10,500 lines (+1,595 from Phase 3.2)
6. ✅ Updated all documentation
7. ✅ Committed Phase 3.2 changes
8. ✅ **Phase 3.2 COMPLETE** ✅

### Session 10 (2025-10-27): Phase 3.3 Complete - Rules Engine Integration

**Achievements**:
1. ✅ Created PostBuilder helper (src/handlers/postBuilder.ts - 258 lines)
   - URL extraction with ReDoS protection (O(n) algorithm)
   - Domain extraction with protocol validation (http/https only)
   - Post type detection (text/link/image/video/gallery)
   - Word/char count calculation
   - Safe defaults on errors
2. ✅ Updated PostSubmit handler (src/handlers/postSubmit.ts)
   - Rules engine integration (lines 131-274)
   - Conditional AI analysis (only when subreddit has AI rules)
   - AI question aggregation from rules
   - Complete evaluation context
   - Action handling (APPROVE/FLAG/REMOVE/COMMENT)
   - Enhanced audit logging with metadata (dryRun, aiCost, executionTime, trustScore)
   - Dry-run mode support
   - Phase 3.4 placeholders for REMOVE/COMMENT actions
3. ✅ Code review identified 6 moderate issues
4. ✅ Fixed all 6 moderate security issues:
   - ReDoS vulnerability in URL regex
   - Protocol validation (blocked javascript:, data:, file: URLs)
   - Pattern matching robustness
   - Error log sanitization (no sensitive data leakage)
   - Type safety (removed `as any` casts)
   - Explicit AI failure logging
5. ✅ All 169 tests passing ✅
6. ✅ Documentation created (docs/phase-3.3-security-fixes.md)
7. ✅ **Phase 3.3 COMPLETE** ✅

**Next Session**:
- Implement action executors (Phase 3.4)
- FLAG: Report to mod queue
- REMOVE: Remove post + auto-comment
- COMMENT: Add warning without removing
- Variable substitution in messages
- Integration testing in test subreddit

---

**Status**: Foundation ✅ | User Profiling ✅ | AI Integration ✅ | Rules Design ✅ | **Rules Engine ✅** | **Integration ✅** | Actions (Next) | Production (Week 4-5)
**Ready for**: Phase 3.4 - Action Executors (FLAG, REMOVE, COMMENT)
**Estimated time to MVP**: 1 week remaining
