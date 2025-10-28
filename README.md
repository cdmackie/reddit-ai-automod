# Reddit AI Automod

> **Intelligent User Profiling & Moderation for Reddit Communities**

A Reddit Devvit app that uses AI to analyze new posters and detect problematic users before they cause harm. Built for moderators who want to protect their communities from romance scammers, dating seekers, underage users, and spammers.

[![Tests](https://img.shields.io/badge/tests-169%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen)]()
[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
[![Progress](https://img.shields.io/badge/progress-99%25-brightgreen)]()

---

## 🎯 What It Does

Instead of waiting for bad actors to post harmful content, this app **proactively analyzes new users** when they make their first post or comment. It examines:

- **User Profile**: Account age, karma, email verification status
- **Post History**: Last 20 posts/comments from ALL subreddits
- **AI Analysis**: Custom questions you define (e.g., "Does this user appear to be seeking dates?")

Based on configurable rules, the app can:
- **FLAG**: Report to mod queue for human review
- **REMOVE**: Remove post and leave an explanatory comment
- **COMMENT**: Warn user without removing post
- **APPROVE**: Allow post (default for trusted users)

---

## 🚀 Current Status

**Version 0.1.0** (99% to MVP) - Production Ready

| Component | Status | Details |
|-----------|--------|---------|
| Foundation & Event Handlers | ✅ Complete | PostSubmit, CommentSubmit handlers operational |
| User Profiling System | ✅ Complete | Profile fetching, history analysis, trust scoring (0-100) |
| AI Integration | ✅ Complete | Claude 3.5 Haiku, OpenAI GPT-4o Mini, DeepSeek V3 providers |
| Rules Engine | ✅ Complete | HardRule + AIRule evaluation, priority-based execution |
| Content Type Filtering | ✅ Complete | Separate rules for posts, comments, or both |
| Rules Integration | ✅ Complete | Full rules engine for posts AND comments |
| Action Executors | ✅ Complete | FLAG, REMOVE, COMMENT actions with dry-run mode |
| Settings UI | ✅ Complete | Full configuration via Devvit settings |
| Cost Dashboard | ✅ Complete | Real-time cost tracking and budget monitoring |
| Real-time Notifications | ✅ Complete | Instant PM/modmail after each action |
| Production Testing | ✅ Complete | Tested on r/AiAutomod with posts and comments |

**Test Results**: 169 tests passing, 90%+ coverage on critical paths
**Production Code**: ~12,700 lines TypeScript
**Security**: 13 security tests passing (ReDoS, Redis injection, field access controls)
**Ready for**: Production deployment to target subreddits

---

## ✨ Key Features

### 🛡️ User Profiling & Trust Scoring
- Analyzes account age, karma (split by post/comment), email verification
- Fetches last 20 posts/comments from ALL subreddits (not just yours)
- Calculates 0-100 trust score to bypass expensive AI analysis for returning good users
- Caching system reduces API calls and costs (24-48h TTL)

### 🤖 Multi-Provider AI Strategy
- **Primary**: Claude 3.5 Haiku (~$0.05-0.08/analysis) - Best quality
- **Secondary**: DeepSeek V3 (~$0.02-0.03/analysis) - Low-cost option
- **Fallback**: OpenAI GPT-4o Mini (~$0.10-0.12/analysis) - Proven reliability
- Automatic failover if provider is down (circuit breakers)
- Cost tracking with daily budget limits ($5/day default)

### 📋 Configurable Rules System

**Two Rule Types**:

1. **HardRule**: Fast, deterministic checks (no AI needed)
   - Account age, karma thresholds
   - Post content matching (text, regex, URLs, domains)
   - Field comparisons (`<`, `>`, `==`, `contains`, `in`, etc.)

2. **AIRule**: Custom AI questions in natural language
   - You write the questions (e.g., "Is this user seeking romantic connections?")
   - AI answers: YES/NO/MAYBE with confidence 0-100
   - Set confidence thresholds (e.g., >80% = REMOVE, 60-80% = FLAG)

**Rule Features**:
- **Content Type Filtering**: Specify if rule applies to posts, comments, or both
- Priority-based execution (highest priority first)
- Nested AND/OR condition logic
- Variable substitution in messages (`{username}`, `{confidence}`, `{reason}`)
- Dry-run mode for safe testing
- Per-subreddit + global rules

### 💰 Cost Control
- Daily budget limits with real-time tracking
- Per-provider cost monitoring
- Alerts at 50%, 75%, 90% of budget
- Aggressive caching (24h TTL for user analysis)
- Trust score system (skip AI for trusted users → ~50% cost reduction)

**Estimated Costs**: $15-25/month for 3 subreddits (~20 new users/day)

### 🔒 Security & Privacy
- Only analyzes public Reddit data (no private info)
- PII sanitization before sending to AI (removes emails, phones, SSNs, credit cards)
- Redis injection prevention
- ReDoS protection in regex evaluation
- Field access whitelist (no arbitrary code execution)
- Complete audit logging with correlation IDs

---

## 🎓 How to Write Rules

### Example 1: HardRule - New Account with External Link

```json
{
  "id": "new-account-spam",
  "type": "hard",
  "priority": 100,
  "contentType": "submission",
  "conditions": {
    "operator": "AND",
    "conditions": [
      {
        "field": "profile.accountAgeDays",
        "operator": "<",
        "value": 7
      },
      {
        "field": "profile.totalKarma",
        "operator": "<",
        "value": 50
      },
      {
        "field": "currentPost.urls",
        "operator": "in",
        "value": [".*"]
      }
    ]
  },
  "action": "FLAG",
  "message": "New account ({profile.accountAgeDays} days old) posting links. Please review.",
  "notifyMods": true
}
```

### Example 2: AIRule - Dating Intent Detection (Posts Only)

```json
{
  "id": "dating-seeker",
  "type": "ai",
  "priority": 90,
  "contentType": "submission",
  "aiQuestions": [
    {
      "id": "dating-intent",
      "question": "Based on this user's post history, are they seeking romantic or dating connections? Answer YES if they mention dating, relationships, looking for partners, or romantic interest. Answer NO if they're just making friends platonically."
    }
  ],
  "conditions": {
    "field": "aiAnalysis.answers.dating-intent.answer",
    "operator": "==",
    "value": "YES"
  },
  "confidenceThreshold": 80,
  "action": "REMOVE",
  "message": "This subreddit is for platonic friendships only. Posts seeking romantic connections are not allowed.",
  "notifyMods": true
}
```

### Example 3: HardRule - Spam Links in Comments

```json
{
  "id": "comment-spam-links",
  "type": "hard",
  "priority": 95,
  "contentType": "comment",
  "conditions": {
    "operator": "AND",
    "conditions": [
      {
        "field": "profile.accountAgeDays",
        "operator": "<",
        "value": 3
      },
      {
        "field": "currentPost.urls",
        "operator": "in",
        "value": [".*"]
      }
    ]
  },
  "action": "REMOVE",
  "message": "New accounts cannot post links in comments. Please build karma first.",
  "notifyMods": false
}
```

### Content Type Field

The `contentType` field determines where a rule applies:
- `"submission"` or `"post"` - Only on posts (default if omitted)
- `"comment"` - Only on comments
- `"any"` - Both posts and comments

**Cost Optimization**: Use contentType to avoid expensive AI analysis on content you don't need to check. For example, if you only need to detect dating intent in posts, set `contentType: "submission"` to skip AI calls for comments entirely.

### Available Fields

**Profile Fields**:
- `profile.accountAgeDays` - Account age in days
- `profile.totalKarma` - Total karma (comment + post)
- `profile.commentKarma` - Comment karma only
- `profile.postKarma` - Post karma only
- `profile.isEmailVerified` - Email verification status
- `profile.hasPremium` - Reddit Premium status
- `profile.totalPosts` - Total posts across Reddit
- `profile.totalComments` - Total comments across Reddit
- `profile.subreddits` - Array of subreddit names user has posted in

**Current Post Fields**:
- `currentPost.title` - Post title
- `currentPost.body` - Post body text
- `currentPost.type` - Post type: text, link, image, video, gallery
- `currentPost.urls` - Array of URLs in post
- `currentPost.domains` - Array of domains extracted from URLs
- `currentPost.wordCount` - Number of words in title + body
- `currentPost.characterCount` - Number of characters

**Trust Score Fields**:
- `trustScore.score` - Trust score (0-100)
- `trustScore.isTrusted` - Boolean, true if score > threshold

**AI Analysis Fields** (only when AI rules are evaluated):
- `aiAnalysis.answers.{questionId}.answer` - AI's answer (YES/NO/MAYBE)
- `aiAnalysis.answers.{questionId}.confidence` - Confidence score (0-100)
- `aiAnalysis.answers.{questionId}.reasoning` - AI's explanation

### Operators

**Comparison**: `<`, `>`, `<=`, `>=`, `==`, `!=`
**Text**: `contains`, `contains_i` (case-insensitive), `regex`, `regex_i`
**Array**: `in` (checks if value matches any array element)
**Logical**: `AND`, `OR` (for nested conditions)

### Actions

- `APPROVE` - Allow post (skip remaining rules)
- `FLAG` - Report to mod queue for human review
- `REMOVE` - Remove post + leave auto-comment
- `COMMENT` - Add warning comment without removing

---

## 🏗️ Architecture

### Tech Stack
- **Platform**: Reddit Devvit (TypeScript)
- **Runtime**: Reddit-hosted (serverless)
- **Storage**: Redis (provided by Devvit, free)
- **AI Providers**: Anthropic Claude, OpenAI, DeepSeek
- **Testing**: Jest (169 tests)

### System Flow

```
New post submitted
  ↓
1. Trust Check: Is user trusted? (Redis lookup)
   YES → Approve immediately ✅
   NO  → Continue ↓

2. Cache Check: Recent analysis? (last 24h)
   YES → Use cached result, skip to step 5
   NO  → Continue ↓

3. Fetch Profile + History
   - Account age, karma, verification
   - Last 20 posts/comments (ALL subs)
   - Cache both (24h TTL)

4. Evaluate Rules (priority order)
   - Hard rules first (fast)
   - AI rules if needed (aggregate questions)
   - Call AI with all questions at once (batch efficiency)
   - Cache AI result (24h TTL)

5. Execute Action
   - APPROVE (default if no rules match)
   - FLAG (report to mod queue)
   - REMOVE (remove + comment)
   - COMMENT (warn user)

6. Update Trust Score
   - Approved posts increase score
   - If score > 70 → mark as "trusted"

7. Audit Log
   - Action taken, reason, cost, execution time
```

### Default Rule Sets

**Included for Target Subreddits**:
- **r/FriendsOver40**: 6 rules (dating detection, scammer patterns, age verification)
- **r/FriendsOver50**: 5 rules (dating detection, scammer patterns, age verification)
- **r/bitcointaxes**: 4 rules (spam detection, off-topic filtering, low-effort posts)
- **Global**: 1 rule (new accounts with external links)

---

## 📚 Documentation

### For Moderators
- **How to Write Rules**: See examples above and `docs/rule-writing-guide.md` (coming soon)
- **Cost Management**: `docs/cost-management.md` (coming soon)
- **Privacy & Safety**: Only public Reddit data is analyzed. No private messages or restricted content.

### For Developers
- **Development Workflow**: [`CLAUDE.md`](./CLAUDE.md) - Mandatory 9-step workflow for all changes
- **Architecture Design**: [`docs/architecture.md`](./docs/architecture.md)
- **Implementation Plan**: [`docs/implementation-plan.md`](./docs/implementation-plan.md)
- **Project Status**: [`docs/project-status.md`](./docs/project-status.md)
- **Session Recovery**: [`docs/resume-prompt.md`](./docs/resume-prompt.md)

### API Documentation
- **AI System**: `src/ai/README.md` - Multi-provider AI integration
- **Rules Engine**: `src/rules/README.md` - Rule evaluation and storage
- **Profile System**: `src/profile/README.md` - User profiling and trust scoring

---

## 🚀 Quick Start (For Developers)

### Prerequisites
- Node.js v20.19.5 or higher
- Reddit account with moderator permissions
- Devvit CLI v0.12.1

### Installation

```bash
# Clone repository
git clone https://github.com/cdmackie/reddit-ai-automod.git
cd reddit-ai-automod

# Install dependencies
npm install

# Install Devvit CLI globally
npm install -g devvit

# Login to Devvit
devvit login

# Start development server
devvit playtest r/YourTestSubreddit
```

### Configuration

1. Create a private test subreddit
2. Install the app in your test subreddit
3. Configure settings in app settings panel:
   - AI provider API keys (Claude/OpenAI/DeepSeek)
   - Daily budget limit (default: $5)
   - Dry-run mode (recommended for testing)

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test src/rules/__tests__/engine.test.ts

# Check test coverage
npm run test:coverage
```

---

## 📈 Roadmap

### ✅ Phase 1: Foundation & User Profiling (Complete)
- Event handlers for posts/comments
- Redis storage and audit logging
- User profile fetching with caching
- Post history analysis
- Trust score system (0-100)

### ✅ Phase 2: AI Integration (Complete)
- Multi-provider support (Claude, OpenAI, DeepSeek)
- Circuit breakers and health checks
- Cost tracking with budget enforcement
- PII sanitization
- Request deduplication
- Response validation (Zod schemas)
- Differential caching (24-48h TTL)
- Custom AI questions support

### ✅ Phase 3: Rules Engine & Actions (Complete)
- HardRule and AIRule type system
- Condition evaluator (all Reddit AutoMod operators)
- Variable substitution
- Redis storage with priority-based execution
- Default rule sets for 3 target subreddits
- Security hardening (ReDoS, Redis injection prevention)
- **Content type filtering** (posts, comments, both)
- PostSubmit and CommentSubmit handler integration
- FLAG, REMOVE, COMMENT action executors
- Dry-run mode support

### ✅ Phase 4: Settings & Monitoring (Complete)
- Devvit Settings UI with 14 configuration fields
- Rule management with JSON schema validation
- Cost dashboard with real-time tracking
- Budget limits and alert thresholds
- Default rules auto-initialization
- **Real-time digest** (PM/modmail notifications)
- Full settings integration with ConfigurationManager

### ⏳ Phase 5: Production Deployment (Ready)
- ✅ Complete system testing on r/AiAutomod
- ⏳ Deploy to r/FriendsOver40 (dry-run mode)
- ⏳ Deploy to r/FriendsOver50 (dry-run mode)
- ⏳ Deploy to r/bitcointaxes (dry-run mode)
- ⏳ Monitor for 24-48 hours
- ⏳ Disable dry-run mode after validation
- ⏳ Public release announcement

---

## 💡 Use Cases

### FriendsOver40/50 Communities
**Problem**: Romance scammers, dating seekers, and underage users targeting vulnerable adults
**Solution**: AI detects dating intent, scammer patterns, and age inconsistencies
**Rules**: 6 HardRules + 3 AIRules with confidence thresholds

### r/bitcointaxes
**Problem**: Spam, off-topic posts, low-effort tax questions
**Solution**: Content analysis and keyword filtering
**Rules**: 4 HardRules for spam/quality filtering

---

## 🔒 Security & Privacy

### What We Access (All Public Data)
- ✅ User account age, karma, email verification status
- ✅ Last 20 posts/comments from ALL subreddits
- ✅ Post/comment content text
- ❌ Private messages (NOT accessed)
- ❌ Restricted/quarantined subreddit content (NOT accessed)

### How We Protect Privacy
- PII sanitization before AI analysis (removes emails, phones, SSNs, credit cards, URLs)
- No data shared with third parties (except AI providers for analysis)
- API keys encrypted in Devvit settings
- Complete audit logging with correlation IDs
- Compliance with Reddit API Terms of Service

### Security Measures
- Redis injection prevention (key sanitization)
- ReDoS protection (regex validation, pattern limits)
- Field access whitelist (no arbitrary code execution)
- Prototype pollution prevention
- Input validation on all user-provided data
- Rate limiting with exponential backoff
- Circuit breakers to prevent cascading failures

---

## 📊 Performance & Costs

### Response Times
- **Trusted User**: <100ms (Redis lookup only)
- **Cached Analysis**: <200ms (Redis lookup + rule evaluation)
- **Full Analysis**: 1-3 seconds (profile fetch + AI analysis + rule evaluation)

### Cost Breakdown (20 users/day, 3 subreddits)
| Item | Cost |
|------|------|
| Devvit Hosting | $0 (free) |
| Redis Storage | $0 (included) |
| AI Analysis (Claude primary) | ~$1.60/day |
| With caching (50% hit rate) | ~$0.80/day |
| With trust scores (bypass 30%) | ~$0.56/day |
| **Monthly Total** | **~$17/month** |

With DeepSeek as primary provider: **~$5-7/month**

---

## 🛠️ Development Practices

This project follows strict quality gates:

### Before Committing
- ✅ Code review completed (code-reviewer agent)
- ✅ All tests passing (169/169)
- ✅ Security audit (if handling credentials/user data)
- ✅ Documentation updated
- ✅ No console errors or warnings

### Git Strategy
- **main**: Production-ready code only
- Commit after **every completed task** (not at end of session)
- Descriptive commit messages: `<type>: <description>`
- Small, frequent commits preferred

### Testing
- Target: >80% code coverage (currently 90%+ on critical paths)
- Unit tests for all functions
- Integration tests for complete flows
- Security tests for injection/XSS/ReDoS
- Manual testing in private test subreddit

See [`CLAUDE.md`](./CLAUDE.md) for complete development workflow.

---

## 🤝 Contributing

**Status**: Not accepting external contributions yet (pre-release)

After initial public release, contribution guidelines will be published.

---

## 📝 License

**Status**: To be determined before public release

---

## 📞 Support

**For Moderators**:
- Issues: [GitHub Issues](https://github.com/cdmackie/reddit-ai-automod/issues)
- Questions: [Create a discussion](https://github.com/cdmackie/reddit-ai-automod/discussions)

**For Developers**:
- See [`CLAUDE.md`](./CLAUDE.md) for workflow
- See [`docs/project-status.md`](./docs/project-status.md) for current state
- See [`docs/resume-prompt.md`](./docs/resume-prompt.md) for session recovery

---

## 🙏 Acknowledgments

- **Reddit Devvit Team** - For the excellent platform and developer tools
- **Anthropic** - For Claude 3.5 Haiku API
- **OpenAI** - For GPT-4o Mini API
- **DeepSeek** - For DeepSeek V3 API

---

**Built with** ❤️ **using Reddit Devvit, TypeScript, Claude AI, and Redis**

🤖 **Generated with** [Claude Code](https://claude.com/claude-code)
