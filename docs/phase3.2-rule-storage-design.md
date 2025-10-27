# Phase 3.2: Rule Storage & Configuration - Architecture Design

**Created**: 2025-10-27
**Status**: Design Phase
**Dependencies**: Phase 3.1 (Custom AI Questions - Completed)

## Table of Contents
1. [Overview](#overview)
2. [Type System](#type-system)
3. [Field Reference Model](#field-reference-model)
4. [Redis Storage Schema](#redis-storage-schema)
5. [Condition Evaluation Algorithm](#condition-evaluation-algorithm)
6. [Rules Engine Execution Flow](#rules-engine-execution-flow)
7. [Default Rule Sets](#default-rule-sets)
8. [Variable Substitution](#variable-substitution)
9. [Error Handling Strategy](#error-handling-strategy)
10. [Performance Considerations](#performance-considerations)

---

## Overview

### Purpose
Design a flexible, type-safe rules engine that:
- Evaluates both hard rules (karma, regex, etc.) and AI-powered rules
- Supports complex nested conditions with AND/OR logic
- Determines moderation actions (APPROVE, FLAG, REMOVE, COMMENT)
- Integrates with the existing AI analysis system

### Key Design Principles
1. **Type Safety**: Full TypeScript support with compile-time validation
2. **Performance**: Efficient Redis queries, O(n) rule evaluation
3. **Flexibility**: Support for complex nested conditions
4. **Maintainability**: Clear separation between rule types and evaluation logic
5. **Extensibility**: Easy to add new operators, field types, or rule types

### Architecture Layers
```
┌─────────────────────────────────────────┐
│         API Layer (Express)             │
│  POST /rules, GET /rules, PUT /rules    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Rules Service (Business Logic)     │
│  - Rule validation                      │
│  - Rule evaluation orchestration        │
│  - Action determination                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│     Condition Evaluator (Pure Logic)    │
│  - Nested condition evaluation          │
│  - Operator implementations             │
│  - Type-safe field access               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Redis Storage (Persistence)        │
│  - Rule storage by subreddit            │
│  - Priority-based retrieval             │
└─────────────────────────────────────────┘
```

---

## Type System

### Core Rule Types

```typescript
/**
 * Base rule interface - common fields for all rule types
 */
interface BaseRule {
  id: string;                              // UUID
  name: string;                            // Human-readable name
  description?: string;                    // Optional detailed description
  type: 'HARD' | 'AI';                    // Rule type discriminator
  enabled: boolean;                        // Active/inactive toggle
  priority: number;                        // Higher = evaluated first (1-1000)
  subreddit: string | null;               // null = applies globally
  conditions: Condition;                   // Root condition tree
  action: ModeratorAction;                // Action to take if matched
  actionConfig: ActionConfig;             // Action configuration
  createdAt: Date;                        // Creation timestamp
  updatedAt: Date;                        // Last update timestamp
  createdBy: string;                      // Username who created rule
}

/**
 * Hard rule - evaluates without AI analysis
 * Examples: karma checks, regex patterns, domain filtering
 */
interface HardRule extends BaseRule {
  type: 'HARD';
}

/**
 * AI rule - requires AI analysis to evaluate
 * Must reference at least one AI question in conditions
 */
interface AIRule extends BaseRule {
  type: 'AI';
  aiQuestionIds: string[];                // Questions this rule depends on
  minimumConfidence?: number;             // Optional: require min confidence (0-100)
}

/**
 * Union type for type-safe rule handling
 */
type Rule = HardRule | AIRule;

/**
 * Possible moderation actions
 */
type ModeratorAction =
  | 'APPROVE'      // Explicitly approve post
  | 'FLAG'         // Flag for manual review
  | 'REMOVE'       // Auto-remove post
  | 'COMMENT';     // Post automated comment

/**
 * Action configuration
 */
interface ActionConfig {
  reason: string;                         // Reason for action (supports variables)
  comment?: string | null;                // Comment text for COMMENT action
  variables?: Record<string, string>;     // Custom variables for substitution
  sticky?: boolean;                       // Sticky comment (COMMENT action only)
  distinguish?: boolean;                  // Distinguish as mod (COMMENT action only)
  notifyUser?: boolean;                   // Send PM to user
  notificationTemplate?: string;          // PM template
}
```

### Condition System

```typescript
/**
 * Condition - supports both leaf conditions and nested logical operators
 *
 * Leaf condition example:
 * { field: "profile.commentKarma", operator: ">=", value: 100 }
 *
 * Nested condition example:
 * {
 *   operator: "AND",
 *   conditions: [
 *     { field: "profile.commentKarma", operator: ">=", value: 100 },
 *     { field: "profile.accountAgeInDays", operator: ">=", value: 30 }
 *   ]
 * }
 */
type Condition = LeafCondition | NestedCondition;

/**
 * Leaf condition - compares a field to a value
 */
interface LeafCondition {
  field: FieldPath;                       // Dot-notation field path
  operator: ConditionOperator;            // Comparison operator
  value: FieldValue;                      // Expected value
  caseInsensitive?: boolean;              // For text operators
}

/**
 * Nested condition - combines multiple conditions with AND/OR
 */
interface NestedCondition {
  operator: 'AND' | 'OR';                 // Logical operator
  conditions: Condition[];                // Child conditions (min 2)
}

/**
 * All supported operators
 */
type ConditionOperator =
  // Numeric comparison
  | '<' | '>' | '<=' | '>=' | '==' | '!='
  // Text matching
  | 'contains' | 'not_contains'           // Case-sensitive
  | 'contains_i' | 'not_contains_i'       // Case-insensitive
  | 'starts_with' | 'ends_with'
  | 'starts_with_i' | 'ends_with_i'
  // Array membership
  | 'in' | 'not_in'
  // Pattern matching
  | 'regex' | 'regex_i'
  // Boolean
  | 'is_true' | 'is_false'
  // Existence
  | 'exists' | 'not_exists';

/**
 * Field paths - dot notation for nested access
 * Examples:
 * - "profile.commentKarma"
 * - "currentPost.title"
 * - "aiAnalysis.answers.q_dating_intent.confidence"
 */
type FieldPath = string;

/**
 * Possible field values
 */
type FieldValue = string | number | boolean | string[] | null;
```

### Evaluation Context

```typescript
/**
 * Complete context passed to rule evaluation
 * Contains all data needed to evaluate both hard and AI rules
 */
interface EvaluationContext {
  profile: UserProfile;
  postHistory: PostHistory;
  currentPost: CurrentPost;
  aiAnalysis?: AIAnalysisResult;          // Optional - only for AI rules
  subreddit: string;
  timestamp: Date;
}

/**
 * User profile data from Reddit
 */
interface UserProfile {
  username: string;
  accountAgeInDays: number;
  commentKarma: number;
  postKarma: number;
  totalKarma: number;                     // commentKarma + postKarma
  emailVerified: boolean;
  isModerator: boolean;
  hasUserFlair: boolean;
  userFlairText: string | null;
  hasPremium: boolean;
  isVerified: boolean;
  isSuspended: boolean;
}

/**
 * User's post history in this subreddit
 */
interface PostHistory {
  totalPosts: number;
  totalComments: number;
  subreddits: string[];                   // All subreddits user has posted in
  postsInThisSubreddit: number;
  commentsInThisSubreddit: number;
  firstPostDate: Date | null;
  lastPostDate: Date | null;
}

/**
 * Current post being evaluated
 */
interface CurrentPost {
  id: string;
  title: string;
  body: string;
  type: PostType;
  urls: string[];                         // All URLs found in post
  domains: string[];                      // Unique domains from URLs
  wordCount: number;                      // Word count (title + body)
  charCount: number;                      // Character count
  bodyLength: number;                     // Body length only
  titleLength: number;                    // Title length only
  hasMedia: boolean;
  linkUrl: string | null;                 // Primary link for link posts
  isEdited: boolean;
  hasUserFlair: boolean;
  postFlairText: string | null;
  createdAt: Date;
}

type PostType = 'text' | 'link' | 'image' | 'video' | 'gallery' | 'poll';

/**
 * AI analysis result structure (from Phase 3.1)
 */
interface AIAnalysisResult {
  answers: Record<string, QuestionAnswer>;
  provider: string;
  model: string;
  totalTokens: number;
  analyzedAt: Date;
}

interface QuestionAnswer {
  questionId: string;
  questionText: string;
  answer: 'YES' | 'NO';
  confidence: number;                     // 0-100
  reasoning: string;
}
```

### Rule Evaluation Result

```typescript
/**
 * Result of rule evaluation
 */
interface RuleEvaluationResult {
  action: ModeratorAction;
  reason: string;                         // With variables substituted
  comment?: string | null;                // With variables substituted
  matchedRuleId: string | null;           // null if no rules matched
  matchedRuleName: string | null;
  confidence: number;                     // 0-100 (from AI or 100 for hard rules)
  executionTimeMs: number;
  rulesEvaluated: number;
  aiAnalysisUsed: boolean;
}
```

---

## Field Reference Model

### Available Fields by Category

#### Profile Fields (`profile.*`)
| Field Path | Type | Description | Example |
|------------|------|-------------|---------|
| `profile.username` | string | Reddit username | "user123" |
| `profile.accountAgeInDays` | number | Account age in days | 365 |
| `profile.commentKarma` | number | Comment karma | 1500 |
| `profile.postKarma` | number | Post karma | 500 |
| `profile.totalKarma` | number | Total karma | 2000 |
| `profile.emailVerified` | boolean | Email verified | true |
| `profile.isModerator` | boolean | Is mod anywhere | true |
| `profile.hasUserFlair` | boolean | Has user flair | true |
| `profile.userFlairText` | string\|null | User flair text | "Verified Member" |
| `profile.hasPremium` | boolean | Has Reddit premium | false |
| `profile.isVerified` | boolean | Verified account | true |
| `profile.isSuspended` | boolean | Account suspended | false |

#### Post History Fields (`postHistory.*`)
| Field Path | Type | Description | Example |
|------------|------|-------------|---------|
| `postHistory.totalPosts` | number | Total posts ever | 50 |
| `postHistory.totalComments` | number | Total comments ever | 200 |
| `postHistory.subreddits` | string[] | Subreddits posted in | ["sub1", "sub2"] |
| `postHistory.postsInThisSubreddit` | number | Posts in current sub | 5 |
| `postHistory.commentsInThisSubreddit` | number | Comments in current sub | 20 |
| `postHistory.firstPostDate` | Date | First post date | 2024-01-01 |
| `postHistory.lastPostDate` | Date | Last post date | 2025-10-27 |

#### Current Post Fields (`currentPost.*`)
| Field Path | Type | Description | Example |
|------------|------|-------------|---------|
| `currentPost.id` | string | Post ID | "abc123" |
| `currentPost.title` | string | Post title | "Looking for friends" |
| `currentPost.body` | string | Post body | "I'm new here..." |
| `currentPost.type` | PostType | Post type | "text" |
| `currentPost.urls` | string[] | All URLs in post | ["https://..."] |
| `currentPost.domains` | string[] | Unique domains | ["example.com"] |
| `currentPost.wordCount` | number | Total word count | 150 |
| `currentPost.charCount` | number | Total char count | 800 |
| `currentPost.bodyLength` | number | Body length | 700 |
| `currentPost.titleLength` | number | Title length | 100 |
| `currentPost.hasMedia` | boolean | Contains media | false |
| `currentPost.linkUrl` | string\|null | Primary link URL | null |
| `currentPost.isEdited` | boolean | Post was edited | false |
| `currentPost.hasUserFlair` | boolean | User has flair | true |
| `currentPost.postFlairText` | string\|null | Post flair text | "Discussion" |

#### AI Analysis Fields (`aiAnalysis.answers.*`)
| Field Path | Type | Description | Example |
|------------|------|-------------|---------|
| `aiAnalysis.answers.{questionId}.answer` | 'YES'\|'NO' | AI answer | "YES" |
| `aiAnalysis.answers.{questionId}.confidence` | number | Confidence 0-100 | 85 |
| `aiAnalysis.answers.{questionId}.reasoning` | string | AI reasoning | "Post mentions..." |

Example: `aiAnalysis.answers.q_dating_intent.confidence`

### Field Path Resolution Algorithm

```typescript
/**
 * Resolves a field path to its value in the context
 * Supports dot notation: "profile.commentKarma"
 * Returns undefined if path doesn't exist
 */
function resolveFieldPath(path: FieldPath, context: EvaluationContext): FieldValue | undefined {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}
```

### Type Validation

Rules should validate field types at creation:

```typescript
/**
 * Field type registry for validation
 */
const FIELD_TYPES: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'date'> = {
  'profile.username': 'string',
  'profile.accountAgeInDays': 'number',
  'profile.commentKarma': 'number',
  'profile.postKarma': 'number',
  'profile.totalKarma': 'number',
  'profile.emailVerified': 'boolean',
  'profile.isModerator': 'boolean',
  'profile.hasUserFlair': 'boolean',
  'profile.userFlairText': 'string',
  'profile.hasPremium': 'boolean',
  'profile.isVerified': 'boolean',
  'profile.isSuspended': 'boolean',

  'postHistory.totalPosts': 'number',
  'postHistory.totalComments': 'number',
  'postHistory.subreddits': 'array',
  'postHistory.postsInThisSubreddit': 'number',
  'postHistory.commentsInThisSubreddit': 'number',

  'currentPost.title': 'string',
  'currentPost.body': 'string',
  'currentPost.type': 'string',
  'currentPost.urls': 'array',
  'currentPost.domains': 'array',
  'currentPost.wordCount': 'number',
  'currentPost.charCount': 'number',
  'currentPost.bodyLength': 'number',
  'currentPost.titleLength': 'number',
  'currentPost.hasMedia': 'boolean',
  'currentPost.linkUrl': 'string',
  'currentPost.isEdited': 'boolean',
  'currentPost.postFlairText': 'string',

  // AI analysis fields are validated dynamically
};

/**
 * Validates operator is compatible with field type
 */
const OPERATOR_TYPE_COMPATIBILITY: Record<ConditionOperator, Array<'string' | 'number' | 'boolean' | 'array'>> = {
  '<': ['number'],
  '>': ['number'],
  '<=': ['number'],
  '>=': ['number'],
  '==': ['string', 'number', 'boolean'],
  '!=': ['string', 'number', 'boolean'],
  'contains': ['string', 'array'],
  'not_contains': ['string', 'array'],
  'contains_i': ['string'],
  'not_contains_i': ['string'],
  'starts_with': ['string'],
  'ends_with': ['string'],
  'starts_with_i': ['string'],
  'ends_with_i': ['string'],
  'in': ['string', 'number'],
  'not_in': ['string', 'number'],
  'regex': ['string'],
  'regex_i': ['string'],
  'is_true': ['boolean'],
  'is_false': ['boolean'],
  'exists': ['string', 'number', 'boolean', 'array'],
  'not_exists': ['string', 'number', 'boolean', 'array'],
};
```

---

## Redis Storage Schema

### Key Structure

```
# Subreddit-specific rules
rules:{subreddit}:list          ZSET    Rule IDs sorted by priority (score = priority)
rules:{subreddit}:{ruleId}      STRING  JSON-serialized rule object

# Global rules (apply to all subreddits)
rules:global:list               ZSET    Global rule IDs sorted by priority
rules:global:{ruleId}           STRING  JSON-serialized global rule

# Rule metadata
rules:meta:{ruleId}             HASH    Metadata (created_at, updated_at, version)
rules:stats:{ruleId}            HASH    Usage statistics (matches, evaluations)

# AI question references (for dependency tracking)
rules:ai_questions:{questionId} SET     Rule IDs that depend on this question
```

### Storage Operations

#### 1. Create Rule

```
MULTI
  # Add to priority list
  ZADD rules:{subreddit}:list {priority} {ruleId}

  # Store rule object
  SET rules:{subreddit}:{ruleId} {JSON.stringify(rule)}

  # Store metadata
  HSET rules:meta:{ruleId} created_at {timestamp} version 1

  # Initialize stats
  HSET rules:stats:{ruleId} matches 0 evaluations 0

  # If AI rule, track question dependencies
  IF rule.type == 'AI':
    FOR questionId IN rule.aiQuestionIds:
      SADD rules:ai_questions:{questionId} {ruleId}
EXEC
```

#### 2. Retrieve Rules for Subreddit

```
# Get rule IDs sorted by priority (highest first)
ruleIds = ZREVRANGE rules:{subreddit}:list 0 -1

# Get global rule IDs
globalRuleIds = ZREVRANGE rules:global:list 0 -1

# Fetch all rule objects in pipeline
MULTI
  FOR ruleId IN ruleIds:
    GET rules:{subreddit}:{ruleId}
  FOR ruleId IN globalRuleIds:
    GET rules:global:{ruleId}
EXEC
```

Time Complexity: O(n log n) for ZREVRANGE, O(n) for GETs
Expected Performance: ~5ms for 100 rules

#### 3. Update Rule

```
MULTI
  # Update priority if changed
  IF priority_changed:
    ZADD rules:{subreddit}:list {new_priority} {ruleId}

  # Update rule object
  SET rules:{subreddit}:{ruleId} {JSON.stringify(updatedRule)}

  # Update metadata
  HINCRBY rules:meta:{ruleId} version 1
  HSET rules:meta:{ruleId} updated_at {timestamp}

  # Update AI question dependencies if changed
  IF rule.type == 'AI' AND aiQuestionIds_changed:
    # Remove old dependencies
    FOR oldQuestionId IN old_aiQuestionIds:
      SREM rules:ai_questions:{oldQuestionId} {ruleId}

    # Add new dependencies
    FOR newQuestionId IN new_aiQuestionIds:
      SADD rules:ai_questions:{newQuestionId} {ruleId}
EXEC
```

#### 4. Delete Rule

```
MULTI
  # Remove from priority list
  ZREM rules:{subreddit}:list {ruleId}

  # Delete rule object
  DEL rules:{subreddit}:{ruleId}

  # Delete metadata
  DEL rules:meta:{ruleId}
  DEL rules:stats:{ruleId}

  # Remove AI question dependencies
  IF rule.type == 'AI':
    FOR questionId IN rule.aiQuestionIds:
      SREM rules:ai_questions:{questionId} {ruleId}
EXEC
```

#### 5. Increment Rule Stats

```
# Async after rule evaluation (don't block)
HINCRBY rules:stats:{ruleId} evaluations 1

# If rule matched
IF matched:
  HINCRBY rules:stats:{ruleId} matches 1
```

### Example: Stored Rule

```json
{
  "id": "rule_123abc",
  "name": "Flag new low karma accounts",
  "description": "Flag posts from accounts <30 days old with <100 karma",
  "type": "HARD",
  "enabled": true,
  "priority": 150,
  "subreddit": "FriendsOver40",
  "conditions": {
    "operator": "AND",
    "conditions": [
      {
        "field": "profile.accountAgeInDays",
        "operator": "<",
        "value": 30
      },
      {
        "field": "profile.totalKarma",
        "operator": "<",
        "value": 100
      }
    ]
  },
  "action": "FLAG",
  "actionConfig": {
    "reason": "New account (<30 days) with low karma (<100)",
    "notifyUser": false
  },
  "createdAt": "2025-10-27T10:00:00Z",
  "updatedAt": "2025-10-27T10:00:00Z",
  "createdBy": "mod_user"
}
```

### Performance Optimizations

1. **Pipeline Fetches**: Fetch multiple rules in single roundtrip
2. **Lazy Loading**: Only fetch rules when needed (not on every request)
3. **TTL Caching**: Cache rule list in memory for 60 seconds
4. **Async Stats**: Update stats asynchronously to not block evaluation
5. **Compression**: Consider compressing rule JSON for large rule sets

---

## Condition Evaluation Algorithm

### Core Evaluation Engine

```typescript
/**
 * Evaluates a condition tree against a context
 * Returns true if condition matches, false otherwise
 *
 * @throws EvaluationError if field doesn't exist or type mismatch
 */
function evaluateCondition(
  condition: Condition,
  context: EvaluationContext
): boolean {
  // Nested condition (AND/OR)
  if ('conditions' in condition) {
    return evaluateNestedCondition(condition, context);
  }

  // Leaf condition (field comparison)
  return evaluateLeafCondition(condition, context);
}

/**
 * Evaluates nested AND/OR condition
 */
function evaluateNestedCondition(
  condition: NestedCondition,
  context: EvaluationContext
): boolean {
  if (condition.conditions.length < 2) {
    throw new Error('Nested condition must have at least 2 child conditions');
  }

  if (condition.operator === 'AND') {
    // All conditions must be true
    return condition.conditions.every(child =>
      evaluateCondition(child, context)
    );
  } else {
    // At least one condition must be true
    return condition.conditions.some(child =>
      evaluateCondition(child, context)
    );
  }
}

/**
 * Evaluates leaf condition (field comparison)
 */
function evaluateLeafCondition(
  condition: LeafCondition,
  context: EvaluationContext
): boolean {
  // Resolve field value from context
  const actualValue = resolveFieldPath(condition.field, context);

  // Handle existence operators
  if (condition.operator === 'exists') {
    return actualValue !== undefined && actualValue !== null;
  }
  if (condition.operator === 'not_exists') {
    return actualValue === undefined || actualValue === null;
  }

  // If field doesn't exist, condition fails
  if (actualValue === undefined || actualValue === null) {
    return false;
  }

  // Evaluate operator
  return evaluateOperator(
    actualValue,
    condition.operator,
    condition.value,
    condition.caseInsensitive
  );
}
```

### Operator Implementation

```typescript
/**
 * Evaluates an operator against actual and expected values
 * Type-safe operator evaluation with proper type coercion
 */
function evaluateOperator(
  actual: FieldValue,
  operator: ConditionOperator,
  expected: FieldValue,
  caseInsensitive?: boolean
): boolean {
  switch (operator) {
    // Numeric comparison
    case '<':
      return Number(actual) < Number(expected);
    case '>':
      return Number(actual) > Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case '>=':
      return Number(actual) >= Number(expected);

    // Equality
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;

    // Text matching (case-sensitive)
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(String(expected));
      }
      return String(actual).includes(String(expected));

    case 'not_contains':
      if (Array.isArray(actual)) {
        return !actual.includes(String(expected));
      }
      return !String(actual).includes(String(expected));

    // Text matching (case-insensitive)
    case 'contains_i':
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());

    case 'not_contains_i':
      return !String(actual).toLowerCase().includes(String(expected).toLowerCase());

    case 'starts_with':
      return String(actual).startsWith(String(expected));

    case 'ends_with':
      return String(actual).endsWith(String(expected));

    case 'starts_with_i':
      return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

    case 'ends_with_i':
      return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

    // Array membership
    case 'in':
      if (!Array.isArray(expected)) {
        throw new Error('Expected value must be an array for "in" operator');
      }
      return expected.includes(actual);

    case 'not_in':
      if (!Array.isArray(expected)) {
        throw new Error('Expected value must be an array for "not_in" operator');
      }
      return !expected.includes(actual);

    // Pattern matching
    case 'regex': {
      const regex = new RegExp(String(expected));
      return regex.test(String(actual));
    }

    case 'regex_i': {
      const regex = new RegExp(String(expected), 'i');
      return regex.test(String(actual));
    }

    // Boolean
    case 'is_true':
      return actual === true;

    case 'is_false':
      return actual === false;

    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}
```

### Short-Circuit Optimization

```typescript
/**
 * Optimized nested condition evaluation with short-circuit
 * Stops evaluating as soon as result is determined
 */
function evaluateNestedConditionOptimized(
  condition: NestedCondition,
  context: EvaluationContext
): boolean {
  if (condition.operator === 'AND') {
    // Stop on first false
    for (const child of condition.conditions) {
      if (!evaluateCondition(child, context)) {
        return false;  // Short-circuit
      }
    }
    return true;
  } else {
    // Stop on first true
    for (const child of condition.conditions) {
      if (evaluateCondition(child, context)) {
        return true;  // Short-circuit
      }
    }
    return false;
  }
}
```

### Error Handling in Evaluation

```typescript
/**
 * Evaluation errors
 */
class EvaluationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public operator?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Safe evaluation with error handling
 */
function safeEvaluateCondition(
  condition: Condition,
  context: EvaluationContext,
  defaultResult: boolean = false
): boolean {
  try {
    return evaluateCondition(condition, context);
  } catch (error) {
    console.error('Condition evaluation error:', error);

    // Log error for debugging
    logEvaluationError({
      condition,
      context: sanitizeContext(context),
      error: error.message
    });

    // Return safe default (usually false to not match on errors)
    return defaultResult;
  }
}
```

### Complexity Analysis

- **Time Complexity**: O(n) where n = number of leaf conditions
- **Space Complexity**: O(d) where d = max depth of condition tree
- **Worst Case**: Deeply nested conditions with many leaves
- **Best Case**: Short-circuit on first condition in AND/OR

**Performance Target**: <1ms for typical condition tree (5-10 leaves)

---

## Rules Engine Execution Flow

### Main Evaluation Pipeline

```typescript
/**
 * Main entry point for rule evaluation
 * Returns the action to take based on matched rules
 */
async function evaluateRules(
  profile: UserProfile,
  postHistory: PostHistory,
  currentPost: CurrentPost,
  subreddit: string,
  aiAnalysis?: AIAnalysisResult
): Promise<RuleEvaluationResult> {
  const startTime = Date.now();

  // 1. Build evaluation context
  const context: EvaluationContext = {
    profile,
    postHistory,
    currentPost,
    aiAnalysis,
    subreddit,
    timestamp: new Date()
  };

  // 2. Load applicable rules
  const rules = await loadRulesForSubreddit(subreddit);

  // 3. Filter enabled rules
  const enabledRules = rules.filter(rule => rule.enabled);

  // 4. Sort by priority (highest first)
  const sortedRules = enabledRules.sort((a, b) => b.priority - a.priority);

  // 5. Evaluate each rule until one matches
  let rulesEvaluated = 0;
  for (const rule of sortedRules) {
    rulesEvaluated++;

    // Skip AI rules if no AI analysis available
    if (rule.type === 'AI' && !aiAnalysis) {
      continue;
    }

    // Evaluate rule conditions
    const matched = safeEvaluateCondition(rule.conditions, context, false);

    // Update rule stats asynchronously
    updateRuleStats(rule.id, matched);

    if (matched) {
      // Rule matched! Return action
      const executionTimeMs = Date.now() - startTime;

      return {
        action: rule.action,
        reason: substituteVariables(rule.actionConfig.reason, context),
        comment: rule.actionConfig.comment
          ? substituteVariables(rule.actionConfig.comment, context)
          : null,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        confidence: calculateConfidence(rule, context),
        executionTimeMs,
        rulesEvaluated,
        aiAnalysisUsed: rule.type === 'AI'
      };
    }
  }

  // 6. No rules matched - default action
  const executionTimeMs = Date.now() - startTime;

  return {
    action: 'APPROVE',
    reason: 'No rules matched - default approve',
    comment: null,
    matchedRuleId: null,
    matchedRuleName: null,
    confidence: 100,
    executionTimeMs,
    rulesEvaluated,
    aiAnalysisUsed: false
  };
}
```

### Rule Loading Strategy

```typescript
/**
 * Loads rules for a subreddit with caching
 */
async function loadRulesForSubreddit(subreddit: string): Promise<Rule[]> {
  // Check cache first (60 second TTL)
  const cached = ruleCache.get(subreddit);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.rules;
  }

  // Fetch from Redis
  const subredditRules = await fetchRulesFromRedis(subreddit);
  const globalRules = await fetchRulesFromRedis('global');

  const allRules = [...subredditRules, ...globalRules];

  // Cache for next time
  ruleCache.set(subreddit, {
    rules: allRules,
    timestamp: Date.now()
  });

  return allRules;
}

/**
 * Fetches rules from Redis
 */
async function fetchRulesFromRedis(subreddit: string): Promise<Rule[]> {
  const prefix = subreddit === 'global' ? 'rules:global' : `rules:${subreddit}`;

  // Get rule IDs sorted by priority
  const ruleIds = await redis.zrevrange(`${prefix}:list`, 0, -1);

  if (ruleIds.length === 0) {
    return [];
  }

  // Fetch all rules in pipeline
  const pipeline = redis.pipeline();
  for (const ruleId of ruleIds) {
    pipeline.get(`${prefix}:${ruleId}`);
  }

  const results = await pipeline.exec();

  // Parse JSON and filter nulls
  return results
    .map(([err, data]) => {
      if (err || !data) return null;
      try {
        return JSON.parse(data) as Rule;
      } catch {
        return null;
      }
    })
    .filter((rule): rule is Rule => rule !== null);
}
```

### Confidence Calculation

```typescript
/**
 * Calculates confidence score for a matched rule
 * - Hard rules: 100% confidence
 * - AI rules: Uses AI confidence scores
 */
function calculateConfidence(rule: Rule, context: EvaluationContext): number {
  if (rule.type === 'HARD') {
    return 100;
  }

  // AI rule - calculate based on AI answer confidences
  if (!context.aiAnalysis) {
    return 0;
  }

  // Extract confidence scores from conditions
  const confidences = extractAIConfidences(rule.conditions, context.aiAnalysis);

  if (confidences.length === 0) {
    return 100;  // No AI conditions, treat as 100%
  }

  // Use minimum confidence (most conservative)
  return Math.min(...confidences);
}

/**
 * Recursively extracts AI confidence scores from conditions
 */
function extractAIConfidences(
  condition: Condition,
  aiAnalysis: AIAnalysisResult
): number[] {
  if ('conditions' in condition) {
    // Nested condition - recurse
    return condition.conditions.flatMap(child =>
      extractAIConfidences(child, aiAnalysis)
    );
  }

  // Leaf condition - check if it references AI confidence
  if (condition.field.startsWith('aiAnalysis.answers.')) {
    const parts = condition.field.split('.');
    if (parts.length >= 4) {
      const questionId = parts[2];
      const answer = aiAnalysis.answers[questionId];
      if (answer) {
        return [answer.confidence];
      }
    }
  }

  return [];
}
```

### Execution Flow Diagram

```
┌─────────────────────────────────────┐
│   evaluateRules() called            │
│   - User profile                    │
│   - Post history                    │
│   - Current post                    │
│   - AI analysis (optional)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Build Evaluation Context          │
│   - Combine all input data          │
│   - Add timestamp, subreddit        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Load Rules                        │
│   - Fetch from cache or Redis       │
│   - Merge subreddit + global rules  │
│   - Sort by priority (high → low)   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Filter Enabled Rules              │
│   - Remove disabled rules           │
└────────────┬────────────────────────┘
             │
             ▼
        ┌────┴────┐
        │ For each│
        │  rule   │
        └────┬────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Check Rule Type                   │
│   - Skip AI rules if no analysis    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Evaluate Conditions               │
│   - evaluateCondition(rule, ctx)    │
│   - Returns true/false              │
└────────────┬────────────────────────┘
             │
         ┌───┴───┐
         │Matched?│
         └───┬───┘
             │
      ┌──────┴──────┐
      │             │
     YES           NO
      │             │
      ▼             ▼
┌──────────┐  ┌──────────┐
│ Return   │  │ Next     │
│ Action   │  │ Rule     │
└──────────┘  └────┬─────┘
                   │
                   └──────┐
                          │
                          ▼
                    ┌──────────┐
                    │ All rules│
                    │evaluated?│
                    └────┬─────┘
                         │
                      ┌──┴──┐
                     YES   NO
                      │     │
                      ▼     └─── Back to loop
              ┌──────────────┐
              │ Return       │
              │ Default      │
              │ APPROVE      │
              └──────────────┘
```

### Performance Considerations

1. **Rule Priority**: Higher priority rules evaluated first
2. **Early Exit**: Stop on first match (don't evaluate remaining rules)
3. **Short-Circuit**: AND/OR operators stop early when possible
4. **Caching**: Rules cached for 60 seconds to avoid Redis roundtrips
5. **Pipeline Fetching**: Fetch multiple rules in one roundtrip
6. **Async Stats**: Stats updated asynchronously to not block

**Expected Performance**:
- **Rule Loading**: ~5ms (from cache) or ~20ms (from Redis)
- **Condition Evaluation**: <1ms per rule
- **Total**: <50ms for typical case (10 rules, 3 evaluated before match)

---

## Default Rule Sets

### FriendsOver40 Default Rules

```typescript
const FRIENDS_OVER_40_RULES: Rule[] = [
  {
    id: 'fo40_mod_override',
    name: 'Moderator Override',
    description: 'Always approve posts from moderators',
    type: 'HARD',
    enabled: true,
    priority: 1000,
    subreddit: 'FriendsOver40',
    conditions: {
      field: 'profile.isModerator',
      operator: 'is_true',
      value: true
    },
    action: 'APPROVE',
    actionConfig: {
      reason: 'Post from moderator - auto-approved'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'fo40_negative_karma',
    name: 'Negative Karma Flag',
    description: 'Flag users with negative total karma',
    type: 'HARD',
    enabled: true,
    priority: 200,
    subreddit: 'FriendsOver40',
    conditions: {
      field: 'profile.totalKarma',
      operator: '<',
      value: 0
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'User has negative karma ({profile.totalKarma})'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'fo40_new_low_karma',
    name: 'New Low Karma Account',
    description: 'Flag new accounts with low karma',
    type: 'HARD',
    enabled: true,
    priority: 150,
    subreddit: 'FriendsOver40',
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'profile.accountAgeInDays',
          operator: '<',
          value: 30
        },
        {
          field: 'profile.totalKarma',
          operator: '<',
          value: 100
        }
      ]
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'New account ({profile.accountAgeInDays} days) with low karma ({profile.totalKarma})'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'fo40_prohibited_keywords',
    name: 'Prohibited Keywords',
    description: 'Remove posts containing prohibited keywords',
    type: 'HARD',
    enabled: true,
    priority: 100,
    subreddit: 'FriendsOver40',
    conditions: {
      operator: 'OR',
      conditions: [
        {
          field: 'currentPost.title',
          operator: 'regex_i',
          value: '\\b(sugar\\s*daddy|sugar\\s*mommy|onlyfans)\\b'
        },
        {
          field: 'currentPost.body',
          operator: 'regex_i',
          value: '\\b(sugar\\s*daddy|sugar\\s*mommy|onlyfans)\\b'
        }
      ]
    },
    action: 'REMOVE',
    actionConfig: {
      reason: 'Post contains prohibited keywords',
      comment: 'Your post has been removed because it contains prohibited content. Please review the subreddit rules.',
      notifyUser: true,
      distinguish: true
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'fo40_age_appropriate',
    name: 'Age Appropriateness Check',
    description: 'Flag posts that may not be age-appropriate for 40+',
    type: 'AI',
    enabled: true,
    priority: 75,
    subreddit: 'FriendsOver40',
    aiQuestionIds: ['q_age_appropriate_40'],
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'aiAnalysis.answers.q_age_appropriate_40.answer',
          operator: '==',
          value: 'NO'
        },
        {
          field: 'aiAnalysis.answers.q_age_appropriate_40.confidence',
          operator: '>=',
          value: 70
        }
      ]
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'AI detected content may not be age-appropriate (confidence: {aiAnalysis.answers.q_age_appropriate_40.confidence}%)',
      variables: {
        ai_reasoning: '{aiAnalysis.answers.q_age_appropriate_40.reasoning}'
      }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'fo40_dating_intent',
    name: 'Dating Intent Detection',
    description: 'Flag posts with dating/romantic intent',
    type: 'AI',
    enabled: true,
    priority: 50,
    subreddit: 'FriendsOver40',
    aiQuestionIds: ['q_dating_intent'],
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'aiAnalysis.answers.q_dating_intent.answer',
          operator: '==',
          value: 'YES'
        },
        {
          field: 'aiAnalysis.answers.q_dating_intent.confidence',
          operator: '>=',
          value: 80
        }
      ]
    },
    action: 'REMOVE',
    actionConfig: {
      reason: 'Post appears to have dating/romantic intent (AI confidence: {aiAnalysis.answers.q_dating_intent.confidence}%)',
      comment: 'Your post has been removed because it appears to be seeking romantic connections. This subreddit is for platonic friendships only. Please try r/r4r40Plus or similar dating-focused subreddits.',
      notifyUser: true,
      distinguish: true
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  }
];
```

### FriendsOver50 Default Rules

```typescript
const FRIENDS_OVER_50_RULES: Rule[] = [
  // Same rules as FriendsOver40, but with different AI question
  // for age appropriateness (q_age_appropriate_50 instead of q_age_appropriate_40)

  // Copy all rules from FriendsOver40...
  ...FRIENDS_OVER_40_RULES.map(rule => ({
    ...rule,
    id: rule.id.replace('fo40_', 'fo50_'),
    subreddit: 'FriendsOver50',
    // Update age appropriate rule to use 50+ question
    ...(rule.id === 'fo40_age_appropriate' ? {
      aiQuestionIds: ['q_age_appropriate_50'],
      conditions: {
        operator: 'AND',
        conditions: [
          {
            field: 'aiAnalysis.answers.q_age_appropriate_50.answer',
            operator: '==',
            value: 'NO'
          },
          {
            field: 'aiAnalysis.answers.q_age_appropriate_50.confidence',
            operator: '>=',
            value: 70
          }
        ]
      }
    } : {})
  }))
];
```

### bitcointaxes Default Rules

```typescript
const BITCOINTAXES_RULES: Rule[] = [
  {
    id: 'bt_mod_override',
    name: 'Moderator Override',
    description: 'Always approve posts from moderators',
    type: 'HARD',
    enabled: true,
    priority: 1000,
    subreddit: 'bitcointaxes',
    conditions: {
      field: 'profile.isModerator',
      operator: 'is_true',
      value: true
    },
    action: 'APPROVE',
    actionConfig: {
      reason: 'Post from moderator - auto-approved'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'bt_new_account_links',
    name: 'New Account with External Links',
    description: 'Flag new accounts posting external links',
    type: 'HARD',
    enabled: true,
    priority: 150,
    subreddit: 'bitcointaxes',
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'profile.accountAgeInDays',
          operator: '<',
          value: 30
        },
        {
          field: 'currentPost.urls',
          operator: 'exists',
          value: true
        },
        {
          field: 'profile.totalKarma',
          operator: '<',
          value: 50
        }
      ]
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'New account ({profile.accountAgeInDays} days, {profile.totalKarma} karma) posting links'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'bt_spam_detection',
    name: 'Spam Detection',
    description: 'Detect promotional or spam content',
    type: 'AI',
    enabled: true,
    priority: 100,
    subreddit: 'bitcointaxes',
    aiQuestionIds: ['q_spam_detection'],
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'aiAnalysis.answers.q_spam_detection.answer',
          operator: '==',
          value: 'YES'
        },
        {
          field: 'aiAnalysis.answers.q_spam_detection.confidence',
          operator: '>=',
          value: 85
        }
      ]
    },
    action: 'REMOVE',
    actionConfig: {
      reason: 'AI detected spam/promotional content (confidence: {aiAnalysis.answers.q_spam_detection.confidence}%)',
      comment: 'Your post has been removed as it appears to be promotional or spam. If you believe this is an error, please contact the moderators.',
      notifyUser: true,
      distinguish: true
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'bt_off_topic',
    name: 'Off-Topic Detection',
    description: 'Detect posts not related to Bitcoin taxes',
    type: 'AI',
    enabled: true,
    priority: 75,
    subreddit: 'bitcointaxes',
    aiQuestionIds: ['q_bitcoin_tax_related'],
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'aiAnalysis.answers.q_bitcoin_tax_related.answer',
          operator: '==',
          value: 'NO'
        },
        {
          field: 'aiAnalysis.answers.q_bitcoin_tax_related.confidence',
          operator: '>=',
          value: 80
        }
      ]
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'Post may be off-topic (AI confidence: {aiAnalysis.answers.q_bitcoin_tax_related.confidence}%)',
      comment: null
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  }
];
```

### Global Default Rules

```typescript
const GLOBAL_RULES: Rule[] = [
  {
    id: 'global_suspended_account',
    name: 'Suspended Account',
    description: 'Flag posts from suspended accounts',
    type: 'HARD',
    enabled: true,
    priority: 900,
    subreddit: null,  // Global rule
    conditions: {
      field: 'profile.isSuspended',
      operator: 'is_true',
      value: true
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'Post from suspended account'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  },

  {
    id: 'global_short_spam',
    name: 'Very Short Post with Links',
    description: 'Flag very short posts that only contain links',
    type: 'HARD',
    enabled: true,
    priority: 50,
    subreddit: null,
    conditions: {
      operator: 'AND',
      conditions: [
        {
          field: 'currentPost.wordCount',
          operator: '<',
          value: 10
        },
        {
          field: 'currentPost.urls',
          operator: 'exists',
          value: true
        }
      ]
    },
    action: 'FLAG',
    actionConfig: {
      reason: 'Very short post ({currentPost.wordCount} words) with links - possible spam'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  }
];
```

---

## Variable Substitution

### Substitution Engine

```typescript
/**
 * Substitutes variables in text using context data
 * Supports dot notation: {profile.commentKarma}
 * Also supports nested AI analysis paths
 *
 * @param text - Text with {variable} placeholders
 * @param context - Evaluation context with data
 * @returns Text with variables replaced
 */
function substituteVariables(
  text: string | null | undefined,
  context: EvaluationContext
): string | null {
  if (!text) return null;

  // Find all {variable} patterns
  const variablePattern = /\{([^}]+)\}/g;

  return text.replace(variablePattern, (match, path) => {
    // Resolve the path in context
    const value = resolveFieldPath(path.trim(), context);

    // Format the value
    if (value === undefined || value === null) {
      return '[undefined]';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}
```

### Available Variables

All field paths from the [Field Reference Model](#field-reference-model) can be used:

#### Common Variables

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{profile.username}` | "user123" | Username |
| `{profile.accountAgeInDays}` | "45" | Account age |
| `{profile.totalKarma}` | "1500" | Total karma |
| `{profile.commentKarma}` | "1200" | Comment karma |
| `{profile.postKarma}` | "300" | Post karma |
| `{currentPost.title}` | "Looking for..." | Post title |
| `{currentPost.wordCount}` | "150" | Word count |
| `{currentPost.type}` | "text" | Post type |
| `{postHistory.totalPosts}` | "25" | Total posts |

#### AI Analysis Variables

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{aiAnalysis.answers.q_dating_intent.answer}` | "YES" | AI answer |
| `{aiAnalysis.answers.q_dating_intent.confidence}` | "85" | Confidence score |
| `{aiAnalysis.answers.q_dating_intent.reasoning}` | "Post mentions..." | AI reasoning |

### Example Substitutions

**Input**:
```
"New account ({profile.accountAgeInDays} days) with low karma ({profile.totalKarma})"
```

**Context**:
```typescript
{
  profile: {
    accountAgeInDays: 15,
    totalKarma: 45
  }
}
```

**Output**:
```
"New account (15 days) with low karma (45)"
```

---

**Input**:
```
"AI detected dating intent with {aiAnalysis.answers.q_dating_intent.confidence}% confidence. Reasoning: {aiAnalysis.answers.q_dating_intent.reasoning}"
```

**Context**:
```typescript
{
  aiAnalysis: {
    answers: {
      q_dating_intent: {
        answer: 'YES',
        confidence: 87,
        reasoning: 'Post mentions seeking romantic partner'
      }
    }
  }
}
```

**Output**:
```
"AI detected dating intent with 87% confidence. Reasoning: Post mentions seeking romantic partner"
```

### Advanced Features

#### Custom Variables in ActionConfig

```typescript
actionConfig: {
  reason: 'Spam detected: {spam_reason}',
  variables: {
    spam_reason: 'Multiple promotional links detected'
  }
}
```

Variables from `actionConfig.variables` are merged into context before substitution.

#### Conditional Text

Not implemented in initial version, but could be added:

```typescript
// Future feature
"{if:profile.isModerator}Mod{else}User{endif} posted"
```

---

## Error Handling Strategy

### Error Categories

```typescript
/**
 * Rule evaluation errors
 */
enum RuleErrorType {
  // Configuration errors (should be caught at rule creation)
  INVALID_FIELD_PATH = 'INVALID_FIELD_PATH',
  INVALID_OPERATOR = 'INVALID_OPERATOR',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  INVALID_REGEX = 'INVALID_REGEX',

  // Runtime errors (happen during evaluation)
  FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
  EVALUATION_ERROR = 'EVALUATION_ERROR',
  AI_ANALYSIS_MISSING = 'AI_ANALYSIS_MISSING',

  // Storage errors
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

class RuleError extends Error {
  constructor(
    public type: RuleErrorType,
    message: string,
    public ruleId?: string,
    public field?: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'RuleError';
  }
}
```

### Validation Strategy

#### 1. Rule Creation Validation

```typescript
/**
 * Validates a rule before storing in Redis
 * Catches configuration errors early
 */
function validateRule(rule: Rule): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!rule.id || !rule.name || !rule.type) {
    errors.push('Missing required fields: id, name, type');
  }

  // Validate priority range
  if (rule.priority < 1 || rule.priority > 1000) {
    errors.push('Priority must be between 1 and 1000');
  }

  // Validate action
  const validActions: ModeratorAction[] = ['APPROVE', 'FLAG', 'REMOVE', 'COMMENT'];
  if (!validActions.includes(rule.action)) {
    errors.push(`Invalid action: ${rule.action}`);
  }

  // Validate COMMENT action has comment text
  if (rule.action === 'COMMENT' && !rule.actionConfig.comment) {
    errors.push('COMMENT action requires actionConfig.comment');
  }

  // Validate conditions
  const conditionErrors = validateCondition(rule.conditions);
  errors.push(...conditionErrors);

  // Validate AI rules have aiQuestionIds
  if (rule.type === 'AI' && (!rule.aiQuestionIds || rule.aiQuestionIds.length === 0)) {
    errors.push('AI rules must specify aiQuestionIds');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates condition tree
 */
function validateCondition(condition: Condition): string[] {
  const errors: string[] = [];

  if ('conditions' in condition) {
    // Nested condition
    if (!condition.conditions || condition.conditions.length < 2) {
      errors.push('Nested conditions must have at least 2 children');
    }

    if (!['AND', 'OR'].includes(condition.operator)) {
      errors.push(`Invalid nested operator: ${condition.operator}`);
    }

    // Validate each child
    for (const child of condition.conditions || []) {
      errors.push(...validateCondition(child));
    }
  } else {
    // Leaf condition
    if (!condition.field) {
      errors.push('Leaf condition must have field');
    }

    if (!condition.operator) {
      errors.push('Leaf condition must have operator');
    }

    // Validate field exists
    if (condition.field && !isValidFieldPath(condition.field)) {
      errors.push(`Invalid field path: ${condition.field}`);
    }

    // Validate operator
    if (condition.operator && !isValidOperator(condition.operator)) {
      errors.push(`Invalid operator: ${condition.operator}`);
    }

    // Validate type compatibility
    if (condition.field && condition.operator) {
      const fieldType = getFieldType(condition.field);
      const compatibleTypes = OPERATOR_TYPE_COMPATIBILITY[condition.operator];

      if (compatibleTypes && !compatibleTypes.includes(fieldType)) {
        errors.push(
          `Operator ${condition.operator} not compatible with field type ${fieldType} (field: ${condition.field})`
        );
      }
    }

    // Validate regex patterns
    if (condition.operator === 'regex' || condition.operator === 'regex_i') {
      try {
        new RegExp(String(condition.value));
      } catch {
        errors.push(`Invalid regex pattern: ${condition.value}`);
      }
    }
  }

  return errors;
}
```

#### 2. Runtime Error Handling

```typescript
/**
 * Safe rule evaluation with comprehensive error handling
 */
async function safeEvaluateRules(
  profile: UserProfile,
  postHistory: PostHistory,
  currentPost: CurrentPost,
  subreddit: string,
  aiAnalysis?: AIAnalysisResult
): Promise<RuleEvaluationResult> {
  try {
    return await evaluateRules(
      profile,
      postHistory,
      currentPost,
      subreddit,
      aiAnalysis
    );
  } catch (error) {
    // Log error for debugging
    console.error('Rule evaluation failed:', error);

    // Log to monitoring system
    logRuleEvaluationError({
      error,
      subreddit,
      postId: currentPost.id,
      username: profile.username
    });

    // Return safe default (approve)
    return {
      action: 'APPROVE',
      reason: 'Rule evaluation error - defaulting to approve',
      comment: null,
      matchedRuleId: null,
      matchedRuleName: null,
      confidence: 0,
      executionTimeMs: 0,
      rulesEvaluated: 0,
      aiAnalysisUsed: false
    };
  }
}
```

#### 3. Partial Failure Handling

```typescript
/**
 * Continue evaluating rules even if some fail
 * Skip failed rules and move to next
 */
async function evaluateRulesWithPartialFailure(
  context: EvaluationContext
): Promise<RuleEvaluationResult> {
  const rules = await loadRulesForSubreddit(context.subreddit);
  const enabledRules = rules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority);

  let rulesEvaluated = 0;
  const failedRules: string[] = [];

  for (const rule of enabledRules) {
    rulesEvaluated++;

    try {
      // Skip AI rules if no analysis
      if (rule.type === 'AI' && !context.aiAnalysis) {
        continue;
      }

      // Evaluate rule
      const matched = evaluateCondition(rule.conditions, context);

      if (matched) {
        return buildSuccessResult(rule, context, rulesEvaluated);
      }
    } catch (error) {
      // Log and continue to next rule
      console.error(`Rule ${rule.id} evaluation failed:`, error);
      failedRules.push(rule.id);

      logRuleError({
        ruleId: rule.id,
        ruleName: rule.name,
        error: error.message,
        context: sanitizeContext(context)
      });

      // Continue to next rule
      continue;
    }
  }

  // No rules matched
  return buildDefaultResult(rulesEvaluated, failedRules);
}
```

### Error Recovery Strategies

| Error Type | Strategy | Fallback Action |
|------------|----------|-----------------|
| Invalid field path | Skip rule | Continue to next rule |
| Type mismatch | Skip rule | Continue to next rule |
| Regex error | Skip rule | Continue to next rule |
| Missing AI analysis | Skip AI rules | Evaluate hard rules only |
| Redis unavailable | Use empty rule set | Default APPROVE |
| Condition evaluation error | Skip rule | Continue to next rule |

### Error Logging

```typescript
/**
 * Structured error logging for monitoring
 */
interface RuleErrorLog {
  timestamp: Date;
  errorType: RuleErrorType;
  ruleId?: string;
  ruleName?: string;
  subreddit: string;
  postId: string;
  username: string;
  error: string;
  stack?: string;
  context?: any;
}

function logRuleError(log: RuleErrorLog): void {
  // Log to console (development)
  console.error('[Rule Error]', log);

  // Log to monitoring service (production)
  // e.g., Sentry, DataDog, CloudWatch
  monitoringService.logError('rule_evaluation_error', log);

  // Store in Redis for admin dashboard
  redis.lpush(
    'rule_errors',
    JSON.stringify(log)
  );
  redis.ltrim('rule_errors', 0, 999);  // Keep last 1000 errors
}
```

---

## Performance Considerations

### Bottleneck Analysis

| Operation | Time Complexity | Expected Latency | Optimization |
|-----------|----------------|------------------|--------------|
| Load rules from Redis | O(n) | 5-20ms | Cache for 60s |
| Sort rules by priority | O(n log n) | <1ms | Pre-sorted in Redis ZSET |
| Evaluate single condition | O(1) | <0.1ms | Direct field access |
| Evaluate nested condition | O(n) | <1ms | Short-circuit AND/OR |
| Variable substitution | O(m) | <1ms | Regex replace |
| Total per evaluation | O(n * m) | <50ms | Early exit on match |

Where:
- n = number of rules (typically 5-20)
- m = number of conditions per rule (typically 2-5)

### Optimization Strategies

#### 1. Rule Loading Cache

```typescript
/**
 * In-memory LRU cache for rules
 * Reduces Redis roundtrips
 */
class RuleCache {
  private cache = new Map<string, CachedRules>();
  private maxSize = 100;
  private ttlMs = 60000;  // 60 seconds

  get(subreddit: string): Rule[] | null {
    const cached = this.cache.get(subreddit);

    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(subreddit);
      return null;
    }

    return cached.rules;
  }

  set(subreddit: string, rules: Rule[]): void {
    // LRU eviction if cache full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(subreddit, {
      rules,
      timestamp: Date.now()
    });
  }

  invalidate(subreddit: string): void {
    this.cache.delete(subreddit);
  }
}
```

#### 2. Priority-Based Early Exit

Rules are sorted by priority. Evaluation stops on first match.

**Example**:
- 20 rules configured
- Rule #3 matches (priority 200)
- Rules #4-20 never evaluated
- **Time saved**: ~15ms

#### 3. Short-Circuit Evaluation

AND/OR operators stop evaluating as soon as result is determined.

**Example AND**:
```typescript
conditions: [
  { field: 'profile.isModerator', operator: 'is_true' },  // FALSE → stop here
  { field: 'profile.karma', operator: '>', value: 1000 }  // Never evaluated
]
```

**Example OR**:
```typescript
conditions: [
  { field: 'profile.karma', operator: '<', value: 0 },     // TRUE → stop here
  { field: 'profile.accountAge', operator: '<', value: 7 } // Never evaluated
]
```

#### 4. Redis Pipeline Fetching

Fetch multiple rules in single roundtrip:

```typescript
// ❌ Bad: Multiple roundtrips
for (const ruleId of ruleIds) {
  const rule = await redis.get(`rules:${subreddit}:${ruleId}`);
}

// ✅ Good: Single pipeline
const pipeline = redis.pipeline();
for (const ruleId of ruleIds) {
  pipeline.get(`rules:${subreddit}:${ruleId}`);
}
const results = await pipeline.exec();
```

**Time saved**: ~10ms per additional rule

#### 5. Lazy AI Analysis

Only perform AI analysis if AI rules exist:

```typescript
async function shouldPerformAIAnalysis(subreddit: string): Promise<boolean> {
  const rules = await loadRulesForSubreddit(subreddit);
  return rules.some(rule => rule.type === 'AI' && rule.enabled);
}

// In main flow
if (await shouldPerformAIAnalysis(subreddit)) {
  aiAnalysis = await analyzePost(post, questions);
}
```

#### 6. Regex Compilation Cache

Cache compiled regex patterns:

```typescript
const regexCache = new Map<string, RegExp>();

function getCompiledRegex(pattern: string, flags?: string): RegExp {
  const key = `${pattern}:${flags || ''}`;

  if (!regexCache.has(key)) {
    regexCache.set(key, new RegExp(pattern, flags));
  }

  return regexCache.get(key)!;
}
```

### Scalability Considerations

#### Horizontal Scaling

Rules engine is **stateless** and scales horizontally:

```
┌────────┐     ┌────────┐     ┌────────┐
│ Node 1 │     │ Node 2 │     │ Node 3 │
└───┬────┘     └───┬────┘     └───┬────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
            ┌──────▼──────┐
            │    Redis    │
            │  (Shared)   │
            └─────────────┘
```

Each node:
- Maintains own rule cache
- Fetches from shared Redis
- No coordination needed

#### Load Testing Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Rule evaluation latency | <50ms p95 | Including Redis fetch |
| Cache hit rate | >90% | With 60s TTL |
| Rules per subreddit | <100 | Performance degrades after |
| Concurrent evaluations | 1000/sec | Per node |
| Redis connections | <10 | Connection pooling |

#### Monitoring Metrics

```typescript
/**
 * Metrics to track for performance monitoring
 */
interface RuleMetrics {
  // Latency
  evaluationLatencyMs: number;
  redisLatencyMs: number;

  // Throughput
  evaluationsPerSecond: number;

  // Efficiency
  cacheHitRate: number;
  avgRulesEvaluated: number;
  earlyExitRate: number;

  // Errors
  errorRate: number;
  failedRuleCount: number;
}
```

### Database Schema Growth

Estimate Redis memory usage:

```
# Per rule
Rule size: ~2KB (JSON)
Metadata: ~500B
Stats: ~200B
Total per rule: ~2.7KB

# For 100 subreddits, 20 rules each
Total rules: 2000
Memory usage: 2000 * 2.7KB ≈ 5.4MB

# With cache overhead (ZSET, indexes)
Total memory: ~10MB
```

**Conclusion**: Rules storage is **lightweight**. Can scale to thousands of rules without memory concerns.

---

## Summary

This architecture provides:

1. **Type-Safe Rule System**: Full TypeScript support with compile-time validation
2. **Flexible Conditions**: Nested AND/OR logic with 20+ operators
3. **Efficient Storage**: Redis-based with priority sorting and caching
4. **Fast Evaluation**: <50ms typical, with early exit and short-circuit optimization
5. **Rich Field Access**: 30+ profile/post/history fields plus AI analysis
6. **Variable Substitution**: Dynamic reason/comment text with context data
7. **Comprehensive Error Handling**: Validation at creation, graceful failures at runtime
8. **Default Rule Sets**: Pre-configured rules for all target subreddits
9. **Scalability**: Stateless design, horizontal scaling, <10MB memory for 2000 rules

### Next Steps (Implementation Phase)

1. Implement core types (`src/rules/types.ts`)
2. Implement condition evaluator (`src/rules/evaluator.ts`)
3. Implement Redis storage (`src/rules/storage.ts`)
4. Implement rules service (`src/rules/service.ts`)
5. Implement API endpoints (`src/routes/rules.ts`)
6. Implement default rule sets (`src/rules/defaults.ts`)
7. Write comprehensive tests
8. Create admin UI for rule management
9. Deploy and monitor performance

---

## Appendix: Example API Endpoints

### POST /api/rules

Create a new rule:

```typescript
POST /api/rules
Content-Type: application/json

{
  "name": "Low Karma Flag",
  "description": "Flag users with karma < 50",
  "type": "HARD",
  "enabled": true,
  "priority": 100,
  "subreddit": "FriendsOver40",
  "conditions": {
    "field": "profile.totalKarma",
    "operator": "<",
    "value": 50
  },
  "action": "FLAG",
  "actionConfig": {
    "reason": "Low karma user ({profile.totalKarma})"
  }
}

Response: 201 Created
{
  "id": "rule_abc123",
  "name": "Low Karma Flag",
  ...
}
```

### GET /api/rules

List all rules for a subreddit:

```typescript
GET /api/rules?subreddit=FriendsOver40

Response: 200 OK
{
  "rules": [
    { "id": "rule_1", "name": "Moderator Override", ... },
    { "id": "rule_2", "name": "Low Karma Flag", ... }
  ],
  "total": 2
}
```

### PUT /api/rules/:ruleId

Update a rule:

```typescript
PUT /api/rules/rule_abc123
Content-Type: application/json

{
  "enabled": false
}

Response: 200 OK
{
  "id": "rule_abc123",
  "enabled": false,
  ...
}
```

### DELETE /api/rules/:ruleId

Delete a rule:

```typescript
DELETE /api/rules/rule_abc123

Response: 204 No Content
```

### POST /api/rules/evaluate

Test rule evaluation (for debugging):

```typescript
POST /api/rules/evaluate
Content-Type: application/json

{
  "profile": { "username": "test", "totalKarma": 25, ... },
  "currentPost": { "title": "Test", ... },
  "postHistory": { "totalPosts": 5, ... },
  "subreddit": "FriendsOver40"
}

Response: 200 OK
{
  "action": "FLAG",
  "reason": "Low karma user (25)",
  "matchedRuleId": "rule_abc123",
  "confidence": 100,
  "executionTimeMs": 12,
  "rulesEvaluated": 3
}
```

---

**End of Architecture Design Document**
