# Project Status

**Last Updated**: 2025-10-30
**Current Phase**: Phase 5 - Refinement & Optimization
**Current Version**: 0.1.103
**Overall Progress**: 99% (Core features complete, trust system working perfectly)
**Status**: Phase 5.50 Complete ✅ | Enhanced UI forms and pipeline layer tracking

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

### Phase 5.48 (2025-10-30)
- [x] Initial attempt at mod log entries (later discovered API limitation)
- [x] Tried to use `context.modLog.add()` (not available in triggers)
- [x] Added modLog: true to Devvit.configure() (correct but insufficient)
- [x] Learned that modLog API is only available in UI contexts, not trigger handlers
- [x] This led to Phase 5.49 Redis-based solution

### Phase 5.47 (2025-10-30)
- [x] Initial implementation of mod transparency feature (later corrected to mod log)
- [x] Created moderation tracking helper module (src/actions/modNotes.ts)
- [x] Updated AI analyzer to return provider and model information
- [x] Added model field to AIAnalysisResult and AIQuestionBatchResult types
- [x] Integrated tracking into action executor (FLAG, REMOVE, COMMENT)
- [x] Includes: rule name, trust score, account age, karma, AI provider/model, confidence, reasoning
- [x] Format optimized with smart truncation
- [x] Graceful error handling - failures don't block action execution
- [x] Only created after successful actions (not in dry-run mode)

### Phase 5.46 (2025-10-30)
- [x] Implemented comment template system for REMOVE and COMMENT actions
- [x] Added customizable templates via settings with professional defaults
- [x] Created template variable substitution: {reason}, {subreddit}, {contentType}, {confidence}
- [x] Renamed confusing `comment` field to `modlog` in actionConfig
- [x] Made menu items (View AI Costs, AI Automod Settings) moderator-only
- [x] Fixed modmail URL format (removed extra slash: to=r/{subreddit})
- [x] Improved template wording ("someone will review" instead of "a human")
- [x] Fixed COMMENT action trust tracking bug (was incorrectly treating as REMOVE)
- [x] Simplified COMMENT template to just reason + footer
- [x] Standardized footer format across all templates for consistency
- [x] Updated README.md with new field names and template documentation
- [x] Deployed versions 0.1.88 through 0.1.95
- [x] Committed and pushed all changes

### Phase 5.45 (2025-10-30)
- [x] Fixed AI prompt decision framework to use preponderance of evidence
- [x] Root cause analysis: AI was treating YES/NO as requiring absolute certainty
- [x] Reframed prompt: "Answer YES if evidence points toward yes, even if not 100% certain"
- [x] Added DECISION FRAMEWORK section with clear guidance on probabilistic reasoning
- [x] Fixed location inference issue (SeattleWA posts → US residence)
- [x] Updated posting history description from "last 20" to "up to 200 items"
- [x] Changed confidence score guidance to reflect evidence strength, not answer threshold
- [x] Updated to version 0.1.85
- [x] Committed and pushed changes (f51bfc6, f0db519, 69c71bf)

### Phase 5.44 (2025-10-30)
- [x] Read and analyzed complete Reddit Devvit documentation (289KB source)
- [x] Extracted all relevant information for automod development
- [x] Created comprehensive reference document: docs/devvit-reference.md (2,610 lines)
- [x] Documented: triggers, Reddit API, permissions, Redis, HTTP fetch, settings, menu actions, forms, scheduler, error handling, testing, performance, devvit.json
- [x] Added automod use case examples
- [x] No version bump (documentation only)

### Phase 5.43 (2025-10-29)
- [x] Added X.AI (Grok) domain to HTTP fetch allowlist
- [x] Added 'api.x.ai' to devvit.yaml allowList (line 13)
- [x] Tested Grok API endpoint successfully (grok-3 model working)
- [x] Confirmed alternative OpenAI-compatible provider functionality
- [x] Updated to version 0.1.58
- [x] Committed and pushed changes (e4b3503)

### Phase 5.42 (2025-10-29)
- [x] Enhanced error logging in OpenAI-compatible provider
- [x] Now captures full API error responses (status, code, message)
- [x] Added detailed error extraction in 3 locations (analyze, analyzeWithQuestions, healthCheck)
- [x] Logs now show complete error objects instead of just error.message
- [x] Improved debugging for provider-specific API errors
- [x] Updated to version 0.1.57
- [x] Committed and pushed changes (a3c05ee)

### Phase 5.41 (2025-10-29)
- [x] Fixed critical fallback provider logic bug in src/config/ai.ts
- [x] System now respects fallback='none' setting (lines 346-369)
- [x] Added conditional check to prevent adding additional providers when fallback disabled
- [x] Added comprehensive provider selection logging
- [x] Created HTTP fetch allowlist in devvit.yaml for AI provider domains
- [x] Added domains: api.anthropic.com, api.openai.com, api.z.ai, *.groq.com, *.together.ai
- [x] Tested z.ai endpoint (confirmed connection works, insufficient balance error properly logged)
- [x] Updated to version 0.1.56
- [x] Committed and pushed changes (f1dd2b1)

### Phase 5.40 (2025-10-29)
- [x] Fixed case sensitivity bug in configManager.ts (openaiCompatibleBaseURL)
- [x] Changed lowercase 'openaiCompatibleBaseUrl' to proper case 'openaiCompatibleBaseURL' on lines 120, 124
- [x] Removed all deepseek references from codebase per updated requirements
- [x] Removed deepseek provider from AI_CONFIG in config/ai.ts
- [x] Removed deepseek merging logic from configManager.ts
- [x] Removed deepseekApiKey from settingsService.ts
- [x] Removed DeepSeekProvider import from selector.ts
- [x] Updated provider type annotations to only support: 'claude' | 'openai' | 'openai-compatible'
- [x] Updated to version 0.1.55
- [x] Committed and pushed changes (cb771a2)

### Phase 5.39 (2025-10-29)
- [x] Fixed openai-compatible provider support (z.ai, Groq, Together AI, etc.)
- [x] Added openai-compatible provider creation in ConfigurationManager
- [x] Provider enabled when both API key and base URL configured
- [x] Added comprehensive debug logging for provider selection
- [x] Logs available providers, primary/fallback selections, API key status
- [x] Added null checks to prevent "Cannot read properties of undefined" crash
- [x] Warnings when requested provider not found in configuration
- [x] Updated to version 0.1.54

### Phase 5.38 (2025-10-29)
- [x] Enhanced "Reset Community Trust Scores" menu to clear ALL caches
- [x] Now deletes profile caches (`user:{userId}:profile`)
- [x] Now deletes history caches (`user:{userId}:history`)
- [x] Complete reset for testing: trust scores, tracking, profiles, histories
- [x] Updated toast message shows all deletion counts
- [x] Updated to version 0.1.53

### Phase 5.37 (2025-10-29)
- [x] Fixed email verification to read `hasVerifiedEmail` field from Devvit User API
- [x] Changed from hardcoded `false` to `user.hasVerifiedEmail ?? false`
- [x] Fixed post/comment fetching to use separate API calls
- [x] Now uses `getPostsByUser()` and `getCommentsByUser()` separately
- [x] Ensures balanced data: up to 100 posts AND 100 comments (instead of 200 total items that could be skewed)
- [x] Changed README status badge from "Production Ready" to "Alpha"
- [x] Updated to version 0.1.52

### Phase 5.36 (2025-10-29)
- [x] Added enhanced logging to verify data access scope (site-wide vs subreddit-scoped)
- [x] Added detailed subreddit diversity logging in historyAnalyzer.ts
- [x] Improved error handling for private/hidden user profiles
- [x] Added comprehensive Data Access & Privacy section to README.md
- [x] Updated to version 0.1.50

### Phase 5.35 (2025-10-29)
- [x] Created OpenAI Compatible provider implementation (openaiCompatible.ts)
- [x] Supports custom OpenAI-compatible endpoints (Groq, Together AI, Z.AI, self-hosted vLLM/Ollama)
- [x] Configurable base URL, API key, and model name via settings
- [x] Added to provider selector as last-resort fallback
- [x] Implements full IAIProvider interface with analyzeWithQuestions support
- [x] Added settings UI fields for configuration
- [x] Updated to version 0.1.49

### Phases 5.32-5.34 (2025-10-29)
- [x] Created userCache.ts helper with approved users and moderators caching
- [x] Skip processing for approved users (explicit subreddit approval)
- [x] Skip processing for moderators (don't moderate the moderators)
- [x] Use getAppUser() for bot detection instead of Redis comment tracking
- [x] Remove comment ID tracking code from executor.ts and commentSubmit.ts
- [x] 5-minute cache TTL for user lists to reduce API calls
- [x] Graceful degradation on API failures

### Phase 5.31 (2025-10-29)
- [x] Fixed Layer 3 REMOVE action order - now posts comment before removing
- [x] Ensures users can see explanation before content disappears
- [x] Updated documentation with git commit info

### Phase 5.30 (2025-10-29)
- [x] Added trust score delta logging in ModAction handler
- [x] Shows trust score change in ModAction modmail notifications

### Phase 5.29 (2025-10-28)
- [x] Improved notification format with trust score display
- [x] Cleaner dry-run indicator in notifications
- [x] Version 0.1.45 deployed

### Phase 5.28 (2025-10-28)
- [x] Removed per-RuleSet dry-run field
- [x] Global dry-run mode configuration at Layer 3 level
- [x] Simplified configuration structure

### Phase 5.27 (2025-10-27)
- [x] Added comprehensive AI debug logging
- [x] Logs sanitized post content and AI reasoning

### Phase 5.26 (2025-10-27)
- [x] Provider selection improvements
- [x] Fixed OpenAI question support
- [x] Better error handling for provider switching

### Phase 5.25 (2025-10-27)
- [x] Expanded post history to 100+100 (200 total items)
- [x] Content sanitization improvements
- [x] Reduced token costs by 40-60%

### Phase 5.24 (2025-10-27)
- [x] Added OpenAI provider support
- [x] Multi-provider architecture (Claude/OpenAI/DeepSeek)
- [x] Provider selection in Layer 1 settings

### Phase 5.23 (2025-10-27)
- [x] Added DeepSeek AI provider support
- [x] Cost optimization with cheaper provider option
- [x] Provider fallback system

### Phases 1-4 Complete ✅
- **Phase 1**: Foundation & Setup (Devvit app, Redis, event handlers)
- **Phase 2**: AI Integration (Claude API, content sanitization, validation)
- **Phase 3**: Rules Engine (3-layer architecture, trust scoring, actions)
- **Phase 4**: Settings UI (Layer 1/2/3 configuration forms)

See [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md) for complete version history.

---

## Next Steps

### Future Enhancements

- **Performance Optimizations**
  - Further Redis caching improvements
  - Batch processing for multiple posts
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

**2025-10-29**: Added X.AI (Grok) to HTTP fetch allowlist and verified functionality
- **Rationale**: User requested testing Grok API as alternative OpenAI-compatible provider. Initial test with grok-beta model revealed deprecation, switched to grok-3 successfully.
- **Impact**: Confirmed Grok API working, provides additional OpenAI-compatible option for users seeking alternatives to z.ai, Groq, or Together AI.
- **Implementation**: Added 'api.x.ai' to devvit.yaml HTTP fetch allowList. Tested with endpoint https://api.x.ai/v1 and model grok-3, confirmed successful responses.

**2025-10-29**: Enhanced error logging in OpenAI-compatible provider
- **Rationale**: User requested "pick up the error: {} and report it in the logs" after seeing generic "Connection error" messages without API error details. Detailed error information critical for debugging provider-specific issues.
- **Impact**: Error logs now show complete API error responses including status codes, error codes, and full error messages. Makes debugging provider issues much easier.
- **Implementation**: Enhanced error logging in openaiCompatible.ts to extract and log status, code, response, apiError, and fullMessage fields from error objects in analyze(), analyzeWithQuestions(), and healthCheck() methods.

**2025-10-29**: Fixed fallback provider logic respecting 'none' setting
- **Rationale**: Critical bug where system ignored fallback='none' setting and still called OpenAI as fallback. User reported "it's going on and calling openai anyway - even though the setting say no fallback."
- **Impact**: System now correctly respects user's fallback preference. When fallback='none', only the primary provider is used - no automatic fallback to other enabled providers.
- **Implementation**: Modified getEnabledProviders() in src/config/ai.ts (lines 346-369) to only add additional providers when aiSettings.fallbackProvider !== 'none'. Added comprehensive logging for provider selection process.

**2025-10-29**: Created HTTP fetch allowlist for AI provider domains
- **Rationale**: Devvit platform requires explicit domain allowlisting for external API calls. Z.ai endpoint connection was failing due to missing allowlist configuration.
- **Impact**: All AI provider domains now accessible, enables use of Claude, OpenAI, and multiple OpenAI-compatible providers (z.ai, Groq, Together AI, X.AI).
- **Implementation**: Added http.fetch.allowList section to devvit.yaml with domains: api.anthropic.com, api.openai.com, api.z.ai, api.x.ai, *.groq.com, *.together.ai.

**2025-10-29**: Fixed openaiCompatibleBaseURL case sensitivity and removed deepseek
- **Rationale**: Case sensitivity mismatch prevented OpenAI-compatible provider from being enabled. Deepseek support no longer needed per updated requirements - only supporting Claude, OpenAI, and OpenAI-Compatible providers.
- **Impact**: OpenAI-compatible providers (z.ai, Groq, Together AI) now properly detected and enabled. Cleaner codebase with only three supported provider types.
- **Implementation**: Changed 'openaiCompatibleBaseUrl' to 'openaiCompatibleBaseURL' in configManager.ts (lines 120, 124). Removed deepseek provider configuration from AI_CONFIG, removed deepseek from ConfigurationManager merging logic, removed deepseekApiKey from settingsService.ts, removed DeepSeekProvider import from selector.ts. Updated all type annotations to reflect three-provider architecture.

**2025-10-29**: OpenAI-compatible provider support with debug logging
- **Rationale**: Enable support for alternative OpenAI-compatible providers (z.ai, Groq, Together AI, self-hosted) when selected as primary provider. Previous implementation crashed when openai-compatible was selected because ConfigurationManager didn't create the provider config.
- **Impact**: Users can now use any OpenAI-compatible endpoint, comprehensive debug logging aids troubleshooting, better error handling prevents crashes
- **Implementation**: Added openai-compatible provider creation in ConfigurationManager (enabled when both API key and base URL configured), null checks in getEnabledProviders(), detailed logging for provider selection diagnostics

**2025-10-29**: Enhanced reset menu to clear all user caches
- **Rationale**: Reset menu only cleared trust scores and tracking records, but profile and history caches persisted causing "cache hits" during testing
- **Impact**: Complete reset for testing scenarios, all user data cleared (trust, tracking, profiles, histories)
- **Implementation**: Delete profile caches (`user:{userId}:profile`) and history caches (`user:{userId}:history`) in addition to existing trust/tracking deletion

**2025-10-29**: Fixed email verification and separated post/comment fetching
- **Rationale**: Email verification was always showing as `false` because it was hardcoded. Post/comment fetching was skewed towards whichever type the user had more of (e.g., 176 comments + 24 posts = 200 total).
- **Impact**: More accurate user profiling, better AI analysis context, email verification now reflects actual user status
- **Implementation**: Read `hasVerifiedEmail` field from Devvit User API, use separate `getPostsByUser()` and `getCommentsByUser()` calls to ensure balanced data (up to 100 of each)

**2025-10-29**: Enhanced logging and private profile handling
- **Rationale**: Verify data access scope (site-wide vs subreddit-only), better diagnose API issues
- **Impact**: Clear visibility into whether we're accessing all subreddits or just the installed one
- **Implementation**: Logs subreddit diversity, warns on single subreddit (potential scope issue), handles private profiles gracefully

**2025-10-29**: OpenAI Compatible provider for custom endpoints
- **Rationale**: Enable use of alternative OpenAI-compatible providers (Groq, Together AI, self-hosted models)
- **Impact**: More flexibility for users, cost optimization options, local deployment support
- **Implementation**: Acts as last-resort fallback after standard providers, fully configurable via settings

**2025-10-29**: Skip processing for approved users and moderators with caching
- **Rationale**: Approved users and moderators don't need moderation, reduces API calls and processing overhead
- **Impact**: Improved performance, reduced costs, better user experience for trusted users
- **Implementation**: 5-minute in-memory cache for user lists, graceful degradation on API failures

**2025-10-29**: Replace Redis comment tracking with getAppUser() check
- **Rationale**: Simpler, more reliable bot detection using Devvit's built-in API
- **Impact**: Cleaner code, less Redis overhead, more maintainable

**2025-10-29**: Swap Layer 3 REMOVE action order to post comment first, then remove
- **Rationale**: Ensures users can see explanation before content disappears
- **Impact**: Better user experience, more transparent moderation

**2025-10-28**: Remove per-RuleSet dry-run configuration
- **Rationale**: Simplified to global dry-run mode at Layer 3 level
- **Impact**: Cleaner configuration, easier testing

**2025-10-27**: Expand post history to 200 items (100 posts + 100 comments)
- **Rationale**: Provides better context for AI analysis
- **Impact**: More accurate profiling, content sanitization reduces token costs by 40-60%

**2025-10-27**: Multi-provider AI architecture (Claude/OpenAI/DeepSeek)
- **Rationale**: Cost optimization and provider flexibility
- **Impact**: Users can choose based on budget/accuracy trade-offs

---

## Known Issues

### Cache Invalidation System (Priority: High) - DESIGN APPROVED

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

### Key Design Principles

1. **Version Prefix** - Enables instant cache invalidation
   - Change v1 → v2, all old keys automatically ignored
   - No migration needed, old keys expire naturally via TTL

2. **Hierarchical Organization**
   - User data under `v1:user:{userId}:*`
   - Global data under `v1:global:*`
   - Easy to clear all data for a user

3. **Dictionary Storage** - Multi-value data in single key
   - Trust scores for all subreddits: `v1:user:{userId}:trust`
   - No need to know which subreddits exist
   - Single Redis operation to clear

4. **Tracking Sets** - For dynamic/unknown keys
   - AI questions use tracking set: `v1:user:{userId}:ai:questions:keys`
   - Contains list of hashes to delete
   - Hierarchical: tracking key lives with data

### Implementation Components

**1. Centralized Key Builder Service**
```typescript
// src/storage/keyBuilder.ts
const CACHE_VERSION = 1;

function buildKey(scope: 'user' | 'global', userId: string | null, ...parts: string[]): string {
  if (scope === 'user' && userId) {
    return `v${CACHE_VERSION}:user:${userId}:${parts.join(':')}`;
  }
  return `v${CACHE_VERSION}:global:${parts.join(':')}`;
}
```

**2. Clear User Cache Function**
```typescript
async function clearUserCache(userId: string) {
  // Clear AI questions (with tracking set)
  const aiKeysSet = buildKey('user', userId, 'ai', 'questions', 'keys');
  const aiHashes = await redis.sMembers(aiKeysSet);
  for (const hash of aiHashes) {
    await redis.del(buildKey('user', userId, 'ai', 'questions', hash));
  }
  await redis.del(aiKeysSet);

  // Clear dictionary keys (no iteration needed)
  await redis.del(buildKey('user', userId, 'profile'));
  await redis.del(buildKey('user', userId, 'history'));
  await redis.del(buildKey('user', userId, 'trust'));
  await redis.del(buildKey('user', userId, 'tracking'));
}
```

**3. Version Bump Process**
```
When breaking change occurs:
1. Change CACHE_VERSION from 1 to 2
2. All code now uses v2:* keys
3. Old v1:* keys ignored automatically
4. Old keys expire via TTL (24-48h)
```

**4. Reset All Data (Enhanced)**
```typescript
async function resetAllData(subreddit: string) {
  // Get all tracked users
  const trackingKey = buildKey('global', null, 'tracking', subreddit, 'users');
  const userIds = await redis.sMembers(trackingKey);

  // Clear each user's cache
  for (const userId of userIds) {
    await clearUserCache(userId);
  }

  // Clear global tracking
  await redis.del(trackingKey);

  // Optionally clear cost data
  // (TBD: preserve for auditing?)
}
```

### Migration Path

1. Create centralized key builder service
2. Add helper functions for common operations
3. Migrate existing code incrementally:
   - Profile fetcher
   - History analyzer
   - AI analyzer
   - Trust manager
   - Cost tracker
4. Update "Reset All Data" menu action
5. Add "Clear User Cache" menu action (post/comment)
6. Test all scenarios

### Benefits

✅ **Testing**: Complete data wipe via enhanced "Reset All Data"
✅ **Version Bump**: Instant cache invalidation (v1→v2)
✅ **Per-User Clear**: Simple function, no SCAN needed
✅ **Maintainable**: Single source of truth for all keys
✅ **Future-proof**: Easy to add new cache types
✅ **No Breaking Changes**: Old keys expire naturally

---

## Development Workflow

For development practices and workflow, see [CLAUDE.md](/home/cdm/redditmod/CLAUDE.md).
For complete version history, see [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md).

---

## Quick Stats

- **Total Versions**: 58 (0.0.1 → 0.1.58)
- **Current Trust System**: Working perfectly in production
- **AI Providers**: Claude 3.5 Haiku, OpenAI, OpenAI-Compatible (z.ai, Groq, Together AI, X.AI/Grok)
- **Active Subreddits**: 3 target communities
- **Core Features**: 100% complete
- **Test Coverage**: Comprehensive (93 tests for content sanitizer alone)
- **Provider Fallback**: Fixed - respects 'none' setting correctly
- **Error Logging**: Enhanced - captures full API error details
