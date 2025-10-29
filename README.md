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

Rules use JSON format with a specific schema structure. Copy and paste the examples below, then customize them for your needs.

### Complete Schema Structure

Your rules JSON must have this structure:

```json
{
  "version": "1.0",
  "subreddit": "YourSubredditName",
  "dryRunMode": false,
  "updatedAt": 1234567890,
  "rules": [
    // Array of rule objects goes here
  ]
}
```

### Rule Object Schema

Each rule in the `rules` array must have these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this rule (e.g., "new-account-spam") |
| `name` | string | Yes | Human-readable name |
| `type` | string | Yes | `"HARD"` (no AI) or `"AI"` (requires AI analysis) |
| `enabled` | boolean | Yes | `true` to enable, `false` to disable |
| `priority` | number | Yes | Higher values run first (1-1000) |
| `contentType` | string | No | `"submission"`, `"post"`, `"comment"`, or `"any"` (defaults to `"submission"`) |
| `subreddit` | string/null | No | Specific subreddit or `null` for global |
| `conditions` | object | Yes | Condition tree (see examples below) |
| `action` | string | Yes | `"APPROVE"`, `"FLAG"`, `"REMOVE"`, or `"COMMENT"` |
| `actionConfig` | object | Yes | Contains `reason` (required) and optional `comment` |
| `aiQuestion` | object | AI only | Contains `id`, `question`, and optional `context` |
| `createdAt` | number | Yes | Unix timestamp in milliseconds |
| `updatedAt` | number | Yes | Unix timestamp in milliseconds |

### Example 1: Simple HARD Rule (Short Post Detection)

Detects posts that are too short and flags them for review.

```json
{
  "version": "1.0",
  "subreddit": "YourSubredditName",
  "dryRunMode": false,
  "updatedAt": 1704067200000,
  "rules": [
    {
      "id": "short-post-check",
      "name": "Flag very short posts",
      "type": "HARD",
      "enabled": true,
      "priority": 100,
      "contentType": "submission",
      "subreddit": null,
      "conditions": {
        "field": "currentPost.wordCount",
        "operator": "<",
        "value": 10
      },
      "action": "FLAG",
      "actionConfig": {
        "reason": "Post is very short ({currentPost.wordCount} words). Please review for quality."
      },
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000
    }
  ]
}
```

### Example 2: AI Rule with Questions

Uses AI to detect if a user is promoting a service.

```json
{
  "version": "1.0",
  "subreddit": "YourSubredditName",
  "dryRunMode": false,
  "updatedAt": 1704067200000,
  "rules": [
    {
      "id": "promotion-detector",
      "name": "Detect service promotion",
      "type": "AI",
      "enabled": true,
      "priority": 90,
      "contentType": "submission",
      "subreddit": null,
      "aiQuestion": {
        "id": "is-promotion",
        "question": "Based on this user's post history, are they promoting or selling a product or service? Answer YES if they mention selling, links to products, or promotional content. Answer NO if they're just discussing or reviewing products.",
        "context": "Be strict - even subtle promotion should be flagged."
      },
      "conditions": {
        "logicalOperator": "AND",
        "rules": [
          {
            "field": "aiAnalysis.answers.is-promotion.answer",
            "operator": "==",
            "value": "YES"
          },
          {
            "field": "aiAnalysis.answers.is-promotion.confidence",
            "operator": ">=",
            "value": 80
          }
        ]
      },
      "action": "REMOVE",
      "actionConfig": {
        "reason": "AI detected promotion (confidence: {aiAnalysis.answers.is-promotion.confidence}%)",
        "comment": "This subreddit is not for product or service promotions. Please review our rules."
      },
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000
    }
  ]
}
```

### Example 3: Combined HARD + AI Rule

New accounts with links get AI analysis to determine intent.

```json
{
  "version": "1.0",
  "subreddit": "YourSubredditName",
  "dryRunMode": false,
  "updatedAt": 1704067200000,
  "rules": [
    {
      "id": "new-account-link-check",
      "name": "New accounts with links - AI check",
      "type": "AI",
      "enabled": true,
      "priority": 100,
      "contentType": "submission",
      "subreddit": null,
      "aiQuestion": {
        "id": "link-intent",
        "question": "Is this user posting spam or promotional links? Answer YES if links appear to be spam, self-promotion, or commercial. Answer NO if links are legitimate references or helpful resources."
      },
      "conditions": {
        "logicalOperator": "AND",
        "rules": [
          {
            "field": "profile.accountAgeInDays",
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
          },
          {
            "field": "aiAnalysis.answers.link-intent.answer",
            "operator": "==",
            "value": "YES"
          }
        ]
      },
      "action": "REMOVE",
      "actionConfig": {
        "reason": "New account ({profile.accountAgeInDays} days old, {profile.totalKarma} karma) posting spam links",
        "comment": "New accounts cannot post promotional links. Please build karma first by participating in discussions."
      },
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000
    }
  ]
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
