# Reddit AI Automod

> **Intelligent User Profiling & Moderation for Reddit Communities**

A Reddit Devvit app that uses AI to analyze new posters and detect problematic users before they cause harm. Built for moderators who want to protect their communities from undesirable users or scammers.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
[![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen)]()

---

## What It Does

Instead of waiting for bad actors to post harmful content, this app **proactively analyzes new users** when they make their first post or comment. It examines:

- **User Profile**: Account age, karma, email verification status
- **Post History**: Last 20 posts/comments from ALL subreddits
- **AI Analysis**: Custom questions you define (e.g., "Does this user appear to be promoting a service?")

Based on configurable rules, the app can:
- **FLAG**: Report to mod queue for human review
- **REMOVE**: Remove post and leave an explanatory comment
- **COMMENT**: Warn user without removing post
- **APPROVE**: Allow post (default for trusted users)

---

## Key Features

**User Profiling & Trust Scoring**
- Analyzes account age, karma, email verification status
- Fetches last 20 posts/comments from ALL subreddits (not just yours)
- Calculates trust score (0-100) to bypass expensive AI analysis for returning good users
- Caching system reduces API calls and costs (24-48h TTL)

**AI-Powered Analysis**
- Works with Claude, DeepSeek, or OpenAI (automatic failover)
- You ask custom questions in plain English (e.g., "Is this user promoting a service?")
- AI answers YES/NO/MAYBE with confidence scores
- Set your own confidence thresholds for actions

**Flexible Rules System**
- **HardRules**: Fast, deterministic checks (account age, karma, links, keywords)
- **AIRules**: Custom AI questions with confidence thresholds
- Content type filtering (apply rules to posts, comments, or both)
- Priority-based execution
- Dry-run mode for safe testing

**Cost Control**
- Daily budget limits with real-time tracking
- Estimated cost: $15-25/month for 3 subreddits (20 new users/day)
- Trust score system reduces costs by ~50% (skips AI for trusted users)
- Choose between premium (Claude) or budget (DeepSeek) AI providers

**Security & Privacy**
- Only analyzes public Reddit data (no private messages)
- PII sanitization before AI analysis (removes emails, phones, credit cards)
- Prevents injection attacks and malicious regex patterns
- Complete audit logging for every action taken

---

## How to Write Rules

Rules use JSON format. The app provides examples and validation to help you get started.

### Example 1: HardRule - New Account with Links

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

### Example 2: AIRule - Promotion Intent Detection

```json
{
  "id": "promotion-seeker",
  "type": "ai",
  "priority": 90,
  "contentType": "submission",
  "aiQuestions": [
    {
      "id": "promotion-intent",
      "question": "Based on this user's post history, are they selling or promoting a product or service? Answer YES if they mention a product, links, or selling. Answer NO if they're mentioning or reviewing a product or service."
    }
  ],
  "conditions": {
    "field": "aiAnalysis.answers.promotion-intent.answer",
    "operator": "==",
    "value": "YES"
  },
  "confidenceThreshold": 80,
  "action": "REMOVE",
  "message": "This subreddit is not for product promotions.",
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

---

## Available Fields & Operators

### Profile Fields
- `profile.accountAgeDays` - Account age in days
- `profile.totalKarma` - Total karma (comment + post)
- `profile.commentKarma` - Comment karma only
- `profile.postKarma` - Post karma only
- `profile.isEmailVerified` - Email verification status
- `profile.hasPremium` - Reddit Premium status
- `profile.subreddits` - Array of subreddits user has posted in

### Post/Comment Fields
- `currentPost.title` - Post title
- `currentPost.body` - Post body text
- `currentPost.type` - Post type (text, link, image, video, gallery)
- `currentPost.urls` - Array of URLs in post
- `currentPost.domains` - Array of domains
- `currentPost.wordCount` - Word count

### Other Fields
- `trustScore.score` - User's trust score (0-100)
- `trustScore.isTrusted` - Whether user is trusted
- `aiAnalysis.answers.{questionId}.answer` - AI's answer (YES/NO/MAYBE)
- `aiAnalysis.answers.{questionId}.confidence` - Confidence (0-100)

### Operators
- **Comparison**: `<`, `>`, `<=`, `>=`, `==`, `!=`
- **Text**: `contains`, `contains_i` (case-insensitive), `regex`, `regex_i`
- **Array**: `in` (checks if value matches any array element)
- **Logical**: `AND`, `OR` (for nested conditions)

### Content Type
The `contentType` field determines where a rule applies:
- `"submission"` or `"post"` - Only on posts
- `"comment"` - Only on comments
- `"any"` - Both posts and comments

---

## Security & Privacy

**What We Access**
- User account age, karma, and email verification (public data only)
- Last 20 posts/comments from all subreddits (public data only)
- Post/comment content text

**What We Don't Access**
- Private messages
- Restricted or quarantined subreddit content
- Any non-public data

**How We Protect You**
- PII is removed before AI analysis (emails, phones, credit cards, URLs)
- API keys encrypted in settings
- Complete audit logs for all actions
- No data shared with third parties except for AI analysis
- Compliance with Reddit API Terms of Service

---

## Cost Estimate

For 20 new users per day across 3 subreddits:
- **With Claude AI**: ~$20-25/month
- **With DeepSeek (budget option)**: ~$5-7/month
- **Devvit hosting**: Free
- **Redis storage**: Free (included)

Trust scores and caching can reduce costs by 50%. Daily budget limits prevent overspending.

---

## License

MIT License - See [LICENSE](./LICENSE) file for details.

---

## Acknowledgments

- **Reddit Devvit Team** - For the platform and developer tools
- **Anthropic** - For Claude 3.5 Haiku API
- **OpenAI** - For GPT-4o Mini API
- **DeepSeek** - For DeepSeek V3 API
