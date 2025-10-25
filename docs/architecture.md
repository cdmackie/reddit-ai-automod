# Reddit AI Automod - System Architecture

**Last Updated**: 2025-10-25
**Version**: 1.0
**Status**: Planning Phase

## Executive Summary

This document outlines the technical architecture for the Reddit AI Automod application, a Devvit-based moderation tool that leverages AI to automate content moderation while providing moderators with full control and transparency.

---

## Technology Stack

### Core Platform
- **Platform**: Reddit Devvit (TypeScript/JavaScript)
- **Runtime**: Node.js 22.2.0+
- **Language**: TypeScript 5.x
- **Package Manager**: npm

### AI Providers
- **Primary (Free Tier)**: OpenAI Moderation API (free, 85-90% accuracy)
- **Secondary (Paid Tier)**: OpenAI-compatible endpoints (GPT-4, Claude via compatible API)
- **Tertiary (Google)**: Google Gemini API
- **Strategy**: Hybrid two-stage approach

### Storage
- **Primary**: Redis (provided by Devvit)
  - Configuration storage
  - Rule definitions
  - User tracking
  - Statistics/analytics
  - AI response caching

### External Integrations
- **AI APIs**: OpenAI, Gemini, OpenAI-compatible providers
- **Notifications**: Discord/Slack webhooks (optional)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Reddit Platform                         │
│  (Posts, Comments, Reports, Moderation Actions)             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Events (PostSubmit, CommentSubmit, etc.)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Devvit App (Reddit AI Automod)                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Event Handler Layer                      │  │
│  │  - Post Submit Handler                                │  │
│  │  - Comment Submit Handler                             │  │
│  │  - Report Handler                                     │  │
│  │  - Scheduled Jobs                                     │  │
│  └──────────────┬────────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Rule Engine Core                         │  │
│  │  - Rule Matcher                                       │  │
│  │  - Condition Evaluator                                │  │
│  │  - Priority Queue                                     │  │
│  │  - Rate Limiter                                       │  │
│  └──────┬─────────────────────┬─────────────────────────┘  │
│         │                     │                             │
│         ▼                     ▼                             │
│  ┌────────────┐       ┌───────────────────┐               │
│  │ Predefined │       │  Custom Rules     │               │
│  │   Rules    │       │   Configuration   │               │
│  └──────┬─────┘       └─────────┬─────────┘               │
│         │                       │                           │
│         └───────┬───────────────┘                           │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Content Analysis Layer                       │  │
│  │  - Keyword Matching                                   │  │
│  │  - Regex Evaluation                                   │  │
│  │  - Link/Domain Checking                               │  │
│  │  - User History Analysis                              │  │
│  │  - Similarity Detection                                │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          AI Analysis Layer                            │  │
│  │  - Provider Router (OpenAI/Gemini)                    │  │
│  │  - Prompt Template Engine                             │  │
│  │  - Response Parser                                    │  │
│  │  - Confidence Evaluator                               │  │
│  │  - Cache Manager                                      │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Action Execution Layer                       │  │
│  │  - Moderation Actions (remove, ban, approve)          │  │
│  │  - User Communication (comments, DMs)                 │  │
│  │  - Flair Management                                   │  │
│  │  - Reporting & Notifications                          │  │
│  │  - Audit Logging                                      │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Storage Layer (Redis)                        │  │
│  │  - Rule Definitions                                   │  │
│  │  - Configuration Settings                             │  │
│  │  - User Tracking & History                            │  │
│  │  - Statistics & Analytics                             │  │
│  │  - AI Response Cache                                  │  │
│  │  - Audit Logs                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                     │                    │
                     │                    │
                     ▼                    ▼
         ┌─────────────────────┐  ┌────────────────┐
         │   OpenAI API        │  │  Gemini API    │
         │  (Moderation + GPT) │  │                │
         └─────────────────────┘  └────────────────┘
```

---

## Component Architecture

### 1. Event Handler Layer

**Purpose**: Receive and route Reddit events to the rule engine.

**Components**:
- `PostSubmitHandler`: Triggered on new post submissions
- `CommentSubmitHandler`: Triggered on new comments
- `PostReportHandler`: Triggered when posts are reported
- `CommentReportHandler`: Triggered when comments are reported
- `ScheduledJobHandler`: Periodic tasks (cleanup, stats aggregation)

**Implementation**:
```typescript
// src/handlers/posts.ts
export function registerPostHandlers(devvit: Devvit) {
  devvit.addTrigger({
    event: 'PostSubmit',
    async onEvent(event, context) {
      await ruleEngine.processPost(event.post, context);
    }
  });
}
```

**Responsibilities**:
- Parse incoming events
- Extract relevant data (author, content, context)
- Pass to Rule Engine
- Handle errors gracefully

---

### 2. Rule Engine Core

**Purpose**: Central orchestration of rule evaluation and execution.

**Components**:
- **Rule Matcher**: Determines which rules apply
- **Condition Evaluator**: Tests all rule conditions
- **Priority Queue**: Orders rules by priority
- **Rate Limiter**: Enforces cooldowns and rate limits

**Flow**:
```
1. Receive content (post/comment)
2. Load applicable rules from Redis
3. Sort by priority
4. For each rule:
   a. Check if triggered (filters match)
   b. Evaluate conditions (all must pass)
   c. If AI analysis enabled, request analysis
   d. If all conditions met, execute actions
   e. If stopOnMatch, break loop
5. Log execution to Redis
6. Update statistics
```

**Key Design Decisions**:
- **Short-circuit evaluation**: Stop after first match (if configured)
- **Parallel evaluation**: Evaluate independent conditions in parallel
- **Cache-first**: Check cache before calling AI APIs
- **Graceful degradation**: Continue if single rule fails

---

### 3. Predefined Rules Module

**Purpose**: Pre-built, battle-tested moderation rules.

**Structure**:
```typescript
// src/rules/predefined/
├── spam-detection.ts
├── hate-speech.ts
├── harassment.ts
├── low-effort.ts
├── duplicate-content.ts
└── index.ts (registry)
```

**Registration**:
```typescript
import { PredefinedRules } from './rules/predefined';

const ruleRegistry = new Map();

// Auto-register all predefined rules
for (const rule of PredefinedRules) {
  ruleRegistry.set(rule.id, rule);
}
```

**Configuration UI**:
- Moderators can enable/disable each rule
- Adjust confidence thresholds
- Customize action responses
- Set rate limits

---

### 4. Custom Rules System

**Purpose**: Allow moderators to create custom rules without coding.

**Storage**:
```redis
# Rule definition
rules:{subreddit}:custom:{ruleId} -> JSON

# Rule list (sorted by priority)
rules:{subreddit}:list -> Sorted Set

# Example
rules:r_testsubreddit:custom:rule_001 -> {
  "name": "Block Short Posts",
  "priority": 10,
  "triggers": [...],
  "conditions": [...],
  "actions": [...]
}
```

**Evaluation**:
- Load custom rules alongside predefined rules
- Same evaluation engine
- Full flexibility with UI-based configuration

---

### 5. Content Analysis Layer

**Purpose**: Non-AI content analysis (fast, deterministic).

**Analyzers**:

#### Keyword Analyzer
```typescript
class KeywordAnalyzer {
  match(content: string, keywords: string[], options: KeywordOptions): boolean {
    // Case-sensitive/insensitive matching
    // Exact/contains/starts_with/ends_with
    // Scope: title, body, or both
  }
}
```

#### Regex Analyzer
```typescript
class RegexAnalyzer {
  match(content: string, pattern: string, flags: string): RegExpMatchArray | null {
    // Compile and cache regex patterns
    // Apply to title, body, or both
  }
}
```

#### Link Analyzer
```typescript
class LinkAnalyzer {
  analyze(content: string): LinkAnalysisResult {
    // Extract all URLs
    // Check against blacklist/whitelist
    // Detect link shorteners
    // Count links
    // Check for suspicious patterns
  }
}
```

#### User History Analyzer
```typescript
class UserHistoryAnalyzer {
  async analyze(userId: string, context: Context): Promise<UserHistoryResult> {
    // Fetch recent posts/comments via Reddit API
    // Check violation history from Redis
    // Calculate spam score
    // Detect patterns
  }
}
```

#### Similarity Analyzer
```typescript
class SimilarityAnalyzer {
  async checkSimilarity(content: string, compareAgainst: string[]): Promise<number> {
    // Use simple cosine similarity or Levenshtein distance
    // For advanced similarity, delegate to AI
  }
}
```

**Performance**:
- All analyzers run in < 10ms
- No external API calls
- Cached results where applicable

---

### 6. AI Analysis Layer

**Purpose**: Intelligent content analysis using LLMs.

**Architecture**:

```
┌────────────────────────────────────────────┐
│         AI Analysis Coordinator            │
└────────┬───────────────────────────────────┘
         │
         ├─→ Cache Check (Redis)
         │   └─→ Cache Hit? Return result
         │
         ├─→ Provider Router
         │   ├─→ OpenAI Provider
         │   ├─→ Gemini Provider
         │   └─→ Custom Provider
         │
         ├─→ Prompt Template Engine
         │   ├─→ System prompts
         │   ├─→ User context
         │   └─→ Rule-specific templates
         │
         ├─→ Response Parser
         │   ├─→ JSON extraction
         │   ├─→ Confidence scoring
         │   └─→ Error handling
         │
         └─→ Cache Result (Redis with TTL)
```

#### Two-Stage AI Strategy

**Stage 1: OpenAI Moderation API (Free)**
```typescript
async function moderationCheck(content: string): Promise<ModerationResult> {
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ input: content })
  });

  // Returns: harassment, hate, self-harm, sexual, violence scores
  // Free forever, ~85-90% accuracy
}
```

**Stage 2: Advanced AI (OpenAI GPT / Gemini)**
```typescript
async function advancedAnalysis(content: string, prompt: string): Promise<AIResult> {
  // Only called if:
  // 1. Moderation API is inconclusive (60-85% confidence)
  // 2. Custom rule requires nuanced analysis
  // 3. Appeal review requested

  // Use prompt caching for 90% cost savings
  // Use batch API for 50% discount when possible
}
```

**Cost Optimization**:
- **Moderation API**: 100% free
- **Prompt Caching**: 90% savings on system prompts
- **Batch Processing**: 50% discount for non-urgent analysis
- **Response Caching**: Cache AI results for 24h (same content)
- **Result**: $0-50/month for 10k posts/day

---

### 7. Prompt Template Engine

**Purpose**: Generate consistent, effective prompts for AI analysis.

**Template System**:
```typescript
interface PromptTemplate {
  systemPrompt: string;      // Cached (90% savings)
  userPromptTemplate: string; // Dynamic per request
  outputFormat: 'json' | 'text';
  examples?: Example[];
}

const templates = {
  toxicity: {
    systemPrompt: `You are a content moderator for Reddit...`,
    userPromptTemplate: `Analyze this {{contentType}}:

    Title: {{title}}
    Body: {{body}}

    Return JSON: { toxic: boolean, confidence: number, categories: string[] }`
  },

  spam: {
    systemPrompt: `You are an expert spam detector...`,
    userPromptTemplate: `Is this spam? {{content}}`
  },

  custom: {
    systemPrompt: `{{customSystemPrompt}}`,
    userPromptTemplate: `{{customUserPrompt}}`
  }
};
```

**Rendering**:
```typescript
function renderPrompt(template: PromptTemplate, data: any): string {
  return template.userPromptTemplate.replace(/{{(\w+)}}/g, (_, key) => {
    return data[key] || '';
  });
}
```

---

### 8. Action Execution Layer

**Purpose**: Execute moderation actions based on rule results.

**Action Executors**:

#### Remove Executor
```typescript
class RemoveExecutor {
  async execute(content: Content, config: RemoveConfig, context: Context) {
    // Remove post/comment
    await context.reddit.remove(content.id, config.spam);

    // Optionally reply to user
    if (config.replyToUser) {
      await this.replyToUser(content, config.replyTemplate, context);
    }

    // Log action
    await this.logAction('remove', content, config, context);
  }
}
```

#### Ban Executor
```typescript
class BanExecutor {
  async execute(user: User, config: BanConfig, context: Context) {
    // Ban user
    await context.reddit.banUser({
      username: user.name,
      duration: config.duration,
      reason: config.reason,
      note: config.note
    });

    // Send message to user
    if (config.message) {
      await context.reddit.sendPrivateMessage({
        to: user.name,
        subject: 'You have been banned',
        text: config.message
      });
    }

    // Log action
    await this.logAction('ban', user, config, context);
  }
}
```

#### Comment Executor
```typescript
class CommentExecutor {
  async execute(parent: Content, config: CommentConfig, context: Context) {
    const comment = await context.reddit.submitComment({
      id: parent.id,
      text: config.template
    });

    if (config.sticky) {
      await comment.distinguish({ sticky: true });
    }

    if (config.lock) {
      await comment.lock();
    }

    await this.logAction('comment', parent, config, context);
  }
}
```

**Action Registry**:
```typescript
const actionRegistry = new Map<ActionType, ActionExecutor>([
  ['remove', new RemoveExecutor()],
  ['ban', new BanExecutor()],
  ['comment', new CommentExecutor()],
  ['flair', new FlairExecutor()],
  ['report', new ReportExecutor()],
  ['approve', new ApproveExecutor()],
  // ... more executors
]);
```

---

### 9. Storage Layer (Redis)

**Purpose**: Persist configuration, state, and analytics.

**Data Models**:

#### Rule Storage
```redis
# Predefined rule config (per subreddit)
rules:{subreddit}:predefined:{ruleId}:config -> JSON

# Custom rule definitions
rules:{subreddit}:custom:{ruleId} -> JSON

# Rule priority list
rules:{subreddit}:enabled -> Sorted Set [(ruleId, priority), ...]

# Rule statistics
rules:{subreddit}:{ruleId}:stats -> JSON {
  triggers: number,
  actions: number,
  accuracy: number,
  ...
}
```

#### User Tracking
```redis
# User violation history
users:{subreddit}:{userId}:violations -> List [violation1, violation2, ...]

# User action cooldowns
users:{subreddit}:{userId}:cooldown:{ruleId} -> Timestamp (with TTL)

# User reputation score
users:{subreddit}:{userId}:score -> Number
```

#### AI Cache
```redis
# Content hash -> AI analysis result
ai:cache:{contentHash} -> JSON { result: ..., timestamp: ... } (TTL: 24h)

# Usage statistics
ai:usage:{date} -> JSON { tokens: number, cost: number }
```

#### Audit Logs
```redis
# Action log
audit:{subreddit}:{date} -> List [log1, log2, ...] (TTL: 90 days)

# Each log entry:
{
  timestamp: Date,
  ruleId: string,
  contentId: string,
  userId: string,
  action: ActionType,
  confidence: number,
  result: 'success' | 'error',
  modOverride?: boolean
}
```

**TTL Strategy**:
- AI cache: 24 hours
- User cooldowns: Configurable (1-60 minutes)
- Audit logs: 90 days
- Statistics: Permanent (aggregated)

---

## Data Flow Diagrams

### Post Submission Flow

```
User submits post
       │
       ▼
┌─────────────────┐
│ PostSubmit      │
│ Event Triggered │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Load Enabled Rules   │
│ Sort by Priority     │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐    NO
│ Rule 1: Triggered?   │───────┐
└────────┬─────────────┘       │
         │ YES                 │
         ▼                     │
┌──────────────────────┐       │
│ Evaluate Conditions  │       │
└────────┬─────────────┘       │
         │                     │
         ▼                     │
┌──────────────────────┐    NO │
│ All Conditions Met?  │───────┤
└────────┬─────────────┘       │
         │ YES                 │
         ▼                     │
┌──────────────────────┐       │
│ AI Analysis Needed?  │       │
└────────┬─────────────┘       │
         │ YES                 │
         ▼                     │
┌──────────────────────┐       │
│ Check AI Cache       │       │
└────────┬─────────────┘       │
         │                     │
         ├─ Cache Hit ─────────┤
         │                     │
         ├─ Cache Miss         │
         │    │                │
         │    ▼                │
         │ ┌───────────────┐  │
         │ │ Call AI API   │  │
         │ └───────┬───────┘  │
         │         │           │
         │         ▼           │
         │ ┌───────────────┐  │
         │ │ Cache Result  │  │
         │ └───────┬───────┘  │
         │         │           │
         └─────────┤           │
                   │           │
                   ▼           │
         ┌──────────────────┐ │
         │ Confidence Met?  │ │
         └────────┬─────────┘ │
                  │ YES       │
                  ▼           │
         ┌──────────────────┐ │
         │ Execute Actions  │ │
         └────────┬─────────┘ │
                  │           │
                  ▼           │
         ┌──────────────────┐ │
         │ Log to Redis     │ │
         └────────┬─────────┘ │
                  │           │
                  ▼           │
         ┌──────────────────┐ │
         │ Update Stats     │ │
         └────────┬─────────┘ │
                  │           │
                  ▼           │
         ┌──────────────────┐ │
         │ stopOnMatch?     │ │
         └────────┬─────────┘ │
                  │ NO        │
                  └───────────┤
                              │
                              ▼
                     ┌────────────────┐
                     │ Next Rule      │
                     │ or End         │
                     └────────────────┘
```

---

## API Integration Architecture

### OpenAI Integration

```typescript
// src/ai/providers/openai.ts

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  async analyze(content: string, config: AIAnalysisConfig): Promise<AIResult> {
    // Stage 1: Free moderation API
    if (config.analysisType === 'toxicity') {
      return await this.moderationCheck(content);
    }

    // Stage 2: Advanced analysis (GPT-4)
    return await this.advancedAnalysis(content, config);
  }

  private async moderationCheck(content: string): Promise<AIResult> {
    const response = await fetch(`${this.baseUrl}/moderations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: content })
    });

    const data = await response.json();
    return this.parseModerationResponse(data);
  }

  private async advancedAnalysis(content: string, config: AIAnalysisConfig): Promise<AIResult> {
    const prompt = renderPrompt(config.customPrompt || templates[config.analysisType], {
      content,
      title: content.split('\n')[0],
      body: content
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4',
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return this.parseAdvancedResponse(data);
  }
}
```

### Gemini Integration

```typescript
// src/ai/providers/gemini.ts

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async analyze(content: string, config: AIAnalysisConfig): Promise<AIResult> {
    const response = await fetch(
      `${this.baseUrl}/models/${config.model || 'gemini-pro'}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: this.buildPrompt(content, config) }]
          }],
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            }
          ]
        })
      }
    );

    const data = await response.json();
    return this.parseGeminiResponse(data, config);
  }
}
```

---

## Security Architecture

### API Key Management

```typescript
// Store API keys in Devvit app settings (per-subreddit)
Devvit.addSettings([
  {
    name: 'openai_api_key',
    type: 'string',
    label: 'OpenAI API Key',
    isSecret: true
  },
  {
    name: 'gemini_api_key',
    type: 'string',
    label: 'Google Gemini API Key',
    isSecret: true
  }
]);

// Access in code
const openAIKey = await context.settings.get('openai_api_key');
```

### Rate Limiting

```typescript
// Per-user rate limiting
class RateLimiter {
  async checkLimit(userId: string, ruleId: string, context: Context): Promise<boolean> {
    const key = `ratelimit:${userId}:${ruleId}`;
    const count = await context.redis.get(key);

    if (count && parseInt(count) >= MAX_ACTIONS_PER_WINDOW) {
      return false; // Rate limited
    }

    await context.redis.incr(key);
    await context.redis.expire(key, WINDOW_SECONDS);
    return true;
  }
}
```

### Input Validation

```typescript
// Validate all user inputs
function validateRule(rule: CustomRule): ValidationResult {
  // Check for required fields
  // Validate regex patterns
  // Sanitize custom prompts
  // Check action permissions
  // Prevent injection attacks
}
```

---

## Performance Optimizations

### 1. Caching Strategy

```typescript
// Multi-level caching
const cache = {
  // L1: In-memory (fast)
  memory: new Map<string, CacheEntry>(),

  // L2: Redis (persistent)
  async get(key: string): Promise<any> {
    // Check memory first
    if (this.memory.has(key)) {
      return this.memory.get(key).value;
    }

    // Fall back to Redis
    const value = await redis.get(key);
    if (value) {
      this.memory.set(key, { value, expires: Date.now() + 60000 });
    }
    return value;
  }
};
```

### 2. Batch Processing

```typescript
// Process multiple items in batch when possible
async function batchProcessPosts(posts: Post[]) {
  // Group by analysis type
  const groups = groupByAnalysisType(posts);

  // Send batch requests to AI APIs (50% discount)
  const results = await Promise.all(
    groups.map(group => batchAnalyze(group))
  );

  return results.flat();
}
```

### 3. Lazy Loading

```typescript
// Load rules only when needed
class RuleEngine {
  private ruleCache = new Map<string, Rule>();

  async getRule(ruleId: string): Promise<Rule> {
    if (!this.ruleCache.has(ruleId)) {
      const rule = await this.loadRuleFromRedis(ruleId);
      this.ruleCache.set(ruleId, rule);
    }
    return this.ruleCache.get(ruleId);
  }
}
```

---

## Scalability Considerations

### Horizontal Scaling
- Devvit handles scaling automatically
- Redis is shared across all instances
- Stateless design allows infinite scaling

### Load Distribution
- Use Redis pub/sub for distributed processing
- Schedule heavy operations during off-peak hours
- Implement backpressure mechanisms

### Database Optimization
- Index frequently queried keys
- Use Redis sorted sets for rankings
- Implement data retention policies (TTLs)

---

## Monitoring & Observability

### Metrics to Track

```typescript
interface Metrics {
  // Performance
  ruleEvaluationTime: Histogram;
  aiApiLatency: Histogram;
  redisLatency: Histogram;

  // Business
  postsProcessed: Counter;
  actionsExecuted: Counter;
  falsePositives: Counter;

  // Costs
  aiApiCalls: Counter;
  aiTokensUsed: Counter;
  estimatedCost: Gauge;

  // Errors
  apiErrors: Counter;
  ruleErrors: Counter;
}
```

### Logging Strategy

```typescript
// Structured logging
logger.info('Rule executed', {
  ruleId: 'spam-detection',
  contentId: 't3_abc123',
  confidence: 0.87,
  action: 'remove',
  duration: 234 // ms
});
```

---

## Deployment Architecture

### Development
```
Local Machine
    │
    ├─→ npm run dev (hot reload)
    │
    └─→ Test Subreddit (<200 members)
```

### Production
```
Git Repository
    │
    ├─→ npm run deploy
    │
    └─→ Devvit App Directory
             │
             └─→ Installed on Subreddits
```

---

## Technology Decision Rationale

### Why Devvit?
- ✅ Native Reddit integration
- ✅ Free hosting and infrastructure
- ✅ Built-in Redis storage
- ✅ Event-driven architecture
- ✅ Eligible for Reddit Developer Funds 2025
- ✅ No server management required

### Why TypeScript?
- ✅ Type safety reduces bugs
- ✅ Better IDE support
- ✅ Required by Devvit platform
- ✅ Modern async/await syntax

### Why OpenAI + Gemini?
- ✅ OpenAI Moderation API is free forever
- ✅ GPT-4 excellent for nuanced analysis
- ✅ Gemini competitive pricing
- ✅ Multiple providers = redundancy

### Why Redis?
- ✅ Provided by Devvit (no setup)
- ✅ Fast in-memory operations
- ✅ Pub/sub for real-time updates
- ✅ Built-in TTL support

---

## Future Architecture Considerations

### Phase 2+ Enhancements
- **Machine Learning**: Train custom models on subreddit data
- **Advanced Analytics**: Time-series analysis, trend detection
- **Multi-subreddit**: Federated moderation across communities
- **Mobile App**: Native mobile moderator dashboard
- **Webhooks**: External integrations (Discord, Slack, Zapier)

---

## Conclusion

This architecture provides:
- ✅ Scalable foundation for growth
- ✅ Cost-effective AI integration
- ✅ Flexible rule configuration
- ✅ Comprehensive audit trail
- ✅ Moderator control and transparency
- ✅ High performance (<100ms rule evaluation)
- ✅ Low cost ($0-50/month for 10k posts/day)

**Next Steps**: Proceed to implementation planning.
