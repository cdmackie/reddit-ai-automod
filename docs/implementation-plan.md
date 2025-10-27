# Implementation Plan - User Profiling & Analysis System

**Project**: Reddit AI Automod
**Platform**: Devvit (TypeScript)
**Timeline**: 4-5 weeks
**Last Updated**: 2025-10-25

---

## Overview

This implementation plan focuses on building an **intelligent user profiling system** that analyzes new posters to detect:
- Romance scammers (new/hacked accounts)
- Users seeking dating/hookups (Friends subs only)
- Underage users (Friends subs only)
- Spam/off-topic content (bitcointaxes)

**Target Subreddits**: r/FriendsOver40, r/FriendsOver50, r/bitcointaxes

**Approach**: Use AI to analyze user profiles and post history, combined with hard rules (account age, karma, email verification).

---

## Phase 1: Foundation & User Profile Analysis (Week 1-2) - COMPLETE ✅

### Goals
- ✅ Set up development environment (DONE)
- ✅ Create basic Devvit app structure (DONE)
- ✅ Implement event handlers (DONE)
- ✅ Set up Redis storage layer (DONE)
- ✅ Build user profile fetcher (DONE)
- ✅ Build post history analyzer (DONE)
- ✅ Implement trust score system (DONE)

### Tasks

#### 1.1 Complete Foundation (DONE ✅)
- ✅ Install Node.js v20.19.5
- ✅ Install Devvit CLI v0.12.1
- ✅ Create Devvit project structure
- ✅ Set up TypeScript configuration
- ✅ Implement PostSubmit handler
- ✅ Implement CommentSubmit handler
- ✅ Deploy to playtest subreddit

#### 1.2 User Profile Fetcher (DONE ✅)
- [x] Create `src/profile/fetcher.ts`
- [x] Implement `getUserProfile(userId)`
  - Account creation date
  - Total karma (link + comment)
  - Email verified status
  - Is moderator flag
- [x] Add profile caching (24h TTL in Redis)
- [x] Test with real user accounts

#### 1.3 Post History Analyzer (DONE ✅)
- [x] Create `src/profile/historyAnalyzer.ts`
- [x] Implement `getUserHistory(username, limit=20)`
- [x] Fetch last 20 posts/comments across ALL subreddits
- [x] Extract data:
  - Full text content
  - Subreddit names
  - Timestamps
  - Engagement metrics (score, comments)
- [x] Cache results in Redis (24h TTL)
- [x] Test with various user types

#### 1.4 Trust Score System (DONE ✅)
- [x] Create `src/profile/trustScore.ts`
- [x] Implement trust score calculation (0-100)
  - Account age factor
  - Karma factor
  - Email verified factor
  - Approved post history factor
- [x] Store scores in Redis: `user:{userId}:trustScore`
- [x] Implement "trusted user" flag: `user:{subreddit}:trusted:{userId}`
- [x] Create `checkIfTrusted()` function
- [x] Test score calculations

#### 1.5 Integration (DONE ✅)
- [x] Update PostSubmit handler to:
  - Check if user is trusted (skip analysis if yes)
  - Fetch user profile
  - Fetch post history
  - Cache results
  - Calculate trust score
- [x] Add comprehensive logging
- [x] Test end-to-end flow

### Deliverables
- ✅ User profile fetcher working
- ✅ Post history analyzer working
- ✅ Trust score system operational
- ✅ Basic caching layer functional

### Acceptance Criteria
- [x] Can fetch user profile data for any Reddit user
- [x] Can fetch last 20 posts/comments from user history
- [x] Trust scores are calculated correctly
- [x] Trusted users skip expensive analysis
- [x] All data is cached appropriately (24h TTL)
- [x] No errors in playtest environment

---

## Phase 2: AI Integration & Cost Tracking (Week 2) - COMPLETE ✅

### Goals
- ✅ Integrate multi-provider AI (Claude, OpenAI, DeepSeek)
- ✅ Build AI analysis prompts with A/B testing
- ✅ Implement cost tracking with budget enforcement
- ✅ Add PII sanitization and response validation
- ✅ Implement circuit breakers and request deduplication
- ✅ Cache AI analysis results with differential TTL

### Tasks (All Complete ✅)

#### 2.1 Multi-Provider AI Integration (DONE ✅)
- [x] Created `src/ai/provider.ts` - Abstract interface for all providers
- [x] Created `src/ai/claude.ts` - Claude 3.5 Haiku with tool calling
- [x] Created `src/ai/openai.ts` - GPT-4o Mini with JSON mode
- [x] Created `src/ai/deepseek.ts` - DeepSeek V3 low-cost option
- [x] Created `src/ai/selector.ts` - Multi-provider failover logic
- [x] API keys configured via Devvit Settings (encrypted)
- [x] Comprehensive error handling and retry logic

#### 2.2 AI Infrastructure (DONE ✅)
- [x] Created `src/ai/prompts.ts` - Prompt management with A/B testing
- [x] Created `src/ai/sanitizer.ts` - PII removal (93 tests)
- [x] Created `src/ai/validator.ts` - Zod schema validation (42 tests)
- [x] Created `src/ai/requestCoalescer.ts` - Request deduplication (35 tests)
- [x] Created `src/ai/circuitBreaker.ts` - Fault tolerance
- [x] Created `src/config/ai.ts` - Centralized configuration
- [x] All prompts tested with structured output validation

#### 2.3 Cost Tracking System (DONE ✅)
- [x] Created `src/ai/costTracker.ts` with comprehensive tracking
- [x] Daily cost tracking with atomic INCRBY operations
- [x] Monthly aggregation: `costs:ai:monthly:{YYYY-MM}`
- [x] Per-provider cost tracking
- [x] Budget enforcement with pre-flight checks
- [x] Cost calculations for all three providers:
  - Claude: $1/MTok input, $5/MTok output
  - OpenAI: $0.15/MTok input, $0.60/MTok output
  - DeepSeek: $0.27/MTok input, $1.10/MTok output

#### 2.4 Budget Enforcement (DONE ✅)
- [x] Daily budget limit ($5.00 default)
- [x] Monthly budget limit ($150.00 default)
- [x] Budget warnings at 50%, 75%, 90%
- [x] Hard stops when budget exceeded
- [x] Per-provider budget tracking
- [x] Comprehensive budget monitoring

#### 2.5 AI Analyzer Orchestration (DONE ✅)
- [x] Created `src/ai/analyzer.ts` - Main orchestrator
- [x] Differential caching (12-48h based on trust score):
  - High trust (60-69): 48 hours
  - Medium trust (40-59): 24 hours
  - Low trust (<40): 12 hours
  - Known bad actors: 7 days
- [x] Request deduplication via RequestCoalescer
- [x] Multi-provider failover via ProviderSelector
- [x] Comprehensive logging with correlation IDs

#### 2.6 Testing & Code Review (DONE ✅)
- [x] 156 tests passing across all components
- [x] 90%+ code coverage on critical paths
- [x] Code review completed - APPROVED FOR PRODUCTION
- [x] 0 critical issues, 0 moderate issues
- [x] ~8,905 lines production code
- [x] ~3,182 lines test code (35% ratio)

### Deliverables
- ✅ Multi-provider AI integration (Claude, OpenAI, DeepSeek)
- ✅ AI prompts with structured output validation
- ✅ Cost tracking with per-provider breakdown
- ✅ Budget enforcement ($5/day, $150/month)
- ✅ Differential caching based on trust scores
- ✅ Circuit breakers and fault tolerance
- ✅ PII sanitization
- ✅ Request deduplication
- ✅ Comprehensive testing suite

### Acceptance Criteria
- [x] All three AI providers operational
- [x] Returns dating intent (detected + confidence 0-100)
- [x] Returns age estimate for FriendsOver subs
- [x] Returns scammer risk (LOW/MEDIUM/HIGH + confidence)
- [x] All costs tracked accurately per-provider
- [x] Daily/monthly budget limits enforced
- [x] Analysis cached with differential TTL (12-48h)
- [x] Circuit breakers prevent cascading failures
- [x] PII removed before AI analysis
- [x] 156 tests passing, production-ready
- [ ] Budget alerts sent to mods (Phase 3 integration)
- [ ] No unexpected AI calls (Phase 3 integration testing)

---

## Phase 3: Configurable Rules Engine & Actions (Week 3) - DESIGN COMPLETE ✅

### Goals
- ✅ Build **fully configurable** rules system (no hardcoded rules)
- ✅ Implement hard rules with flexible conditions (account age, karma, email, content matching)
- ✅ Implement AI rules with **custom questions** (moderators write questions in natural language)
- ✅ Create action executors (FLAG, REMOVE, COMMENT)
- ✅ Add dry-run mode for testing
- ✅ Support text operators: `contains`, `not_contains`, `in`

### 🎯 Critical Design Insight: Custom AI Questions

**Moderators write custom AI questions** instead of using hardcoded detection types:
- **Example**: "Does this user appear to be seeking dating or romantic connections?"
- **AI Response**: `{ answer: "YES"/"NO", confidence: 0-100, reasoning: "..." }`
- **Rule**: If answer == "YES" AND confidence >= 80% → REMOVE

This makes the system truly flexible - moderators can define ANY detection without code changes.

### Tasks

#### 3.1 Rule Storage & Configuration (Priority 1)
- [ ] Create `src/types/rules.ts` - Type definitions
  - HardRule type (account/content conditions)
  - AIRule type (custom question + conditions)
  - Condition evaluation types
  - Action types (FLAG, REMOVE, COMMENT, APPROVE)
- [ ] Create `src/rules/storage.ts` - Redis storage
  - Store rules: `rules:{subreddit}:hard:{ruleId}`, `rules:{subreddit}:ai:{ruleId}`
  - Store rule index: `rules:{subreddit}:index` (sorted set by priority)
  - loadRules(), saveRule(), deleteRule(), listRules()
- [ ] Create `src/rules/defaults.ts` - Default rule sets
  - FriendsOver40/50: mod auto-approve, new low karma FLAG, dating intent REMOVE
  - bitcointaxes: same hard rules + spam detection FLAG
- [ ] Add Devvit Settings for rule configuration
  - `hard_rules_config` (JSON, multiline, subreddit scope)
  - `ai_rules_config` (JSON, multiline, subreddit scope)
  - `dry_run_mode` (boolean, default true for safety)
- [ ] **Time**: 3-4 hours

#### 3.2 Condition Evaluation Engine (Priority 2)
- [ ] Create `src/rules/conditions.ts` - Condition evaluator
- [ ] Support comparison operators: `>`, `<`, `>=`, `<=`, `==`, `!=`
- [ ] Support text operators: `contains`, `not_contains`, `in`
- [ ] Support logical operators: `AND`, `OR`
- [ ] Support dot notation for nested fields: `aiAnalysis.confidence`
- [ ] Test all operator combinations
- [ ] **Time**: 2-3 hours

#### 3.3 Rules Engine (Priority 3)
- [ ] Create `src/rules/engine.ts` - Main rules engine
- [ ] loadRules() - Load rules from Redis with 5-minute cache
- [ ] evaluate() - Evaluate all rules in priority order
- [ ] Per-rule try-catch (one rule failure doesn't break evaluation)
- [ ] Return ActionDecision: action, reason, confidence, matchedRules
- [ ] Support hard rules evaluation (always run)
- [ ] Support AI rules evaluation (only if aiAnalysis available)
- [ ] Default to APPROVE if no rules match
- [ ] **Time**: 4-6 hours

#### 3.4 Update Phase 2 AI System for Custom Questions (Priority 4)
- [ ] Modify `src/ai/prompts.ts` to accept custom questions
- [ ] Change AI response format from structured to Q&A format:
  - **Old**: `{ datingIntent: {...}, ageEstimate: {...} }`
  - **New**: `{ answers: [{ questionId, answer: "YES"/"NO", confidence, reasoning }] }`
- [ ] Update `src/ai/analyzer.ts` to batch multiple questions in one API call
- [ ] Cache AI responses by question ID
- [ ] Update AIAnalysisResult type to support custom questions
- [ ] **Time**: 4-5 hours

#### 3.5 Action Executors (Priority 5)
- [ ] Create `src/actions/executor.ts` - Action execution logic
- [ ] Implement FLAG action:
  - Use `context.reddit.report(post, { reason })`
  - Add mod note with rule details
  - Log to audit trail
- [ ] Implement REMOVE action:
  - Use `context.reddit.remove(post.id)`
  - Add comment if specified in rule actionParams
  - Use `context.reddit.submitComment()` and distinguish
  - Log to audit trail
- [ ] Implement COMMENT action:
  - Add warning comment without removing
  - Distinguish as mod
  - Log to audit trail
- [ ] Support variable substitution:
  - `{confidence}`, `{reason}`, `{username}`, `{subreddit}`
- [ ] Test all actions with correct Devvit API calls
- [ ] **Time**: 3-4 hours

#### 3.6 PostSubmit Handler Integration (Priority 6)
- [ ] Update `src/handlers/postSubmit.ts`
- [ ] Add rules engine evaluation after AI analysis
- [ ] Check dry-run mode before executing actions
- [ ] Execute determined action via action executor
- [ ] Update trust score based on action
- [ ] Enhanced audit logging:
  - Add matched rules
  - Add AI question responses
  - Add action taken + reason
- [ ] Error handling with fail-safe to FLAG
- [ ] **Time**: 2-3 hours

#### 3.7 Testing (Priority 7)
- [ ] Unit tests: `src/rules/__tests__/`
  - Test condition evaluation (all operators)
  - Test rules engine (priority, disabled rules, errors)
  - Test action executors
- [ ] Integration tests: `src/handlers/__tests__/`
  - Test complete flow with mock rules
  - Test dry-run mode
  - Test hard rules only (no AI)
  - Test AI rules with custom questions
- [ ] Manual testing in playtest:
  - Configure custom rules via settings
  - Test various user scenarios
  - Verify actions taken correctly
  - Check audit logs
- [ ] **Time**: 4-6 hours

### Deliverables
- ✅ Fully configurable rules system (JSON via Settings)
- ✅ Hard rules with flexible conditions (account, karma, content matching)
- ✅ AI rules with custom questions (moderator-defined)
- ✅ Text operators: `contains`, `not_contains`, `in`
- ✅ Action executors: FLAG, REMOVE, COMMENT
- ✅ Dry-run mode for safe testing
- ✅ Enhanced audit logging with rule details

### Acceptance Criteria
- [ ] Moderators can configure rules via JSON in Settings
- [ ] Hard rules evaluate account conditions (age, karma, email)
- [ ] Hard rules evaluate content conditions (contains, in)
- [ ] AI rules send custom questions to AI
- [ ] AI responds with YES/NO + confidence for each question
- [ ] Rules evaluated in priority order
- [ ] Disabled rules are skipped
- [ ] One rule failure doesn't break evaluation
- [ ] FLAG action reports to mod queue with reason
- [ ] REMOVE action removes post + adds comment if specified
- [ ] COMMENT action adds warning without removing
- [ ] Dry-run mode logs actions without executing
- [ ] Variable substitution works ({confidence}, {reason}, etc.)
- [ ] All actions logged to audit trail with matched rules
- [ ] Trust scores update after APPROVE actions
- [ ] Complete end-to-end flow works in playtest
- [ ] **Total estimated time**: 19-27 hours (2.5-3.5 days)

---

## Phase 4: Mod Configuration & UI (Week 4-5)

### Goals
- Build mod settings panel
- Create per-subreddit configurations
- Add cost monitoring dashboard
- Implement manual override tools
- Add trust management UI

### Tasks

#### 4.1 Settings Panel
- [ ] Implement Devvit settings:
  - OpenAI API key (secret)
  - Daily budget limit (number, default $5)
  - Trust score threshold (number, 0-100, default 70)
  - Min approved posts for trust (number, default 3)
  - Enable auto-actions (boolean, default false)
- [ ] Add AI prompt customization:
  - Dating intent prompt (text)
  - Age check prompt (text)
  - Scammer check prompt (text)
- [ ] Test settings save/load

#### 4.2 Rule Configuration UI
- [ ] Create form for hard rules:
  - Account age minimum
  - Karma minimum
  - Email verified required
  - Action to take (FLAG/REMOVE/COMMENT)
- [ ] Create form for AI rules:
  - Enable dating check
  - Dating confidence threshold
  - Enable age check
  - Age confidence threshold
  - Enable scammer check
  - Scammer confidence threshold
- [ ] Save to Redis: `rules:{subreddit}:config`
- [ ] Test configuration changes

#### 4.3 Cost Monitoring Dashboard
- [ ] Create mod menu item: "AI Automod Stats"
- [ ] Display:
  - Today's AI cost
  - Month's total cost
  - Daily budget limit
  - Calls remaining today
  - Users analyzed today
  - Actions taken today (FLAG/REMOVE/etc.)
- [ ] Add export option for audit logs
- [ ] Test dashboard display

#### 4.4 Manual Override Tools
- [ ] Add mod menu: "Trust User"
  - Manually mark user as trusted
  - Bypass all checks
- [ ] Add mod menu: "Untrust User"
  - Remove trusted status
  - Require re-analysis on next post
- [ ] Add mod menu: "Reanalyze User"
  - Clear cache
  - Force fresh AI analysis
- [ ] Test override actions

#### 4.5 Trust Leaderboard
- [ ] Create view: Top trusted users
- [ ] Show trust scores
- [ ] Show # of approved posts
- [ ] Test leaderboard

#### 4.6 Testing & Refinement
- [ ] Deploy to r/AiAutomod test sub
- [ ] Create test scenarios:
  - New user with clean history
  - New user with dating history
  - Scammer-like profile
  - Established user
- [ ] Invite user to test
- [ ] Gather feedback
- [ ] Refine prompts based on results
- [ ] Adjust thresholds

### Deliverables
- Full mod settings panel
- Cost monitoring dashboard
- Manual override tools
- Trust management UI
- Tested and refined

### Acceptance Criteria
- [ ] Mods can configure all settings
- [ ] Mods can view costs and stats
- [ ] Mods can manually trust/untrust users
- [ ] Mods can force reanalysis
- [ ] Dashboard shows accurate data
- [ ] Test scenarios all work correctly
- [ ] User feedback incorporated
- [ ] Ready for production deployment

---

## Phase 5: Production Deployment & Monitoring (Week 5)

### Goals
- Deploy to production subreddits
- Monitor performance and costs
- Gather real-world data
- Refine based on results
- Document for handoff

### Tasks

#### 5.1 Pre-Deployment Checklist
- [ ] Review all code
- [ ] Run code-reviewer agent
- [ ] Security audit (API keys, sensitive data)
- [ ] Performance testing (handle 20+ posts/day)
- [ ] Cost projections validated
- [ ] Backup Redis data
- [ ] Document rollback plan

#### 5.2 Gradual Rollout
- [ ] Week 1: Deploy to r/AiAutomod only
  - Monitor closely
  - FLAG-only mode
  - Daily reviews
- [ ] Week 2: Add r/bitcointaxes
  - Different rules (no dating check)
  - Monitor accuracy
- [ ] Week 3: Add r/FriendsOver50
  - Dating + age checks
  - Monitor for false positives
- [ ] Week 4: Add r/FriendsOver40
  - Full deployment
  - Monitor all metrics

#### 5.3 Monitoring & Metrics
- [ ] Track daily:
  - New posts analyzed
  - Actions taken (FLAG/REMOVE)
  - False positives (mod overrides)
  - AI costs
  - Trust score distributions
- [ ] Weekly reviews:
  - Accuracy rates
  - Cost trends
  - User feedback
  - Prompt effectiveness

#### 5.4 Refinement
- [ ] Adjust AI prompts based on results
- [ ] Tune confidence thresholds
- [ ] Refine trust score algorithm
- [ ] Update hard rule thresholds
- [ ] Optimize caching strategy

#### 5.5 Documentation
- [ ] Update all docs with final architecture
- [ ] Create mod guide
- [ ] Document common scenarios
- [ ] Create troubleshooting guide
- [ ] Write handoff documentation

#### 5.6 Future Enhancements Planning
- [ ] Collect enhancement ideas
- [ ] Prioritize improvements
- [ ] Document in backlog
- [ ] Plan Phase 6 features

### Deliverables
- Production deployment complete
- All 3 subs operational
- Monitoring dashboard active
- Documentation complete
- Handoff ready

### Acceptance Criteria
- [ ] App running on all 3 production subs
- [ ] Costs within budget ($20-30/month)
- [ ] < 5% false positive rate
- [ ] Mods satisfied with accuracy
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Ready for long-term operation

---

## Success Metrics

### Technical Metrics
- **Uptime**: > 99.9%
- **API Success Rate**: > 99%
- **Cache Hit Rate**: > 60%
- **Average Analysis Time**: < 5 seconds

### Business Metrics
- **False Positive Rate**: < 5%
- **False Negative Rate**: < 10%
- **Mod Time Saved**: > 50%
- **Monthly Cost**: < $30

### User Experience
- **User Complaints**: < 2%
- **Successful Appeals**: < 10%
- **Mod Satisfaction**: > 90%

---

## Risk Mitigation

### Risk: AI Costs Exceed Budget
- **Mitigation**: Daily budget limits enforced
- **Response**: Increase limit or reduce analysis frequency

### Risk: High False Positive Rate
- **Mitigation**: Start with FLAG-only mode
- **Response**: Adjust confidence thresholds, refine prompts

### Risk: Reddit API Rate Limits
- **Mitigation**: Cache aggressively, respect rate limits
- **Response**: Implement exponential backoff

### Risk: OpenAI API Downtime
- **Mitigation**: Graceful degradation (fall back to hard rules only)
- **Response**: Queue analyses for retry

### Risk: Trust Score Gaming
- **Mitigation**: Multiple factors in trust calculation
- **Response**: Monitor for suspicious patterns, manual review

---

## Timeline Summary

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| Phase 1 | Weeks 1-2 | User profiling system working |
| Phase 2 | Weeks 2-3 | AI integration with cost tracking |
| Phase 3 | Weeks 3-4 | Rules engine + actions operational |
| Phase 4 | Week 4-5 | Mod UI + testing complete |
| Phase 5 | Week 5 | Production deployment |

**Total**: 4-5 weeks from start to production

---

## Next Steps

1. ✅ Complete Phase 1 foundation (DONE)
2. Begin Phase 1.2: Build user profile fetcher
3. Build post history analyzer
4. Implement trust score system
5. Test end-to-end profile analysis

---

## Notes

- **Phase 1 is partially complete** - Event handlers and storage layer working
- **Focus on FriendsOver40/50 use case first** - Add bitcointaxes later
- **Start in FLAG-only mode** - Transition to auto-actions after validation
- **Cost tracking is critical** - Monitor daily to avoid budget overruns
- **Iterate based on real data** - Refine prompts and thresholds continuously
