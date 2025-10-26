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

## Phase 1: Foundation & User Profile Analysis (Week 1-2)

### Goals
- ✅ Set up development environment (DONE)
- ✅ Create basic Devvit app structure (DONE)
- ✅ Implement event handlers (DONE)
- ✅ Set up Redis storage layer (DONE)
- Build user profile fetcher
- Build post history analyzer
- Implement trust score system

### Tasks

#### 1.1 Complete Foundation (DONE ✅)
- ✅ Install Node.js v20.19.5
- ✅ Install Devvit CLI v0.12.1
- ✅ Create Devvit project structure
- ✅ Set up TypeScript configuration
- ✅ Implement PostSubmit handler
- ✅ Implement CommentSubmit handler
- ✅ Deploy to playtest subreddit

#### 1.2 User Profile Fetcher
- [ ] Create `src/profile/fetcher.ts`
- [ ] Implement `getUserProfile(userId)`
  - Account creation date
  - Total karma (link + comment)
  - Email verified status
  - Is moderator flag
- [ ] Add profile caching (24h TTL in Redis)
- [ ] Test with real user accounts

#### 1.3 Post History Analyzer
- [ ] Create `src/profile/historyAnalyzer.ts`
- [ ] Implement `getUserHistory(username, limit=20)`
- [ ] Fetch last 20 posts/comments across ALL subreddits
- [ ] Extract data:
  - Full text content
  - Subreddit names
  - Timestamps
  - Engagement metrics (score, comments)
- [ ] Cache results in Redis (24h TTL)
- [ ] Test with various user types

#### 1.4 Trust Score System
- [ ] Create `src/profile/trustScore.ts`
- [ ] Implement trust score calculation (0-100)
  - Account age factor
  - Karma factor
  - Email verified factor
  - Approved post history factor
- [ ] Store scores in Redis: `user:{userId}:trustScore`
- [ ] Implement "trusted user" flag: `user:{subreddit}:trusted:{userId}`
- [ ] Create `checkIfTrusted()` function
- [ ] Test score calculations

#### 1.5 Integration
- [ ] Update PostSubmit handler to:
  - Check if user is trusted (skip analysis if yes)
  - Fetch user profile
  - Fetch post history
  - Cache results
  - Calculate trust score
- [ ] Add comprehensive logging
- [ ] Test end-to-end flow

### Deliverables
- User profile fetcher working
- Post history analyzer working
- Trust score system operational
- Basic caching layer functional

### Acceptance Criteria
- [ ] Can fetch user profile data for any Reddit user
- [ ] Can fetch last 20 posts/comments from user history
- [ ] Trust scores are calculated correctly
- [ ] Trusted users skip expensive analysis
- [ ] All data is cached appropriately (24h TTL)
- [ ] No errors in playtest environment

---

## Phase 2: AI Integration & Cost Tracking (Week 2-3)

### Goals
- Integrate OpenAI API
- Build AI analysis prompts
- Implement cost tracking
- Add daily budget enforcement
- Cache AI analysis results

### Tasks

#### 2.1 OpenAI Integration
- [ ] Create `src/ai/openai.ts`
- [ ] Add OpenAI API key to Devvit settings (encrypted)
- [ ] Implement `analyzeUser()` function
- [ ] Use `gpt-4o-mini` model (cost-effective)
- [ ] Parse JSON responses from AI
- [ ] Handle API errors gracefully

#### 2.2 AI Prompt Templates
- [ ] Create `src/ai/prompts.ts`
- [ ] Design prompt for **dating intent detection**:
  - Input: user profile + last 20 posts
  - Output: YES/NO + confidence (0-100)
- [ ] Design prompt for **age detection** (FriendsOver40/50):
  - Input: user profile + post history
  - Output: Estimated age range + confidence
- [ ] Design prompt for **scammer detection**:
  - Input: user profile + post history
  - Output: LOW/MEDIUM/HIGH risk + confidence
- [ ] Design prompt for **overall analysis**:
  - Combines all checks
  - Returns structured JSON
  - Includes summary and red flags
- [ ] Test prompts with sample data

#### 2.3 Cost Tracking System
- [ ] Create `src/ai/costTracker.ts`
- [ ] Implement daily cost tracking:
  - Redis key: `costs:ai:daily:{date}`
  - Track: totalCalls, totalTokens, estimatedCost
  - TTL: 48 hours
- [ ] Implement monthly aggregation:
  - Redis key: `costs:ai:monthly:{YYYY-MM}`
  - No expiry
- [ ] Create `trackAICost(usage)` function
- [ ] Estimate costs based on token usage:
  - Input tokens: $0.15 per 1M (gpt-4o-mini)
  - Output tokens: $0.60 per 1M
- [ ] Test cost calculations

#### 2.4 Budget Enforcement
- [ ] Add `daily_budget_limit` to Devvit settings (default: $5.00)
- [ ] Implement `checkBudget()` function
- [ ] Throw error if daily limit exceeded
- [ ] Log budget warnings at 50%, 75%, 90%
- [ ] Create mod notification for budget alerts
- [ ] Test budget limits

#### 2.5 Analysis Result Caching
- [ ] Cache AI analysis in Redis:
  - Key: `user:{userId}:analysis`
  - TTL: 24 hours
  - Contains: AI analysis + timestamp
- [ ] Implement cache-first logic:
  - Check cache before calling AI
  - Reuse cached results if < 24h old
- [ ] Test caching reduces AI calls

#### 2.6 Integration
- [ ] Update PostSubmit handler to:
  - Check cache first
  - Check budget before AI call
  - Call AI analysis
  - Track costs
  - Cache results
  - Handle budget exceeded errors
- [ ] Test complete AI analysis flow

### Deliverables
- OpenAI integration working
- AI prompts returning structured data
- Cost tracking operational
- Daily budget enforcement active
- Analysis results cached

### Acceptance Criteria
- [ ] AI successfully analyzes user profiles
- [ ] Returns dating intent (YES/NO + confidence)
- [ ] Returns age estimate for FriendsOver subs
- [ ] Returns scammer risk (LOW/MEDIUM/HIGH)
- [ ] All costs tracked accurately in Redis
- [ ] Daily budget limit enforced
- [ ] Analysis cached for 24h
- [ ] Budget alerts sent to mods
- [ ] No unexpected AI calls

---

## Phase 3: Rules Engine & Action Execution (Week 3-4)

### Goals
- Build configurable rules system
- Implement hard rules (account age, karma, email)
- Implement AI rules (intent detection)
- Create action executors (FLAG, REMOVE, COMMENT, BAN)
- Add audit logging

### Tasks

#### 3.1 Rules Configuration
- [ ] Create `src/rules/config.ts`
- [ ] Define `RuleConfig` type:
  ```typescript
  {
    hardRules: HardRule[],
    aiRules: AIRule[],
    trustThreshold: number,
    minApprovedPosts: number
  }
  ```
- [ ] Store rules in Redis: `rules:{subreddit}:config`
- [ ] Create default configs for:
  - r/FriendsOver40
  - r/FriendsOver50
  - r/bitcointaxes
- [ ] Implement rule loading function

#### 3.2 Hard Rules Evaluator
- [ ] Create `src/rules/hardRules.ts`
- [ ] Implement `evaluateHardRules(profile, rules)`
- [ ] Support conditions:
  - Account age (lessThan, greaterThan)
  - Karma (lessThan, greaterThan)
  - Email verified (true/false)
  - Is moderator (true/false)
- [ ] Return matching rules + reasons
- [ ] Test with various profiles

#### 3.3 AI Rules Evaluator
- [ ] Create `src/rules/aiRules.ts`
- [ ] Implement `evaluateAIRules(aiAnalysis, rules)`
- [ ] Check AI confidence thresholds
- [ ] Support conditions:
  - Dating intent (YES/NO with min confidence)
  - Age detection (under threshold with min confidence)
  - Scammer risk (LOW/MEDIUM/HIGH with min confidence)
- [ ] Return matching rules + reasons
- [ ] Test with sample AI results

#### 3.4 Action Executors
- [ ] Create `src/actions/` directory
- [ ] Implement `FLAG` action:
  - Report post to mod queue
  - Add flair "Pending Review"
  - Log to Redis
- [ ] Implement `REMOVE` action:
  - Remove post
  - Optional: Post removal comment
  - Log to Redis
- [ ] Implement `COMMENT` action:
  - Auto-reply with template
  - Support variables: {username}, {reason}, etc.
  - Log to Redis
- [ ] Implement `BAN` action (manual override only):
  - Ban user
  - Send ban message
  - Log to Redis
  - Require mod approval flag
- [ ] Create auto-comment templates:
  - Dating removal: "This sub is not for dating..."
  - Unverified account: "Please verify your email..."
  - Underage: "This sub is for 40+..."
- [ ] Test all actions in playtest

#### 3.5 Audit Logging
- [ ] Create `src/storage/auditLogger.ts`
- [ ] Enhance existing audit log:
  - Add user trust score
  - Add AI analysis summary
  - Add matched rules
  - Add action taken + reason
  - Add cost of analysis
- [ ] Store logs: `audit:{subreddit}:{date}`
- [ ] Implement log querying for mods
- [ ] Test logging

#### 3.6 Decision Engine
- [ ] Create `src/rules/decisionEngine.ts`
- [ ] Implement main decision logic:
  ```
  1. Check if trusted → APPROVE
  2. Evaluate hard rules → if match, take action
  3. Evaluate AI rules → if match, take action
  4. Default: APPROVE
  5. Update trust score
  6. Log decision
  ```
- [ ] Handle multiple rule matches (priority)
- [ ] Handle conflicts (most severe wins)
- [ ] Test decision tree

#### 3.7 Integration
- [ ] Wire decision engine into PostSubmit handler
- [ ] Test complete flow:
  - New user posts
  - Profile fetched
  - History fetched
  - AI analyzes
  - Rules evaluated
  - Action executed
  - Audit logged
  - Trust score updated
- [ ] Test with various scenarios:
  - Trusted user
  - New legit user
  - Dating seeker
  - Scammer
  - Underage user

### Deliverables
- Rules engine operational
- Hard rules working
- AI rules working
- All actions implemented
- Audit logging enhanced
- Decision engine complete

### Acceptance Criteria
- [ ] Rules are configurable per subreddit
- [ ] Hard rules correctly flag violations
- [ ] AI rules use confidence thresholds
- [ ] FLAG action reports to mod queue
- [ ] REMOVE action removes + comments
- [ ] COMMENT action posts templates
- [ ] BAN requires manual approval
- [ ] All actions are logged
- [ ] Trust scores update after actions
- [ ] No false positives in testing
- [ ] Complete end-to-end flow works

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
