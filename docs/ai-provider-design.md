# AI Provider Architecture Design

**Created**: 2025-10-26
**Updated**: 2025-10-26 (Post-Architect Review)
**Phase**: Phase 2 - AI Integration
**Status**: Design Document - Approved with Critical Fixes Applied
**Architect Review**: Completed - All Priority 1 issues addressed

---

## Overview

This document details the architecture for the AI analysis system that will analyze user profiles and post history to detect problematic behavior patterns (dating seekers, scammers, underage users, spam).

### Design Goals

1. **Multi-Provider Strategy**: Support Claude, OpenAI, and DeepSeek with automatic fallback
2. **Cost Control**: Strict budget enforcement with per-provider tracking
3. **Performance**: Aggressive caching to minimize API calls
4. **Reliability**: Health checking, retry logic, graceful degradation
5. **Quality**: Structured output with confidence scores
6. **Observability**: Comprehensive logging and cost tracking

---

## Architect Review Summary

### Critical Issues Addressed (Priority 1)

1. ✅ **API Key Storage Security**: Implemented Devvit Secrets Manager integration
2. ✅ **Circuit Breaker Pattern**: Added for provider failure protection
3. ✅ **Request Deduplication**: Implemented request coalescing to prevent duplicate AI calls
4. ✅ **Budget Reset Race Conditions**: Using Redis atomic operations (Lua scripts)
5. ✅ **Provider Response Validation**: Added Zod schema validation for all AI responses

### Improvements Implemented (Priority 2)

1. ✅ **Enhanced Error Classification**: Added AIErrorType enum with specific retry strategies
2. ✅ **Prompt Version Management**: Tracking prompt versions with A/B testing capability
3. ✅ **Differential Caching Strategy**: Trust-score-based cache TTL (12h-48h)
4. ✅ **Observability**: Added correlation IDs and structured logging
5. ✅ **Content Sanitization**: PII stripping before AI analysis
6. ✅ **Graceful Degradation**: 4-level degradation strategy

---

## System Architecture

```
User posts to subreddit
  ↓
PostSubmit Handler
  ↓
Is user trusted? (Trust Score > 70)
  YES → Approve immediately ✅
  NO → Continue ↓
  ↓
Check Cache: AI analysis exists? (< 24h old)
  YES → Use cached result, skip to action evaluation
  NO → Continue ↓
  ↓
Cost Tracker: Budget available?
  NO → Log warning, flag for manual review
  YES → Continue ↓
  ↓
AI Analyzer
  ├─ Provider Selector (choose Claude/OpenAI/DeepSeek)
  ├─ Build Analysis Prompt
  ├─ Call AI Provider (with retry logic)
  ├─ Parse Structured Response
  ├─ Track Cost
  └─ Cache Result (24h TTL)
  ↓
Evaluate Result
  - Dating intent > 80%? → REMOVE
  - Scammer risk HIGH > 75%? → FLAG
  - Appears underage > 85%? → FLAG
  - Otherwise → APPROVE
  ↓
Execute Action + Log + Update Trust Score
```

---

## Component Design

### 1. Type Definitions (`src/types/ai.ts`)

**Purpose**: Define all TypeScript interfaces for AI system

**Key Types**:

```typescript
// AI Provider Types
type AIProviderType = 'claude' | 'openai' | 'deepseek';

// Error Classification (NEW - Priority 2)
enum AIErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  TIMEOUT = 'TIMEOUT',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN'
}

// Degradation Levels (NEW - Priority 2)
enum DegradationLevel {
  FULL = 'FULL',         // All AI features enabled
  REDUCED = 'REDUCED',   // Skip expensive checks
  MINIMAL = 'MINIMAL',   // Trust scores only
  EMERGENCY = 'EMERGENCY' // Manual review only (no AI)
}

interface AIProviderConfig {
  type: AIProviderType;
  model: string;
  enabled: boolean;
  priority: number; // 1 = primary, 2 = fallback, etc.
  // Note: API keys stored in Devvit Secrets Manager, not in config
}

// Circuit Breaker State (NEW - Priority 1)
interface CircuitBreakerState {
  provider: AIProviderType;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  openUntil?: number; // Timestamp when circuit can transition to HALF_OPEN
  successCount: number; // For HALF_OPEN → CLOSED transition
}

// Observability (NEW - Priority 2)
interface AIAnalysisContext {
  correlationId: string; // UUID for tracking request across components
  userId: string;
  subreddit: string;
  provider: AIProviderType;
  attempt: number;
  startTime: number;
}

// Analysis Request/Response
interface AIAnalysisRequest {
  userId: string;
  username: string;
  profile: UserProfile;
  postHistory: PostHistorySummary;
  currentPost: {
    title: string;
    body: string;
    subreddit: string;
  };
  context: {
    subredditName: string;
    subredditType: 'FriendsOver40' | 'FriendsOver50' | 'bitcointaxes' | 'other';
    correlationId: string; // For request tracking
    promptVersion: string; // For A/B testing prompts
  };
}

interface AIAnalysisResult {
  userId: string;
  timestamp: number;
  provider: AIProviderType;
  correlationId: string; // For request tracking (NEW)
  promptVersion: string; // For tracking which prompt was used (NEW)
  cacheTTL: number; // How long to cache based on trust score (NEW)

  // Detection Results
  datingIntent: {
    detected: boolean;
    confidence: number; // 0-100
    reasoning: string;
  };

  scammerRisk: {
    level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number; // 0-100
    patterns: string[];
    reasoning: string;
  };

  ageEstimate?: {
    appearsUnderage: boolean;
    confidence: number; // 0-100
    reasoning: string;
    estimatedAge?: string; // "under-18", "18-25", "25-40", "40+"
  };

  spamIndicators: {
    detected: boolean;
    confidence: number;
    patterns: string[];
  };

  // Overall Assessment
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedAction: 'APPROVE' | 'FLAG' | 'REMOVE';

  // Metadata
  tokensUsed: number;
  costUSD: number;
  latencyMs: number;
}

// Cost Tracking
interface CostRecord {
  id: string;
  timestamp: number;
  provider: AIProviderType;
  userId: string;
  tokensUsed: number;
  costUSD: number;
  cached: boolean;
}

interface BudgetStatus {
  dailyLimit: number;
  dailySpent: number;
  dailyRemaining: number;
  monthlySpent: number;
  perProviderSpent: Record<AIProviderType, number>;
  alertLevel: 'NONE' | 'WARNING_50' | 'WARNING_75' | 'WARNING_90' | 'EXCEEDED';
}

// Prompt Versioning (NEW - Priority 2)
interface PromptVersion {
  version: string; // e.g., "v1.0", "v1.1-dating-focus"
  prompt: string;
  enabled: boolean;
  weight: number; // For A/B testing (0-100)
  createdAt: number;
  metrics?: {
    uses: number;
    accuracy?: number;
    falsePositiveRate?: number;
  };
}

// Request Deduplication (NEW - Priority 1)
interface InFlightRequest {
  userId: string;
  correlationId: string;
  startTime: number;
  expiresAt: number; // Auto-expire after 30s
}

// Differential Caching Config (NEW - Priority 2)
interface CacheTTLConfig {
  highTrust: number;    // Trust score 60-69: 48h cache
  mediumTrust: number;  // Trust score 40-59: 24h cache
  lowTrust: number;     // Trust score <40: 12h cache
  knownBad: number;     // Known bad actors: 7 days
}

// Content Sanitization (NEW - Priority 2)
interface SanitizationResult {
  originalLength: number;
  sanitizedLength: number;
  piiRemoved: number;
  urlsRemoved: number;
  sanitizedContent: string;
}
```

---

### 2. AI Provider Interface (`src/ai/provider.ts`)

**Purpose**: Abstract interface that all AI providers implement

**Design Pattern**: Strategy Pattern

**Interface**:

```typescript
interface IAIProvider {
  readonly type: AIProviderType;
  readonly model: string;

  /**
   * Analyze user profile and determine risk
   * Returns structured analysis with confidence scores
   */
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;

  /**
   * Health check - can the provider respond?
   */
  healthCheck(): Promise<boolean>;

  /**
   * Calculate cost for a given token count
   */
  calculateCost(inputTokens: number, outputTokens: number): number;
}
```

**Key Features**:
- Common interface for all providers
- Standardized input/output format
- Health checking capability
- Cost calculation

---

### 3. Claude Client (`src/ai/claude.ts`)

**Purpose**: Anthropic Claude 3.5 Haiku implementation

**Provider Details**:
- Model: `claude-3-5-haiku-20241022`
- API: Anthropic Messages API
- Output: Tool use with structured schema
- Cost: $1/MTok input, $5/MTok output
- Estimated cost per analysis: ~$0.05-0.08

**Key Features**:
- Retry logic with exponential backoff (3 attempts)
- Structured output using tool definitions
- Token counting
- Error handling with detailed logging

**Configuration**:
```typescript
{
  type: 'claude',
  model: 'claude-3-5-haiku-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 1500,
  temperature: 0.3,
  retryAttempts: 3,
  retryDelayMs: 1000
}
```

---

### 4. OpenAI Client (`src/ai/openai.ts`)

**Purpose**: OpenAI GPT-4o Mini implementation (fallback)

**Provider Details**:
- Model: `gpt-4o-mini`
- API: OpenAI Chat Completions API
- Output: JSON mode with structured schema
- Cost: $0.15/MTok input, $0.60/MTok output
- Estimated cost per analysis: ~$0.10-0.12

**Key Features**:
- JSON mode for structured output
- Retry logic with exponential backoff
- Token counting
- Same interface as Claude

**Configuration**:
```typescript
{
  type: 'openai',
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  responseFormat: { type: 'json_object' },
  temperature: 0.3,
  retryAttempts: 3,
  retryDelayMs: 1000
}
```

---

### 5. DeepSeek Client (`src/ai/deepseek.ts`)

**Purpose**: DeepSeek V3 implementation (low-cost option)

**Provider Details**:
- Model: `deepseek-chat`
- API: OpenAI-compatible API
- Output: JSON mode
- Cost: $0.27/MTok input, $1.10/MTok output
- Estimated cost per analysis: ~$0.02-0.03

**Key Features**:
- OpenAI-compatible API (same SDK)
- Lowest cost option (~60-70% cheaper than Claude)
- Quality testing required
- Same retry logic

**Configuration**:
```typescript
{
  type: 'deepseek',
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  temperature: 0.3,
  retryAttempts: 3,
  retryDelayMs: 1000
}
```

---

### 6. Cost Tracker (`src/ai/costTracker.ts`)

**Purpose**: Track AI costs and enforce budget limits

**Storage**: Redis with daily/monthly aggregates

**Key Features**:

1. **Budget Enforcement**:
   - Check before every AI call
   - Default daily limit: $5.00
   - Return error if budget exceeded

2. **Per-Provider Tracking**:
   - Separate counters for Claude, OpenAI, DeepSeek
   - Track which provider is most cost-effective

3. **Alerts**:
   - 50% budget: Log warning
   - 75% budget: Log warning + alert mods
   - 90% budget: Log critical + alert mods
   - 100% budget: Block AI calls

4. **Redis Keys**:
```typescript
// Daily tracking
`cost:daily:{YYYY-MM-DD}` → total spent today
`cost:daily:{YYYY-MM-DD}:claude` → Claude spent today
`cost:daily:{YYYY-MM-DD}:openai` → OpenAI spent today
`cost:daily:{YYYY-MM-DD}:deepseek` → DeepSeek spent today

// Monthly tracking
`cost:monthly:{YYYY-MM}` → total spent this month

// Individual records (for auditing)
`cost:record:{timestamp}:{userId}` → CostRecord JSON
```

5. **API**:
```typescript
class CostTracker {
  // Check if budget allows this call
  async canAfford(estimatedCost: number): Promise<boolean>;

  // Record a completed API call (uses atomic INCRBYFLOAT)
  async recordCost(record: CostRecord): Promise<void>;

  // Get current budget status
  async getBudgetStatus(): Promise<BudgetStatus>;

  // Reset daily budget (uses Lua script for atomicity - Priority 1 fix)
  async resetDailyBudget(): Promise<void>;

  // Get spending report
  async getSpendingReport(days: number): Promise<SpendingReport>;
}
```

**Atomic Budget Reset** (Priority 1 Fix):
```typescript
// Lua script for atomic daily budget reset
const RESET_BUDGET_SCRIPT = `
  local today = ARGV[1]
  local yesterday = ARGV[2]

  -- Archive yesterday's data
  local yesterdayTotal = redis.call('GET', 'cost:daily:' .. yesterday) or '0'
  redis.call('SET', 'cost:archive:' .. yesterday, yesterdayTotal)

  -- Delete yesterday's keys
  redis.call('DEL', 'cost:daily:' .. yesterday)
  redis.call('DEL', 'cost:daily:' .. yesterday .. ':claude')
  redis.call('DEL', 'cost:daily:' .. yesterday .. ':openai')
  redis.call('DEL', 'cost:daily:' .. yesterday .. ':deepseek')

  -- Initialize today's keys if they don't exist
  redis.call('SETNX', 'cost:daily:' .. today, '0')
  redis.call('SETNX', 'cost:daily:' .. today .. ':claude', '0')
  redis.call('SETNX', 'cost:daily:' .. today .. ':openai', '0')
  redis.call('SETNX', 'cost:daily:' .. today .. ':deepseek', '0')

  return 1
`;

async resetDailyBudget(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  await redis.eval(RESET_BUDGET_SCRIPT, [], [today, yesterday]);
  logger.info('Daily budget reset completed', { today, yesterday });
}
```

**Atomic Cost Recording**:
```typescript
async recordCost(record: CostRecord): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7); // YYYY-MM

  // Use INCRBYFLOAT for atomic increment (no race conditions)
  await Promise.all([
    redis.incrByFloat(`cost:daily:${today}`, record.costUSD),
    redis.incrByFloat(`cost:daily:${today}:${record.provider}`, record.costUSD),
    redis.incrByFloat(`cost:monthly:${month}`, record.costUSD),

    // Store individual record for auditing
    redis.set(
      `cost:record:${record.timestamp}:${record.userId}`,
      JSON.stringify(record),
      { expiration: 2592000 } // 30 days
    )
  ]);
}
```

---

### 7. AI Prompts (`src/ai/prompts.ts`)

**Purpose**: Analysis prompts for detecting problematic behavior

**Design Principles**:
- Provider-agnostic (work with Claude, OpenAI, DeepSeek)
- Clear instructions with examples
- Request structured output
- Include confidence scoring
- Explain reasoning

**Main Prompt Template**:

```typescript
const ANALYSIS_PROMPT = `You are a content moderation AI analyzing a Reddit user's profile and posting history to detect problematic behavior.

USER PROFILE:
- Username: {username}
- Account age: {accountAge} days
- Comment karma: {commentKarma}
- Post karma: {postKarma}
- Email verified: {emailVerified}

POSTING HISTORY (last 20 posts/comments):
{postHistory}

CURRENT POST:
Subreddit: {subreddit}
Title: {title}
Body: {body}

SUBREDDIT CONTEXT:
This is being posted to r/{subreddit}, which is {subredditDescription}.

YOUR TASK:
Analyze this user and their current post for the following red flags:

1. DATING INTENT
   - Are they using a friendship subreddit to seek romantic/sexual relationships?
   - Look for: flirting, asking for DMs, relationship-seeking language, compliments focused on appearance
   - Confidence: 0-100 (how certain are you?)

2. SCAMMER PATTERNS
   - Common scam indicators: sob stories, financial requests, crypto mentions, external links, urgency
   - Grammar issues combined with suspicious behavior
   - Profile inconsistencies
   - Risk level: NONE / LOW / MEDIUM / HIGH
   - Confidence: 0-100

3. AGE ESTIMATION (for FriendsOver40/50 subreddits only)
   - Does their language, interests, or behavior suggest they might be underage?
   - Look for: teen slang, high school references, age-inappropriate interests
   - Only flag if confidence > 85%

4. SPAM INDICATORS
   - Repetitive posts, promotional content, external links, off-topic content
   - Confidence: 0-100

RESPOND WITH JSON:
{
  "datingIntent": {
    "detected": boolean,
    "confidence": number,
    "reasoning": "brief explanation"
  },
  "scammerRisk": {
    "level": "NONE" | "LOW" | "MEDIUM" | "HIGH",
    "confidence": number,
    "patterns": ["pattern1", "pattern2"],
    "reasoning": "brief explanation"
  },
  "ageEstimate": {
    "appearsUnderage": boolean,
    "confidence": number,
    "reasoning": "brief explanation",
    "estimatedAge": "under-18" | "18-25" | "25-40" | "40+"
  },
  "spamIndicators": {
    "detected": boolean,
    "confidence": number,
    "patterns": ["pattern1", "pattern2"]
  },
  "overallRisk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedAction": "APPROVE" | "FLAG" | "REMOVE"
}
`;
```

**Prompt Building**:
- Template-based system
- Inject user data, post history, context
- Customize based on subreddit type
- Include relevant examples for each detection type

**Prompt Versioning** (Priority 2 - NEW):
```typescript
const PROMPT_VERSIONS: Record<string, PromptVersion> = {
  'v1.0': {
    version: 'v1.0',
    prompt: ANALYSIS_PROMPT, // Base prompt from above
    enabled: true,
    weight: 80, // 80% of users get this version
    createdAt: Date.now(),
    metrics: {
      uses: 0,
      accuracy: undefined,
      falsePositiveRate: undefined
    }
  },
  'v1.1-dating-focus': {
    version: 'v1.1-dating-focus',
    prompt: DATING_FOCUSED_PROMPT, // Enhanced dating detection
    enabled: true,
    weight: 20, // 20% of users get this experimental version
    createdAt: Date.now(),
    metrics: {
      uses: 0
    }
  }
};

class PromptManager {
  /**
   * Select prompt version for user (A/B testing)
   * Uses consistent hashing based on userId for stable assignments
   */
  selectPromptVersion(userId: string): PromptVersion {
    const hash = hashUserId(userId); // 0-99
    let cumulative = 0;

    for (const [version, config] of Object.entries(PROMPT_VERSIONS)) {
      if (!config.enabled) continue;

      cumulative += config.weight;
      if (hash < cumulative) {
        return config;
      }
    }

    // Fallback to v1.0
    return PROMPT_VERSIONS['v1.0'];
  }

  /**
   * Record prompt usage and outcome for metrics
   */
  async recordUsage(version: string, outcome: 'correct' | 'false_positive' | 'false_negative'): Promise<void> {
    // Track metrics in Redis for analysis
    await redis.hincrby(`prompt:${version}:metrics`, 'uses', 1);
    await redis.hincrby(`prompt:${version}:metrics`, outcome, 1);
  }
}
```

---

### 8. Provider Selector (`src/ai/selector.ts`)

**Purpose**: Choose which AI provider to use

**Selection Strategy**:

1. **Primary Provider**: Based on configuration
   - Default: Claude 3.5 Haiku (best quality)
   - Can be overridden per-subreddit

2. **Fallback Chain**:
   - Claude fails → Try OpenAI
   - OpenAI fails → Try DeepSeek
   - All fail → Return error, FLAG for manual review

3. **Health Checking**:
   - Periodic health checks (every 5 minutes)
   - Cache health status
   - Skip unhealthy providers automatically

4. **A/B Testing Mode** (for Week 2 testing):
   - Random selection based on user ID hash
   - Track results by provider
   - Compare quality vs cost

**API**:
```typescript
class ProviderSelector {
  // Select best available provider
  async selectProvider(): Promise<IAIProvider>;

  // Health check all providers
  async checkAllProviders(): Promise<Record<AIProviderType, boolean>>;

  // Enable A/B testing mode
  setABTestMode(enabled: boolean, distribution: Record<AIProviderType, number>): void;
}
```

---

### 9. Circuit Breaker (`src/ai/circuitBreaker.ts`) - NEW (Priority 1)

**Purpose**: Prevent cascading failures by temporarily blocking calls to failed providers

**Pattern**: Circuit Breaker Pattern

**States**:
1. **CLOSED**: Normal operation, all requests pass through
2. **OPEN**: Provider failing, block all requests (fast-fail)
3. **HALF_OPEN**: Testing if provider recovered

**Configuration**:
```typescript
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Open circuit after 5 consecutive failures
  halfOpenRetryDelay: 30000,  // Wait 30s before testing recovery
  successThreshold: 2,        // Close circuit after 2 consecutive successes
  timeout: 10000              // Consider request failed after 10s
};
```

**State Transitions**:
```
CLOSED --[5 failures]--> OPEN --[30s wait]--> HALF_OPEN --[2 successes]--> CLOSED
                                                   |
                                           [failure] --> OPEN
```

**API**:
```typescript
class CircuitBreaker {
  async execute<T>(
    provider: AIProviderType,
    operation: () => Promise<T>
  ): Promise<T>;

  async getState(provider: AIProviderType): Promise<CircuitBreakerState>;

  async reset(provider: AIProviderType): Promise<void>;

  private async recordSuccess(provider: AIProviderType): Promise<void>;
  private async recordFailure(provider: AIProviderType): Promise<void>;
}
```

**Redis Storage**:
```typescript
`circuit:{provider}:state` → 'CLOSED' | 'OPEN' | 'HALF_OPEN'
`circuit:{provider}:failures` → failure count
`circuit:{provider}:successes` → success count (in HALF_OPEN)
`circuit:{provider}:openUntil` → timestamp when HALF_OPEN allowed
```

---

### 10. Request Deduplication (`src/ai/requestCoalescer.ts`) - NEW (Priority 1)

**Purpose**: Prevent multiple simultaneous AI calls for the same user

**Problem**: If user posts twice quickly, both requests could trigger AI analysis

**Solution**: Use Redis SETNX to track in-flight requests

**Implementation**:
```typescript
class RequestCoalescer {
  /**
   * Attempt to acquire lock for user analysis
   * Returns true if lock acquired, false if already in progress
   */
  async acquireLock(userId: string, correlationId: string): Promise<boolean> {
    const key = `ai:inflight:${userId}`;
    const value = JSON.stringify({
      userId,
      correlationId,
      startTime: Date.now(),
      expiresAt: Date.now() + 30000 // 30s expiry
    });

    // SETNX with 30s expiry (atomic operation)
    const acquired = await redis.setNX(key, value, { expiration: 30 });
    return acquired;
  }

  /**
   * Release lock after analysis completes
   */
  async releaseLock(userId: string): Promise<void> {
    const key = `ai:inflight:${userId}`;
    await redis.del(key);
  }

  /**
   * Wait for in-flight request to complete, then return cached result
   */
  async waitForResult(userId: string, maxWaitMs: number = 30000): Promise<AIAnalysisResult | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      // Check if analysis is cached yet
      const result = await getCachedAnalysis(userId);
      if (result) return result;

      // Wait 500ms before checking again
      await sleep(500);
    }
    return null; // Timeout
  }
}
```

**Usage Flow**:
```typescript
// In AI Analyzer
const lockAcquired = await coalescer.acquireLock(userId, correlationId);

if (!lockAcquired) {
  // Another request is analyzing this user
  logger.info('Request coalesced, waiting for result', { userId, correlationId });
  const result = await coalescer.waitForResult(userId);
  return result;
}

try {
  // Perform analysis
  const result = await analyzeWithAI(...);

  // Cache result
  await cacheResult(userId, result);

  return result;
} finally {
  // Always release lock
  await coalescer.releaseLock(userId);
}
```

---

### 11. Response Validation (`src/ai/validator.ts`) - NEW (Priority 1)

**Purpose**: Validate AI responses match expected schema using Zod

**Problem**: AI providers may return malformed or invalid JSON

**Solution**: Runtime validation with detailed error reporting

**Zod Schema**:
```typescript
import { z } from 'zod';

const AIAnalysisResultSchema = z.object({
  datingIntent: z.object({
    detected: z.boolean(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string()
  }),
  scammerRisk: z.object({
    level: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']),
    confidence: z.number().min(0).max(100),
    patterns: z.array(z.string()),
    reasoning: z.string()
  }),
  ageEstimate: z.object({
    appearsUnderage: z.boolean(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
    estimatedAge: z.enum(['under-18', '18-25', '25-40', '40+']).optional()
  }).optional(),
  spamIndicators: z.object({
    detected: z.boolean(),
    confidence: z.number().min(0).max(100),
    patterns: z.array(z.string())
  }),
  overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  recommendedAction: z.enum(['APPROVE', 'FLAG', 'REMOVE'])
});

class AIResponseValidator {
  validate(rawResponse: unknown): AIAnalysisResult {
    try {
      const parsed = AIAnalysisResultSchema.parse(rawResponse);
      return parsed as AIAnalysisResult;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('AI response validation failed', {
          errors: error.errors,
          rawResponse: JSON.stringify(rawResponse)
        });
        throw new AIError(AIErrorType.VALIDATION_ERROR, error.message);
      }
      throw error;
    }
  }

  /**
   * Partial validation for recovery attempts
   * Returns best-effort parsed result with warnings
   */
  validatePartial(rawResponse: unknown): { result: Partial<AIAnalysisResult>, warnings: string[] } {
    // Attempt to salvage what we can from malformed response
    // ...
  }
}
```

---

### 12. Content Sanitizer (`src/ai/sanitizer.ts`) - NEW (Priority 2)

**Purpose**: Remove PII and sensitive data before sending to AI

**What to Remove**:
- Email addresses (regex: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g`)
- Phone numbers (various formats)
- URLs (to prevent data leakage)
- Credit card numbers
- Social security numbers

**Implementation**:
```typescript
class ContentSanitizer {
  sanitize(content: string): SanitizationResult {
    let sanitized = content;
    let piiRemoved = 0;
    let urlsRemoved = 0;

    // Remove emails
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    piiRemoved += (content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).length;

    // Remove URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    urlsRemoved += (content.match(/https?:\/\/[^\s]+/g) || []).length;

    // Remove phone numbers (US format)
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

    // Truncate if too long (>5000 chars)
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000) + '... [truncated]';
    }

    return {
      originalLength: content.length,
      sanitizedLength: sanitized.length,
      piiRemoved,
      urlsRemoved,
      sanitizedContent: sanitized
    };
  }
}
```

---

### 13. AI Analyzer (`src/ai/analyzer.ts`)

**Purpose**: Main orchestrator for AI analysis

**Responsibilities**:
1. Check cache for existing analysis
2. Check budget before calling AI
3. Select provider
4. Build analysis request
5. Call provider with retry logic
6. Parse and validate response
7. Record cost
8. Cache result
9. Return structured analysis

**Caching Strategy** (Enhanced with Differential TTL - Priority 2):

**Differential Cache TTL Based on Trust Score**:
```typescript
function calculateCacheTTL(trustScore: number, analysisRisk: string): number {
  // High trust users (60-69): Cache longer (48h)
  if (trustScore >= 60 && trustScore < 70) {
    return 48 * 3600; // 48 hours
  }

  // Medium trust users (40-59): Standard cache (24h)
  if (trustScore >= 40 && trustScore < 60) {
    return 24 * 3600; // 24 hours
  }

  // Low trust users (<40): Shorter cache (12h)
  if (trustScore < 40 && analysisRisk === 'LOW') {
    return 12 * 3600; // 12 hours
  }

  // Known bad actors (HIGH/CRITICAL risk): Long cache (7 days)
  if (analysisRisk === 'HIGH' || analysisRisk === 'CRITICAL') {
    return 7 * 24 * 3600; // 7 days
  }

  // Default: 24 hours
  return 24 * 3600;
}
```

**Redis Keys**:
```typescript
`ai:analysis:{userId}` → AIAnalysisResult (TTL: variable 12h-7d)
`ai:analysis:{userId}:timestamp` → last analysis time
`ai:analysis:{userId}:ttl` → cache TTL used (for debugging)
```

**Cache Invalidation**:
- Automatic after TTL expires (variable based on trust score)
- Manual invalidation if user behavior changes significantly
- Clear on moderator action (if user is banned/approved)
- Clear on user deletion

**Error Handling**:

1. **Budget Exceeded**:
   - Log warning
   - Return error
   - Recommend FLAG action

2. **All Providers Failed**:
   - Log error with details
   - Return error
   - Recommend FLAG for manual review

3. **Invalid Response**:
   - Log response for debugging
   - Retry with different provider
   - If all fail, return error + FLAG

**API**:
```typescript
class AIAnalyzer {
  /**
   * Analyze user and return risk assessment
   * Handles caching, budgeting, provider selection
   */
  async analyzeUser(
    userId: string,
    profile: UserProfile,
    postHistory: PostHistorySummary,
    currentPost: PostData,
    subreddit: string
  ): Promise<AIAnalysisResult | null>;

  /**
   * Clear cached analysis for a user
   */
  async clearCache(userId: string): Promise<void>;

  /**
   * Get analysis if cached
   */
  async getCachedAnalysis(userId: string): Promise<AIAnalysisResult | null>;
}
```

---

## Integration with Existing System

### PostSubmit Handler Flow (Updated)

```typescript
// src/handlers/postSubmit.ts

export async function handlePostSubmit(event: PostSubmit, context: Devvit.Context) {
  const { post, author } = event;

  // 1. Check if user is trusted (existing logic)
  const trustCheck = await checkTrustedUser(author.id, context);
  if (trustCheck.isTrusted) {
    await audit.logAction({
      action: 'APPROVE',
      reason: `Trusted user (score: ${trustCheck.score})`,
      cost: 0
    });
    return; // Approve immediately
  }

  // 2. Fetch profile and history (existing logic)
  const [profile, history] = await Promise.all([
    profileFetcher.fetchProfile(author.id, context),
    historyAnalyzer.analyzeHistory(author.id, context)
  ]);

  // 3. NEW: AI Analysis
  const aiAnalyzer = new AIAnalyzer(context);
  const analysis = await aiAnalyzer.analyzeUser(
    author.id,
    profile,
    history,
    {
      title: post.title,
      body: post.body || '',
      subreddit: post.subreddit.name
    },
    post.subreddit.name
  );

  // 4. Evaluate result and take action
  if (!analysis) {
    // AI unavailable or budget exceeded - flag for manual review
    await post.remove();
    await audit.logAction({
      action: 'FLAG',
      reason: 'AI analysis unavailable - manual review required',
      cost: 0
    });
    return;
  }

  // 5. Apply rules based on AI analysis
  if (analysis.datingIntent.detected && analysis.datingIntent.confidence > 80) {
    await post.remove();
    await post.addComment({
      text: `Your post has been removed. ${post.subreddit.name} is for making friends, not dating.`
    });
    await audit.logAction({
      action: 'REMOVE',
      reason: `Dating intent detected (confidence: ${analysis.datingIntent.confidence}%)`,
      cost: analysis.costUSD,
      aiProvider: analysis.provider
    });
    return;
  }

  if (analysis.scammerRisk.level === 'HIGH' && analysis.scammerRisk.confidence > 75) {
    await post.remove();
    await audit.logAction({
      action: 'FLAG',
      reason: `High scammer risk (confidence: ${analysis.scammerRisk.confidence}%): ${analysis.scammerRisk.reasoning}`,
      cost: analysis.costUSD,
      aiProvider: analysis.provider
    });
    return;
  }

  if (analysis.ageEstimate?.appearsUnderage && analysis.ageEstimate.confidence > 85) {
    await post.remove();
    await audit.logAction({
      action: 'FLAG',
      reason: `Appears underage (confidence: ${analysis.ageEstimate.confidence}%)`,
      cost: analysis.costUSD,
      aiProvider: analysis.provider
    });
    return;
  }

  // 6. If no red flags, approve
  await audit.logAction({
    action: 'APPROVE',
    reason: `AI analysis passed (risk: ${analysis.overallRisk})`,
    cost: analysis.costUSD,
    aiProvider: analysis.provider
  });

  // 7. Update trust score (existing logic)
  await updateTrustScore(author.id, 'post_approved', context);
}
```

---

## Configuration

### Environment Variables (Required)

```bash
# Claude (Primary)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (Fallback)
OPENAI_API_KEY=sk-...

# DeepSeek (Testing)
DEEPSEEK_API_KEY=sk-...

# Budget Configuration
AI_DAILY_BUDGET_USD=5.00
AI_MONTHLY_BUDGET_USD=150.00

# Provider Priority (comma-separated)
AI_PROVIDER_PRIORITY=claude,openai,deepseek

# A/B Testing (for Week 2)
AI_AB_TEST_ENABLED=false
AI_AB_TEST_DISTRIBUTION=claude:40,openai:30,deepseek:30
```

### Config File (`src/config/ai.ts`)

```typescript
export const AI_CONFIG = {
  providers: {
    claude: {
      type: 'claude' as const,
      model: 'claude-3-5-haiku-20241022',
      enabled: true,
      priority: 1,
      costPerMTokenInput: 1.00,
      costPerMTokenOutput: 5.00
    },
    openai: {
      type: 'openai' as const,
      model: 'gpt-4o-mini',
      enabled: true,
      priority: 2,
      costPerMTokenInput: 0.15,
      costPerMTokenOutput: 0.60
    },
    deepseek: {
      type: 'deepseek' as const,
      model: 'deepseek-chat',
      enabled: true,
      priority: 3,
      costPerMTokenInput: 0.27,
      costPerMTokenOutput: 1.10
    }
  },

  budget: {
    dailyLimitUSD: 5.00,
    monthlyLimitUSD: 150.00,
    alertThresholds: [0.5, 0.75, 0.9] // 50%, 75%, 90%
  },

  caching: {
    analysisTTL: 86400, // 24 hours in seconds
    healthCheckTTL: 300 // 5 minutes
  },

  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  }
};
```

---

## Error Handling Strategy

### Error Types

1. **Budget Exceeded**:
   - Action: Return null, log warning
   - PostSubmit: FLAG for manual review
   - User notification: None (mod notification only)

2. **All Providers Failed**:
   - Action: Return null, log error
   - PostSubmit: FLAG for manual review
   - Alert: Notify mods of system issue

3. **Invalid AI Response**:
   - Action: Retry with different provider
   - If all fail: Return null, FLAG
   - Log: Full response for debugging

4. **API Rate Limit**:
   - Action: Exponential backoff retry
   - Max 3 attempts
   - If fails: Try next provider

5. **Network Timeout**:
   - Action: Retry with backoff
   - Try next provider
   - Ultimate fallback: FLAG

### Fail-Safe Principles

- **Never auto-approve** on AI failure
- **Always FLAG** when uncertain
- **Log everything** for debugging
- **Alert mods** on system issues
- **Degrade gracefully** (FLAG > REMOVE > BAN)

---

## Performance Considerations

### Expected Latency

1. **Cache Hit** (trusted user): ~50-100ms
2. **Cache Hit** (AI cached): ~200-300ms
3. **Cache Miss** (full AI analysis):
   - Profile fetch: ~200ms
   - History fetch: ~300ms
   - AI call: ~1000-2000ms
   - **Total**: ~1500-2500ms

### Optimization Strategies

1. **Parallel Fetching**: Profile + History fetched simultaneously
2. **Aggressive Caching**: 24h TTL on AI analysis
3. **Trust Scores**: Bypass AI for returning users
4. **Early Returns**: Trusted users skip all analysis
5. **Provider Selection**: Prefer faster providers when quality is similar

### Scaling Considerations

- Redis caching prevents duplicate analysis
- Budget limits prevent runaway costs
- Health checking prevents cascading failures
- Multi-provider strategy distributes load

---

## Testing Strategy

### Week 1: Implementation & Unit Tests

1. **Unit Tests** (per component):
   - Cost tracker: Budget enforcement, tracking accuracy
   - Each provider: API calls, response parsing, error handling
   - Provider selector: Selection logic, health checking
   - AI analyzer: Caching, retry logic, integration

2. **Integration Tests**:
   - Full flow: Profile → AI → Action
   - Fallback chain: Claude fails → OpenAI → DeepSeek
   - Budget exceeded scenario
   - Cache hit/miss scenarios

### Week 2: A/B Testing with Real Data

1. **Test Cohorts**:
   - Group A: Claude only (40% of users)
   - Group B: OpenAI only (30% of users)
   - Group C: DeepSeek only (30% of users)

2. **Metrics to Track**:
   - Detection accuracy (manual review of 100 decisions each)
   - False positive rate
   - False negative rate
   - Average cost per analysis
   - Average latency
   - Provider reliability (uptime, error rate)

3. **Decision Criteria**:
   - Accuracy threshold: >90% correct decisions
   - Acceptable false positive rate: <10%
   - Cost vs quality tradeoff
   - Provider reliability (>99% uptime)

---

## Security Considerations

### API Key Management (CRITICAL - Priority 1)

**Using Devvit Secrets Manager** (NOT environment variables):

```typescript
// In Devvit app configuration
export default Devvit.configure({
  redditAPI: true,
  redis: true,
  http: {
    allowedDomains: ['api.anthropic.com', 'api.openai.com', 'api.deepseek.com']
  },
  secrets: {
    ANTHROPIC_API_KEY: 'Claude API key',
    OPENAI_API_KEY: 'OpenAI API key',
    DEEPSEEK_API_KEY: 'DeepSeek API key'
  }
});

// Accessing secrets at runtime
const anthropicKey = await context.settings.get('ANTHROPIC_API_KEY');
const openaiKey = await context.settings.get('OPENAI_API_KEY');
const deepseekKey = await context.settings.get('DEEPSEEK_API_KEY');
```

**Security Principles**:
- ✅ Use Devvit Secrets Manager for all API keys
- ❌ NEVER store keys in code, config files, or environment variables
- ✅ Access keys only at runtime through context.settings
- ✅ Never log API keys
- ✅ Rotate keys quarterly
- ✅ Use separate keys for dev/test/prod
- ✅ Keys encrypted at rest by Devvit platform

### Data Privacy

- Only analyze public Reddit data
- No PII storage beyond Reddit usernames
- AI responses stored for 24h only
- Audit logs redacted of sensitive content

### Rate Limiting

- Respect AI provider rate limits
- Exponential backoff on errors
- Budget limits prevent abuse
- Health checks prevent hammering failed providers

---

## Success Criteria

### Phase 2 Complete When:

1. ✅ All 8 components implemented
2. ✅ Unit tests pass for all components
3. ✅ Integration tests pass
4. ✅ Deployed to playtest subreddit
5. ✅ Successfully analyzes test posts
6. ✅ Cost tracking working correctly
7. ✅ Budget enforcement working
8. ✅ Fallback mechanism tested
9. ✅ Documentation updated
10. ✅ Committed to git

### Ready for Week 2 Testing When:

1. ✅ A/B test configuration working
2. ✅ Metrics collection implemented
3. ✅ Test cohorts defined
4. ✅ Manual review process established
5. ✅ 200+ user dataset available

---

## Open Questions

1. **Provider Priority**: Start with Claude or test all three immediately?
   - **Recommendation**: Implement all three, start with Claude as primary

2. **Cache Invalidation**: When should we clear user analysis cache?
   - On moderator action (ban/approve)
   - On user deletion
   - After 24h (TTL)

3. **Confidence Thresholds**: Are 80%/75%/85% the right thresholds?
   - **Answer**: Start conservative, adjust based on false positive rate

4. **Response Times**: Is 2-3s acceptable for post submission?
   - **Answer**: Yes for new users, <100ms for trusted users is acceptable

---

## Next Steps

Design approved! Ready for implementation:

1. ✅ Design complete with all critical fixes
2. ⏭️ Create type definitions (src/types/ai.ts)
3. ⏭️ Deploy javascript-pro agent to implement each component:
   - Circuit Breaker
   - Request Coalescer
   - Response Validator
   - Content Sanitizer
   - Cost Tracker (with atomic operations)
   - Prompt Manager (with versioning)
   - Provider clients (Claude, OpenAI, DeepSeek)
   - Provider Selector
   - AI Analyzer (orchestrator)
4. ⏭️ Deploy code-reviewer after implementation
5. ⏭️ Build and test locally
6. ⏭️ Deploy to playtest
7. ⏭️ Update documentation
8. ⏭️ Commit to git

---

**Status**: ✅ Architect-Approved - Ready for Implementation

**Components to Build**: 13 total (3 providers + 10 supporting components)
**Estimated Implementation Time**: 1-2 weeks
**All Priority 1 Critical Issues**: ✅ Addressed in design
