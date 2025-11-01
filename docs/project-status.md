# Project Status

**Last Updated**: 2025-10-31
**Current Phase**: Phase 5 - Refinement & Optimization
**Current Version**: 0.1.106
**Overall Progress**: 99% (Core features complete, trust system working perfectly)
**Status**: Phase 5.53 Complete ✅ | PM notification error handling + Queue system design

---

## Project Overview

Reddit AI Automod is a user profiling & analysis system for Reddit communities. Uses AI (Claude/OpenAI/OpenAI-Compatible) to detect problematic posters: romance scammers, dating seekers, underage users, and spammers.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude 3.5 Haiku/OpenAI/OpenAI-Compatible)
**Target Subreddits**: r/FriendsOver40, r/FriendsOver50, r/bitcointaxes

---

## Project Pivot - 2025-10-25

**Important**: The project architecture has been significantly revised based on actual use case requirements.

**Original Plan**: Generic rule engine with 20 predetermined rules + custom rule builder
**New Direction**: User profiling & analysis system focused on specific moderation needs

**Target Subreddits**:
- r/FriendsOver40 (detect dating seekers, scammers, underage users)
- r/FriendsOver50 (detect dating seekers, scammers, underage users)
- r/bitcointaxes (detect spam, off-topic)

---

## Recent Completed Tasks

### Phase 5.53 (2025-10-31)
- [x] Improved PM notification error handling with detailed error messages
- [x] Added specific detection for NOT_WHITELISTED_BY_USER_MESSAGE errors
- [x] Provides clear solutions in logs (add bot to trusted users OR use modmail)
- [x] Handles USER_DOESNT_EXIST errors gracefully
- [x] Continues sending to other recipients if one fails
- [x] Created comprehensive queue system design document
- [x] Documented 3 architecture options (Sorted Set Queue recommended)
- [x] Analyzed Devvit scheduler limits and constraints
- [x] Designed Redis-based async queue for Layer 2+3 processing
- [x] Documented performance capacity, failure scenarios, and migration strategy
- [x] Deployed version 0.1.106

### Phase 5.52 (2025-10-30)
- [x] Added aiCostUSD and aiTokensUsed fields to AnalysisHistoryEntry
- [x] Updated saveAnalysisHistory to capture AI cost from aiAnalysis
- [x] Added cost and token display to AI analysis form (Layer 3)
- [x] Verified all providers return accurate cost data
- [x] Claude, OpenAI, and OpenAI Compatible all calculate costs correctly
- [x] Cost calculated using provider-specific token pricing
- [x] Provides full cost transparency per analysis
- [x] Deployed version 0.1.105

### Phase 5.51 (2025-10-30)
- [x] Updated saveAnalysisHistory to accept APPROVE actions
- [x] APPROVE action now saves analysis history to Redis
- [x] Moderators can view analysis for posts that passed all layers
- [x] Provides visibility into "close calls" and AI decisions
- [x] Only saves for posts that went through full pipeline evaluation
- [x] Skips whitelisted/mod/approved/community-trusted users (too much data)
- [x] Deployed version 0.1.104

### Phase 5.50 (2025-10-30)
- [x] Removed pointless "AI Automod Settings" menu item
- [x] Created cost dashboard form to replace toast notification
- [x] Enhanced cost dashboard with daily/monthly budget tracking
- [x] Added provider-specific cost breakdowns (Claude, OpenAI, OpenAI Compatible)
- [x] Added configuration display (dry-run mode, primary/fallback providers)
- [x] Enhanced analysis history storage to track all three pipeline layers
- [x] Updated AnalysisHistoryEntry interface with layer1/layer2/layer3 fields
- [x] Updated postSubmit handler to pass pipeline info to executeAction
- [x] Updated commentSubmit handler to pass pipeline info to executeAction
- [x] Enhanced AI analysis form to display all three moderation layers
- [x] Form shows Layer 1 (New Account Check) pass/fail with reason
- [x] Form shows Layer 2 (OpenAI Moderation) pass/fail with categories
- [x] Form shows Layer 3 (Custom AI Rules) with full AI analysis
- [x] Added "Triggered By" field showing which layer caused action
- [x] Deployed version 0.1.103
- [x] Verified forms display correctly with organized layout

### Phase 5.49 (2025-10-30)
- [x] Discovered modLog API not available in trigger contexts (only UI contexts)
- [x] Pivoted to Redis-based analysis history storage solution
- [x] Created src/storage/analysisHistory.ts for 90-day data retention
- [x] Updated executor to save analysis data to Redis after successful actions
- [x] Removed obsolete modNotes.ts and broken modLog integration
- [x] Created Devvit form for displaying AI analysis to moderators
- [x] Improved form from single cramped paragraph to organized multi-field layout
- [x] Fixed text readability by removing disabled flag (dark text vs grey)
- [x] Form displays: action, rule, user trust metrics, AI provider/model, confidence, reasoning
- [x] Moderators can right-click post → "View AI Analysis" to see complete details
- [x] Deployed versions 0.1.99, 0.1.100, 0.1.101, 0.1.102
- [x] All features working and tested

See [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md) for complete version history.

---

## Next Steps

### Immediate Priority: Queue System Implementation (Optional)

**Status**: Design complete, implementation optional

**Design Document**: `/docs/queue-system-design.md`

**Problem**: All moderation processing happens synchronously in trigger handlers, which:
- Blocks post submission for 5-10 seconds during AI analysis
- Can crash trigger handler if AI fails
- May overwhelm system during high-traffic periods
- Could hit trigger timeout limits

**Proposed Solution**: Redis Sorted Set queue with background worker
- Layer 1 runs inline (fast, no AI)
- Layer 2+3 queued for background processing
- Posts return immediately to user
- Worker processes queue every minute (batch of 10)

**Key Benefits**:
- ✅ Instant post submission (<500ms vs 5-10s)
- ✅ Better error isolation
- ✅ More scalable (handles 10+ posts/minute)
- ✅ Crash-resistant

**Considerations**:
- ⚠️ Adds architectural complexity
- ⚠️ Slight processing delay (30-60 seconds)
- ⚠️ Only beneficial for high-traffic subreddits (>30 posts/hour)

**When to Implement**:
- If experiencing post submission lag
- If planning to scale to many high-traffic subreddits
- If seeing frequent trigger timeouts

**When NOT to Implement**:
- Current inline processing works fine for low-traffic subs
- Adds complexity for minimal benefit on small communities
- Can always implement later if needed

### Future Enhancements

- **Performance Optimizations**
  - Further Redis caching improvements
  - Batch processing for multiple posts (via queue system if needed)
  - Optimized post history fetching

- **Additional AI Providers**
  - Anthropic Claude 3 Opus (higher accuracy)
  - Google Gemini support
  - More cost-effective provider options

- **Enhanced Analytics Dashboard**
  - Detailed trust score trends
  - AI cost tracking by subreddit
  - Moderation action effectiveness metrics

- **Advanced Features**
  - User appeal system for false positives
  - Automated retraining based on mod feedback
  - Custom rule templates for different subreddit types

---

## Recent Decisions

**2025-10-31**: Documented async queue system design (optional optimization)
- **Context**: User questioned whether inline processing could overwhelm system during high-traffic periods or cause lag/crashes
- **Analysis**: Current synchronous processing blocks for 5-10 seconds during AI analysis, could be problematic for high-volume subreddits
- **Design Created**: Comprehensive queue system using Redis Sorted Sets
  - Option 1 (Recommended): Sorted Set queue with FIFO ordering
  - Option 2: Counter + Hash storage
  - Option 3: Simple key-value list
- **Key Features**: Layer 1 inline (fast), Layer 2+3 queued, background worker processes batches
- **Devvit Constraints**: Scheduler has 60 jobs/min creation limit, no explicit timeout documented for scheduler jobs, HTTP calls timeout at 30s
- **Capacity Analysis**: Worker can process 10 posts/minute = 600 posts/hour (far exceeds typical traffic)
- **Decision**: Document design but defer implementation until needed. Current inline processing sufficient for target subreddits.
- **Implementation Path**: 4-phase migration strategy with parallel operation and gradual rollout
- **Documentation**: `/docs/queue-system-design.md` (comprehensive design doc)

**2025-10-31**: Enhanced PM notification error handling
- **Problem**: User received cryptic "NOT_WHITELISTED_BY_USER_MESSAGE" error when bot tried to send PM notifications. User has Reddit privacy settings restricting PMs to trusted users only.
- **Solution**: Added detailed error detection and helpful logging
  - Detects NOT_WHITELISTED_BY_USER_MESSAGE specifically
  - Provides two clear solutions in logs: (1) Add bot to trusted users, OR (2) Change setting to "all" for modmail
  - Handles USER_DOESNT_EXIST errors gracefully
  - Continues sending to other recipients if one fails
- **Impact**: Better user experience with clear error messages. Moderators understand the issue and know how to fix it.
- **Implementation**: Enhanced error handling in sendRealtimeDigest() and sendBudgetAlert() in modmailDigest.ts

**2025-10-30**: Implemented mod log entries for transparency and audit trail
- **Problem**: Moderators had no visibility into why AI Automod took specific actions. No record of AI reasoning, confidence scores, or which provider made the decision.
- **Solution**: Created automatic mod log entries for all AI Automod actions (FLAG, REMOVE, COMMENT). Entries appear in the subreddit's moderation log and include rule name, trust score, account age/karma, AI provider/model, confidence score, and AI reasoning.
- **Format**: Optimized description text with smart truncation:
  ```
  AI Automod: Removed
  Rule: Dating content detection
  Trust: 34/100 | Age: 2d | Karma: 15
  AI: 87% (OpenAI GPT-4o-mini)
  User shows explicit dating intent across subreddits. Scammer pattern detected.
  ```
- **Correction**: Initially implemented as mod notes (user profile notes) but corrected to use mod log API (`context.modLog.add()`) which is the proper API for action tracking in the moderation log.
- **Impact**: Full transparency for mod teams. Clear audit trail in mod log. Easy pattern recognition. Shows which AI model made each decision.
- **Implementation**: Created modNotes.ts helper (uses modLog API despite filename), updated AI analyzer to track provider/model, integrated into executor after successful actions. Respects enableModLog setting (default: ON).

**2025-10-30**: Implemented comment templates and improved field naming
- **Problem**: Removal/warning comments were just showing raw reason text with no context or appeal information. Field naming was confusing (`comment` field purpose unclear).
- **Solution**: Created professional comment templates for REMOVE and COMMENT actions with customizable settings. Renamed `comment` to `modlog` to clarify purpose (user-facing vs mod-only).
- **Impact**: Much better user experience - removal comments now explain what happened, how to appeal, and that replies aren't monitored. Cleaner field naming makes rules easier to understand.
- **Templates**: REMOVE shows full explanation with appeal process. COMMENT shows just the reason with simple footer. Both customizable via settings with professional defaults.
- **Bug Fixed**: COMMENT actions were incorrectly being treated as REMOVE for trust tracking, causing posts to be removed when they should only get a warning comment.

**2025-10-30**: Fixed AI prompt to use preponderance of evidence instead of requiring certainty
- **Problem**: AI was finding correct evidence (r/SeattleWA posts) but answering NO to "Does this user live in the US?" questions. Had 70% confidence but wrong answer.
- **Root Cause**: AI was treating YES/NO as requiring absolute certainty. It found evidence pointing toward YES but said NO because it couldn't be 100% certain.
- **Solution**: Reframed prompt with DECISION FRAMEWORK:
  - "Answer YES if the available evidence suggests the answer is more likely yes than no"
  - "Answer NO if the available evidence suggests the answer is more likely no than yes"
  - YES/NO = direction of evidence | Confidence = strength of evidence
- **Impact**: AI now uses preponderance of evidence for binary decisions. Location-specific subreddit activity correctly interpreted as evidence of residence.
- **Implementation**: Modified src/ai/prompts.ts lines 623-652 with new decision framework and simplified instructions.

**2025-10-30**: Designed centralized cache invalidation system with version prefix
- **Rationale**: Current cache invalidation incomplete - can't clear all data for testing, no version-based invalidation for breaking changes, no per-user clearing. Devvit Redis lacks SCAN operation requiring explicit key tracking. Scattered key patterns throughout codebase make maintenance difficult.
- **Impact**: Enables complete cache wipes for testing, instant cache invalidation via version bump (v1→v2), per-user cache clearing for moderators. Single source of truth for all Redis keys. Future-proof architecture.
- **Implementation**: Centralized key builder with format `v{version}:{scope}:{userId}:{...parts}`. User data stored as dictionaries (trust scores for all subreddits in single key). Dynamic data uses tracking sets (AI questions). Migration path: create key builder, migrate code incrementally, add menu actions.
- **Status**: Design approved and documented in project-status.md, implementation pending.

---

## Known Issues

### Cache Invalidation System (Priority: Medium) - DESIGN APPROVED

**Context**: Devvit Redis doesn't support SCAN operation. Current cache invalidation is incomplete.

**Requirements**:

1. **Testing/Development** - Complete wipe of ALL cached data
2. **Production Deployment** - Version-based cache invalidation for breaking changes
3. **Per-User Cache Clearing** - Moderator tool to clear specific user's cache

**Constraints**:
- Devvit Redis does NOT support SCAN operation
- Must track cache keys explicitly or use known patterns
- Cannot iterate over all keys in Redis

**APPROVED DESIGN: Centralized Key Builder with Version Prefix**

### Key Structure

All Redis keys use centralized builder with version prefix:

```typescript
// Pattern: v{version}:{scope}:{userId}:{...parts}

// User-scoped keys
v1:user:t2_abc123:profile           → { karma: 1000, age: 365, ... }
v1:user:t2_abc123:history           → { posts: [...], comments: [...] }
v1:user:t2_abc123:trust             → { "FriendsOver40": {...}, "FriendsOver50": {...} }
v1:user:t2_abc123:tracking          → { "FriendsOver40": {...}, "FriendsOver50": {...} }

// AI questions with tracking set
v1:user:t2_abc123:ai:questions:keys → SET of [hash1, hash2, hash3]
v1:user:t2_abc123:ai:questions:hash123
v1:user:t2_abc123:ai:questions:hash456

// Global keys
v1:global:cost:daily:2025-01-30
v1:global:cost:monthly:2025-01
v1:global:cost:record:timestamp:userId
v1:global:tracking:subreddit:users  → SET of all user IDs
```

See project-status.md "Known Issues" section for full implementation details.

---

## Development Workflow

For development practices and workflow, see [CLAUDE.md](/home/cdm/redditmod/CLAUDE.md).
For complete version history, see [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md).

---

## Quick Stats

- **Total Versions**: 106 (0.0.1 → 0.1.106)
- **Current Trust System**: Working perfectly in production
- **AI Providers**: Claude 3.5 Haiku, OpenAI, OpenAI-Compatible (z.ai, Groq, Together AI, X.AI/Grok)
- **Active Subreddits**: 3 target communities
- **Core Features**: 100% complete
- **Test Coverage**: Comprehensive (93 tests for content sanitizer alone)
- **Provider Fallback**: Fixed - respects 'none' setting correctly
- **Error Logging**: Enhanced - captures full API error details
- **PM Notifications**: Enhanced error handling with helpful messages
