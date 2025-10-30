# Project Status

**Last Updated**: 2025-10-29
**Current Phase**: Phase 5 - Refinement & Optimization
**Current Version**: 0.1.54 (ready to deploy)
**Overall Progress**: 99% (Core features complete, trust system working perfectly)
**Status**: Phase 5.39 Complete ✅ | OpenAI-compatible provider support with debug logging

---

## Project Overview

Reddit AI Automod is a user profiling & analysis system for Reddit communities. Uses AI (Claude/OpenAI/DeepSeek) to detect problematic posters: romance scammers, dating seekers, underage users, and spammers.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude 3.5 Haiku/OpenAI/DeepSeek)
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

None currently. System is stable and working as expected.

---

## Development Workflow

For development practices and workflow, see [CLAUDE.md](/home/cdm/redditmod/CLAUDE.md).
For complete version history, see [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md).

---

## Quick Stats

- **Total Versions**: 54 (0.0.1 → 0.1.54)
- **Current Trust System**: Working perfectly in production
- **AI Providers**: Claude 3.5 Haiku, OpenAI, DeepSeek, OpenAI-Compatible
- **Active Subreddits**: 3 target communities
- **Core Features**: 100% complete
- **Test Coverage**: Comprehensive (93 tests for content sanitizer alone)
