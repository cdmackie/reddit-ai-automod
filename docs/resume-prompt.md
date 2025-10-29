# Resume Prompt

## Quick Context

Reddit AI Automod is a Devvit-based user profiling & analysis system that uses AI (Claude 3.5 Haiku, OpenAI gpt-4o-mini, or DeepSeek V3) to detect problematic posters in Reddit communities: romance scammers, dating seekers, underage users, and spammers.

**Stack**: Reddit Devvit (TypeScript), Redis, AI (Claude/OpenAI/DeepSeek)
**Current Phase**: Phase 5 - Refinement & Optimization
**Current Version**: 0.1.47 (deployed to Reddit)
**Target Subreddits**: r/FriendsOver40, r/FriendsOver50, r/bitcointaxes

---

## Current State

### What Works ✅
- **3-Layer Pipeline**:
  - Layer 1: Trust Score filtering (0-100 score based on account age, karma, history)
  - Layer 2: OpenAI Moderation API (detects harmful content)
  - Layer 3: Custom Rules with AI questions (JSON-configurable)
- **User Profiling**: Analyzes 200 posts/comments (100+100) from user's history
- **AI Integration**: Multi-provider failover (Claude → OpenAI → DeepSeek)
- **Cost Controls**: Daily budgets, trust score caching, request deduplication
- **Settings UI**: Complete Devvit forms for all configuration
- **Whitelist**: Skip analysis for trusted users
- **Community Trust**: Automatically whitelist users with good trust scores

### Last Completed (Phase 5.31 - 2025-10-29)
- Fixed Layer 3 REMOVE action to post comment before removing post/comment
- This ensures users see the explanation before content disappears

---

## What's Next

### Immediate Priorities (Phase 5.32-5.35)

**Phase 5.32**: Skip Approved Users
- Call `getApprovedUsers()` at start of processing
- Cache list for 5 minutes
- Skip all layers if user is approved
- Reduces API costs for trusted contributors

**Phase 5.33**: Use getAppUser() for Bot Detection
- Replace comment ID tracking with `getAppUser()` check
- Simpler, more reliable bot detection
- Clean up Redis comment ID storage

**Phase 5.34**: Skip Moderators
- Call `getModerators()` at start of processing
- Cache list for 5 minutes (reuse cache from 5.32)
- Skip all layers if user is moderator

**Phase 5.35**: OpenAI Compatible Provider
- Add new provider type supporting custom endpoints
- Enable use of Groq, Z.AI, self-hosted models, etc.
- Settings: custom endpoint URL, API key, model name

---

## Important Decisions

**Architecture Change (2025-10-25)**:
- Pivoted from generic rule engine to user profiling system
- Focus on analyzing new posters, not just content
- Better fit for actual use case (scammer detection)

**3-Layer Pipeline (2025-10-27)**:
- Layer 1 (Trust Score): Fast, cheap filtering
- Layer 2 (OpenAI Mod): Catches harmful content
- Layer 3 (Custom Rules): Flexible AI-powered rules
- Each layer can be enabled/disabled independently

**Post History Expansion (2025-10-27)**:
- Increased from 20 to 200 items (100 posts + 100 comments)
- Better AI analysis context
- Content sanitization keeps costs manageable (40-60% reduction)

---

## Key Files

### Core Application
- `src/main.ts` - Entry point, event handler registration
- `src/handlers/postSubmit.ts` - Post processing pipeline
- `src/handlers/commentSubmit.ts` - Comment processing pipeline

### Pipeline Layers
- `src/pipeline/layer1.ts` - Trust score filtering
- `src/pipeline/layer2.ts` - OpenAI Moderation
- `src/pipeline/layer3.ts` - Custom rules processor

### AI System
- `src/ai/analyzer.ts` - Main AI orchestrator
- `src/ai/providers/claude.ts` - Claude 3.5 Haiku
- `src/ai/providers/openai.ts` - OpenAI GPT-4o Mini
- `src/ai/providers/deepseek.ts` - DeepSeek V3

### User Profiling
- `src/profile/fetcher.ts` - Fetch user data
- `src/profile/historyAnalyzer.ts` - Analyze post history
- `src/profile/trustScore.ts` - Calculate trust scores

### Settings & Configuration
- `src/config/settingsService.ts` - Settings management
- `src/ui/forms/` - Devvit settings forms

### Storage
- `src/storage/redis.ts` - Redis operations
- `src/storage/audit.ts` - Audit logging

---

## Quick Start Commands

```bash
# Build and deploy to Reddit
devvit upload

# View logs
devvit logs r/AiAutomod

# Install to subreddit
# Go to https://developers.reddit.com/apps/ai-automod-app
# Click "Install" and select subreddit
```

---

## Architecture Summary

**Flow**: Post/Comment Event → Bot Check → Whitelist Check → Layer 1 (Trust) → Layer 2 (Moderation) → Layer 3 (Custom Rules) → Action (APPROVE/FLAG/REMOVE/COMMENT)

**Data Sources**:
- Reddit API: User profile, post history
- Redis: Caching, audit logs, settings
- AI Providers: Analysis and moderation

**Cost Optimization**:
- Trust score caching (12-48h based on score)
- Request deduplication (prevent duplicate AI calls)
- Budget enforcement (daily limits)
- Provider failover (use cheapest available)

---

## For Full History

See [CHANGELOG.md](/home/cdm/redditmod/CHANGELOG.md) for complete version history and [project-status.md](/home/cdm/redditmod/docs/project-status.md) for current status.
