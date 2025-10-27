# Phase 3: Configurable Rules System - Design Document

**Date**: 2025-10-27 (Revised)
**Status**: Draft - Pending User Approval
**Phase**: 3 of 5

---

## Executive Summary

Phase 3 implements a **configurable rule system** that allows moderators to define, customize, and manage moderation rules without code changes. This includes both **hard rules** (account-based conditions) and **AI rules** (AI-powered detection).

**Key Difference from Original Design**: Rules are NOT hardcoded. Moderators configure them via settings and can adjust thresholds, conditions, and actions to fit their subreddit's needs.

### 🎯 Critical Design Insight: Custom AI Questions

**The Problem with Hardcoding**: Originally designed with hardcoded AI detection types (`datingIntent`, `ageEstimate`, `scammerRisk`). This is inflexible - moderators couldn't define new detection types without code changes.

**The Solution**: Moderators write **custom AI questions** in natural language as part of each AI rule:
- **Example**: "Does this user appear to be seeking dating or romantic connections?"
- **AI Response**: `{ answer: "YES"/"NO", confidence: 0-100, reasoning: "..." }`
- **Rule Condition**: If answer == "YES" AND confidence >= 80% → REMOVE

**Benefits**:
- ✅ Moderators define ANY detection they want
- ✅ No code changes needed for new detection types
- ✅ Simpler AI system architecture (one flexible endpoint vs many hardcoded checks)
- ✅ Questions can be refined based on accuracy without redeploying

**This approach makes the system truly flexible and configurable.**

---

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                  Moderator Interface                     │
│  - Rule Configuration (JSON in Settings)                │
│  - Rule Management (enable/disable/edit)                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│                   Rule Storage (Redis)                   │
│  - rules:{subreddit}:hard:{ruleId}                      │
│  - rules:{subreddit}:ai:{ruleId}                        │
│  - rules:{subreddit}:index (list of all rule IDs)      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│                  Rule Execution Engine                   │
│  - Load rules from Redis                                 │
│  - Evaluate conditions against user/post data           │
│  - Determine action based on matched rules              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│                   Action Executors                       │
│  - FLAG, REMOVE, COMMENT, MESSAGE, APPROVE              │
└─────────────────────────────────────────────────────────┘
```

---

## Rule Configuration Format

### Hard Rule Structure

**Purpose**: Rules based on account attributes (age, karma, verification, dormancy)

**JSON Schema**:
```typescript
interface HardRule {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  type: 'hard';
  enabled: boolean;              // Can be toggled on/off
  priority: number;              // Higher = evaluated first
  conditions: RuleCondition;     // What to check
  action: Action;                // What to do
  actionParams: ActionParams;    // Action configuration
}

interface RuleCondition {
  operator: 'AND' | 'OR';        // How to combine conditions
  rules: Condition[];            // List of conditions
}

interface Condition {
  field: string;                 // What to check
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | boolean | string;
}

type Action = 'FLAG' | 'REMOVE' | 'COMMENT' | 'MESSAGE' | 'APPROVE';

interface ActionParams {
  reason: string;                // Mod log reason
  comment?: string;              // Comment text (if action is COMMENT or REMOVE)
  message?: string;              // PM text (if action is MESSAGE)
}
```

**Available Fields for Hard Rules**:
- `accountAge` - Days since account creation (number)
- `totalKarma` - Combined link + comment karma (number)
- `linkKarma` - Post karma only (number)
- `commentKarma` - Comment karma only (number)
- `emailVerified` - Email verification status (boolean)
- `isModerator` - Is user a mod of this sub (boolean)
- `daysSinceLastPost` - Account dormancy in days (number)

**Example Hard Rule** (New Low Karma Account):
```json
{
  "id": "new-low-karma",
  "name": "New Account with Low Karma",
  "type": "hard",
  "enabled": true,
  "priority": 100,
  "conditions": {
    "operator": "AND",
    "rules": [
      { "field": "accountAge", "operator": "<", "value": 30 },
      { "field": "totalKarma", "operator": "<", "value": 100 },
      { "field": "emailVerified", "operator": "==", "value": false }
    ]
  },
  "action": "FLAG",
  "actionParams": {
    "reason": "New account with low karma - needs manual review"
  }
}
```

**Example Hard Rule** (Dormant Account):
```json
{
  "id": "dormant-account",
  "name": "Dormant Account Suddenly Active",
  "type": "hard",
  "enabled": true,
  "priority": 90,
  "conditions": {
    "operator": "AND",
    "rules": [
      { "field": "daysSinceLastPost", "operator": ">", "value": 180 },
      { "field": "accountAge", "operator": ">", "value": 365 }
    ]
  },
  "action": "FLAG",
  "actionParams": {
    "reason": "Dormant account (6+ months) suddenly active - possible compromise"
  }
}
```

---

### AI Rule Structure

**Purpose**: Rules based on AI-powered content analysis

**JSON Schema**:
```typescript
interface AIRule {
  id: string;
  name: string;
  type: 'ai';
  enabled: boolean;
  priority: number;
  conditions: RuleCondition;     // Conditions on AI results
  action: Action;
  actionParams: ActionParams;
}
```

**Available Fields for AI Rules**:
- `datingIntent.detected` - Dating/hookup seeking detected (boolean)
- `datingIntent.confidence` - AI confidence level (number 0-100)
- `ageEstimate.range` - Age range estimate: 'UNDER_25' | '25_40' | 'OVER_40' (string)
- `ageEstimate.confidence` - AI confidence level (number 0-100)
- `scammerRisk` - Risk level: 'LOW' | 'MEDIUM' | 'HIGH' (string)
- `scammerRisk.confidence` - AI confidence level (number 0-100)
- `spamIndicators.detected` - Spam patterns detected (boolean)
- `spamIndicators.confidence` - AI confidence level (number 0-100)
- `overallRisk` - Overall risk assessment: 'LOW' | 'MEDIUM' | 'HIGH' (string)

**Example AI Rule** (Dating Intent - FriendsOver40):
```json
{
  "id": "dating-intent-remove",
  "name": "Remove Dating/Hookup Posts",
  "type": "ai",
  "enabled": true,
  "priority": 200,
  "conditions": {
    "operator": "AND",
    "rules": [
      { "field": "datingIntent.detected", "operator": "==", "value": true },
      { "field": "datingIntent.confidence", "operator": ">=", "value": 80 }
    ]
  },
  "action": "REMOVE",
  "actionParams": {
    "reason": "Dating/hookup seeking behavior detected (AI confidence: {confidence}%)",
    "comment": "Your post has been removed because it appears to be seeking dating or romantic connections. This subreddit is for friendships only.\n\nIf you believe this was a mistake, please message the moderators."
  }
}
```

**Example AI Rule** (Age Detection):
```json
{
  "id": "underage-detection",
  "name": "Flag Potentially Underage Users",
  "type": "ai",
  "enabled": true,
  "priority": 190,
  "conditions": {
    "operator": "AND",
    "rules": [
      { "field": "ageEstimate.range", "operator": "==", "value": "UNDER_25" },
      { "field": "ageEstimate.confidence", "operator": ">=", "value": 85 }
    ]
  },
  "action": "FLAG",
  "actionParams": {
    "reason": "User appears underage for FriendsOver40 (AI confidence: {confidence}%)"
  }
}
```

**Example AI Rule** (High Scammer Risk):
```json
{
  "id": "scammer-detection",
  "name": "Flag High Scammer Risk",
  "type": "ai",
  "enabled": true,
  "priority": 180,
  "conditions": {
    "operator": "AND",
    "rules": [
      { "field": "scammerRisk", "operator": "==", "value": "HIGH" },
      { "field": "scammerRisk.confidence", "operator": ">=", "value": 75 }
    ]
  },
  "action": "FLAG",
  "actionParams": {
    "reason": "High scammer risk detected (AI confidence: {confidence}%)"
  }
}
```

---

## Rule Storage (Redis)

### Schema Design

**Rule Storage**:
```
rules:{subreddit}:hard:{ruleId}  → JSON string of HardRule
rules:{subreddit}:ai:{ruleId}    → JSON string of AIRule
rules:{subreddit}:index          → Sorted set of rule IDs (score = priority)
```

**Example**:
```
rules:FriendsOver40:hard:new-low-karma → '{"id":"new-low-karma",...}'
rules:FriendsOver40:ai:dating-intent   → '{"id":"dating-intent",...}'
rules:FriendsOver40:index              → ZSET: ["new-low-karma":100, "dating-intent":200]
```

**Why Sorted Set for Index?**
- Allows efficient retrieval of rules in priority order
- `ZRANGE rules:FriendsOver40:index 0 -1 REV` returns all rules ordered by priority

### Default Rules

Each subreddit starts with a default ruleset (can be customized):

**Default Hard Rules**:
1. **Moderator Auto-Approve** (priority 1000)
   - IF isModerator == true → APPROVE

2. **New Low Karma** (priority 100)
   - IF accountAge < 30 AND totalKarma < 100 AND emailVerified == false → FLAG

3. **Negative Karma** (priority 90)
   - IF totalKarma < -50 → FLAG

**Default AI Rules** (for FriendsOver40/50):
1. **Dating Intent** (priority 200)
   - IF datingIntent.detected AND confidence >= 80 → REMOVE with comment

2. **Appears Underage** (priority 190)
   - IF ageEstimate.range == "UNDER_25" AND confidence >= 85 → FLAG

3. **High Scammer Risk** (priority 180)
   - IF scammerRisk == "HIGH" AND confidence >= 75 → FLAG

---

## Rule Configuration Interface

### Option A: JSON Configuration via Settings (MVP)

**Moderator Flow**:
1. Go to subreddit settings → Apps → AI Automod → Configure
2. See text field: "Rule Configuration (JSON)"
3. Paste/edit JSON array of rules
4. Click Save
5. App validates JSON and saves to Redis

**Settings Schema**:
```typescript
{
  type: 'string',
  name: 'hard_rules_config',
  label: 'Hard Rules Configuration (JSON)',
  helpText: 'Define account-based moderation rules as JSON array',
  defaultValue: JSON.stringify(DEFAULT_HARD_RULES, null, 2),
  scope: 'subreddit',
  multiline: true
}

{
  type: 'string',
  name: 'ai_rules_config',
  label: 'AI Rules Configuration (JSON)',
  helpText: 'Define AI-powered moderation rules as JSON array',
  defaultValue: JSON.stringify(DEFAULT_AI_RULES, null, 2),
  scope: 'subreddit',
  multiline: true
}
```

**Pros**:
- Simple to implement
- Maximum flexibility
- Can copy/paste rules between subreddits
- Power users comfortable with JSON

**Cons**:
- Not beginner-friendly
- JSON syntax errors can break configuration
- No validation until save

### Option B: Custom Form UI (Future Enhancement)

Build a Devvit menu-based UI for non-technical moderators:
- "Add New Rule" button
- Dropdowns for conditions and actions
- Input fields for thresholds
- Enable/disable toggles

**Defer to Phase 4** (too complex for MVP)

---

## Rule Execution Engine

### Component: `RulesEngine` (`src/rules/engine.ts`)

**Responsibilities**:
1. Load rules from Redis (cached in memory)
2. Evaluate rules in priority order
3. Return first matched action

**Interface**:
```typescript
class RulesEngine {
  /**
   * Load rules from Redis for a subreddit
   * @param subreddit - Subreddit name
   * @param context - Devvit context
   * @returns Loaded rules (cached for 5 minutes)
   */
  async loadRules(
    subreddit: string,
    context: Devvit.Context
  ): Promise<{ hard: HardRule[]; ai: AIRule[] }>;

  /**
   * Evaluate all rules and return action decision
   * @param ruleContext - Context with user/post/AI data
   * @param context - Devvit context
   * @returns Action to take
   */
  async evaluate(
    ruleContext: RuleEvaluationContext,
    context: Devvit.Context
  ): Promise<ActionDecision>;
}

interface RuleEvaluationContext {
  profile: UserProfile;
  history: UserPostHistory;
  aiAnalysis?: AIAnalysisResult;
  post: Post;
  subreddit: string;
}

interface ActionDecision {
  action: Action;
  reason: string;
  confidence: number;
  matchedRules: string[];  // Rule IDs that matched
  actionParams: ActionParams;
}
```

**Evaluation Algorithm**:
```typescript
async evaluate(ruleContext, context): Promise<ActionDecision> {
  // 1. Load rules for subreddit (with cache)
  const rules = await this.loadRules(ruleContext.subreddit, context);

  // 2. Combine hard rules + AI rules, sort by priority
  const allRules = [
    ...rules.hard,
    ...(ruleContext.aiAnalysis ? rules.ai : [])  // Only if AI available
  ].sort((a, b) => b.priority - a.priority);

  // 3. Evaluate each rule
  for (const rule of allRules) {
    if (!rule.enabled) continue;

    try {
      const matched = await this.evaluateRule(rule, ruleContext);

      if (matched) {
        return {
          action: rule.action,
          reason: this.formatReason(rule.actionParams.reason, ruleContext),
          confidence: this.getConfidence(rule, ruleContext),
          matchedRules: [rule.id],
          actionParams: rule.actionParams
        };
      }
    } catch (error) {
      console.error(`Rule ${rule.id} evaluation failed:`, error);
      // Continue with next rule (don't fail entire evaluation)
    }
  }

  // 4. No rules matched → APPROVE
  return {
    action: 'APPROVE',
    reason: 'No rules matched - approved',
    confidence: 100,
    matchedRules: [],
    actionParams: {}
  };
}
```

**Condition Evaluation**:
```typescript
evaluateConditions(conditions: RuleCondition, data: any): boolean {
  if (conditions.operator === 'AND') {
    return conditions.rules.every(rule =>
      this.evaluateCondition(rule, data)
    );
  } else if (conditions.operator === 'OR') {
    return conditions.rules.some(rule =>
      this.evaluateCondition(rule, data)
    );
  }
  return false;
}

evaluateCondition(condition: Condition, data: any): boolean {
  const value = this.getFieldValue(condition.field, data);

  switch (condition.operator) {
    case '>': return value > condition.value;
    case '<': return value < condition.value;
    case '>=': return value >= condition.value;
    case '<=': return value <= condition.value;
    case '==': return value === condition.value;
    case '!=': return value !== condition.value;
    default: return false;
  }
}

getFieldValue(field: string, data: any): any {
  // Support dot notation: "datingIntent.confidence"
  const parts = field.split('.');
  let value = data;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) return null;
  }
  return value;
}
```

---

## Action Executors

Same as original design, but simplified:

### FLAG Action
```typescript
await context.reddit.report(post, {
  reason: decision.reason
});
```

### REMOVE Action
```typescript
// 1. Remove post
await context.reddit.remove(post.id);

// 2. Add comment if specified
if (decision.actionParams.comment) {
  const comment = await context.reddit.submitComment({
    id: post.id,
    text: decision.actionParams.comment
  });
  await context.reddit.distinguish(comment.id, true);  // Sticky
}
```

### COMMENT Action
```typescript
const comment = await context.reddit.submitComment({
  id: post.id,
  text: decision.actionParams.comment
});
await context.reddit.distinguish(comment.id, true);
```

### MESSAGE Action
```typescript
await context.reddit.sendPrivateMessage({
  to: post.authorName,
  subject: 'Regarding your post in r/' + subreddit,
  text: decision.actionParams.message
});
```

---

## Integration with PostSubmit Handler

**Updated Flow**:
```typescript
async function handlePostSubmit(event: PostSubmit, context: Context) {
  const correlationId = generateCorrelationId();

  try {
    // 1. Check trust score (Phase 1)
    const trustScore = await trustScoreCalculator.calculate(
      event.author.id,
      context
    );

    if (trustScore.isTrusted) {
      await auditLogger.log({
        action: 'APPROVE',
        reason: 'Trusted user - bypassed analysis',
        postId: event.post.id,
        correlationId
      });
      return;
    }

    // 2. Fetch user profile + history (Phase 1)
    const [profile, history] = await Promise.all([
      userProfileFetcher.fetchProfile(event.author.id, context),
      historyAnalyzer.fetchHistory(event.author.name, context)
    ]);

    // 3. AI Analysis (Phase 2) - may be null if budget exceeded or providers down
    const aiAnalysis = await aiAnalyzer.analyzeUser(
      event.author.id,
      profile,
      history,
      {
        title: event.post.title,
        body: event.post.body,
        subreddit: event.subreddit.name
      },
      event.subreddit.name,
      trustScore.score
    );

    // 4. Evaluate Rules (Phase 3)
    const decision = await rulesEngine.evaluate({
      profile,
      history,
      aiAnalysis,
      post: event.post,
      subreddit: event.subreddit.name
    }, context);

    // 5. Execute Action (Phase 3)
    await actionExecutor.execute(decision, event.post, context);

    // 6. Update trust score
    if (decision.action === 'APPROVE') {
      await trustScoreCalculator.incrementApprovedPosts(
        event.author.id,
        event.subreddit.name,
        context
      );
    }

    // 7. Log final action
    await auditLogger.log({
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence,
      matchedRules: decision.matchedRules,
      postId: event.post.id,
      authorId: event.author.id,
      correlationId
    });

  } catch (error) {
    // Critical error - fail safe to FLAG
    console.error('Critical error in post submit handler', { error, correlationId });

    await context.reddit.report(event.post, {
      reason: `AI Automod error: ${error.message} [${correlationId}]`
    });
  }
}
```

---

## Default Rule Sets

### For r/FriendsOver40 and r/FriendsOver50

**Hard Rules**:
```json
[
  {
    "id": "mod-auto-approve",
    "name": "Moderator Auto-Approve",
    "type": "hard",
    "enabled": true,
    "priority": 1000,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "isModerator", "operator": "==", "value": true }
      ]
    },
    "action": "APPROVE",
    "actionParams": {
      "reason": "Moderator post - auto-approved"
    }
  },
  {
    "id": "new-low-karma",
    "name": "New Low Karma Account",
    "type": "hard",
    "enabled": true,
    "priority": 100,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "accountAge", "operator": "<", "value": 30 },
        { "field": "totalKarma", "operator": "<", "value": 100 },
        { "field": "emailVerified", "operator": "==", "value": false }
      ]
    },
    "action": "FLAG",
    "actionParams": {
      "reason": "New account with low karma - needs manual review"
    }
  },
  {
    "id": "negative-karma",
    "name": "Negative Karma Account",
    "type": "hard",
    "enabled": true,
    "priority": 90,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "totalKarma", "operator": "<", "value": -50 }
      ]
    },
    "action": "FLAG",
    "actionParams": {
      "reason": "Negative karma account - possible bad actor"
    }
  }
]
```

**AI Rules**:
```json
[
  {
    "id": "dating-intent",
    "name": "Dating/Hookup Intent Detection",
    "type": "ai",
    "enabled": true,
    "priority": 200,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "datingIntent.detected", "operator": "==", "value": true },
        { "field": "datingIntent.confidence", "operator": ">=", "value": 80 }
      ]
    },
    "action": "REMOVE",
    "actionParams": {
      "reason": "Dating/hookup seeking behavior detected (AI confidence: {confidence}%)",
      "comment": "Your post has been removed because it appears to be seeking dating or romantic connections. This subreddit is for friendships only.\n\nIf you believe this was a mistake, please [message the moderators](https://www.reddit.com/message/compose?to=/r/{subreddit})."
    }
  },
  {
    "id": "underage-detection",
    "name": "Potentially Underage User",
    "type": "ai",
    "enabled": true,
    "priority": 190,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "ageEstimate.range", "operator": "==", "value": "UNDER_25" },
        { "field": "ageEstimate.confidence", "operator": ">=", "value": 85 }
      ]
    },
    "action": "FLAG",
    "actionParams": {
      "reason": "User appears underage for this subreddit (AI confidence: {confidence}%)"
    }
  },
  {
    "id": "scammer-risk",
    "name": "High Scammer Risk",
    "type": "ai",
    "enabled": true,
    "priority": 180,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "scammerRisk", "operator": "==", "value": "HIGH" },
        { "field": "scammerRisk.confidence", "operator": ">=", "value": 75 }
      ]
    },
    "action": "FLAG",
    "actionParams": {
      "reason": "High scammer risk detected (AI confidence: {confidence}%)"
    }
  }
]
```

### For r/bitcointaxes

**Hard Rules**: Same as above

**AI Rules**:
```json
[
  {
    "id": "spam-detection",
    "name": "Spam Detection",
    "type": "ai",
    "enabled": true,
    "priority": 200,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "spamIndicators.detected", "operator": "==", "value": true },
        { "field": "spamIndicators.confidence", "operator": ">=", "value": 80 }
      ]
    },
    "action": "FLAG",
    "actionParams": {
      "reason": "Spam indicators detected (AI confidence: {confidence}%)"
    }
  }
]
```

---

## Testing Strategy

### Unit Tests

1. **Rule Condition Evaluation** (`src/rules/__tests__/conditions.test.ts`)
   - Test AND operator
   - Test OR operator
   - Test all comparison operators (>, <, >=, <=, ==, !=)
   - Test dot notation field access
   - Test missing fields

2. **Rules Engine** (`src/rules/__tests__/engine.test.ts`)
   - Test rule loading from Redis
   - Test priority ordering
   - Test disabled rules are skipped
   - Test AI rules only evaluated when aiAnalysis present
   - Test no rules matched → APPROVE
   - Test error in one rule doesn't break entire evaluation

3. **Action Executors** (`src/actions/__tests__/`)
   - Test each action type (FLAG, REMOVE, COMMENT, MESSAGE)
   - Test variable substitution in reason/comment

### Integration Tests

Test complete flow with mock rules:
- New low karma user → FLAG
- Dating intent detected → REMOVE with comment
- Moderator → APPROVE (bypass all rules)
- No AI available → hard rules only

### Manual Testing

Test in r/ai_automod_app_dev:
1. **Configure custom rules** via settings
2. **Test various user scenarios**:
   - New user with low karma
   - Old trusted user
   - User with dating language in history
   - Moderator
3. **Verify correct actions taken**
4. **Check audit logs**

---

## Implementation Plan

### Phase 3.1: Rule Storage & Loading (Priority 1)
- `src/types/rules.ts` - Type definitions
- `src/rules/storage.ts` - Redis storage operations
- `src/rules/defaults.ts` - Default rule sets
- **Tests**: Rule storage and retrieval
- **Time**: 3-4 hours

### Phase 3.2: Rule Evaluation Engine (Priority 2)
- `src/rules/engine.ts` - Core evaluation logic
- `src/rules/conditions.ts` - Condition evaluation
- **Tests**: Comprehensive unit tests for evaluation
- **Time**: 4-6 hours

### Phase 3.3: Action Executors (Priority 3)
- `src/actions/executor.ts` - Action execution
- `src/actions/formatters.ts` - Message formatting
- **Tests**: Unit tests for each action
- **Time**: 3-4 hours

### Phase 3.4: Configuration Interface (Priority 4)
- Update `src/main.tsx` - Add settings for rule configuration
- Add validation for JSON input
- **Time**: 2-3 hours

### Phase 3.5: Integration (Priority 5)
- Update `src/handlers/postSubmit.ts`
- Add error handling
- **Tests**: Integration tests
- **Time**: 3-4 hours

### Phase 3.6: Testing & Documentation (Priority 6)
- Manual testing in playtest
- Create moderator documentation
- Create example rule configurations
- **Time**: 4-6 hours

**Total estimated time**: 19-27 hours (2.5-3.5 days)

---

## Security & Safety

1. **JSON Validation**: Validate rule JSON before saving to Redis
2. **Rule Limits**: Max 50 rules per subreddit (prevent abuse)
3. **Action Safety**: No BAN action available (too dangerous)
4. **Fail-Safe**: On error, default to FLAG
5. **Audit Trail**: Log all rule evaluations and actions
6. **Manual Override**: Mods can always override/disable rules

---

## Success Criteria

### Configuration Usability
- Moderators can create/edit rules via settings
- Changes take effect within 5 minutes (cache refresh)
- Invalid JSON shows clear error message

### Rule Evaluation Performance
- Average rule evaluation time < 50ms
- No rule evaluation should block post submission
- Failed rule evaluation doesn't crash handler

### Action Execution Accuracy
- Actions execute correctly based on rule configuration
- Comments/messages use proper formatting
- Audit logs show which rules triggered

---

## Design Decisions (User Approved - 2025-10-27)

1. **Configuration Method**: ✅ JSON via Settings UI is acceptable for MVP. Visual rule builder deferred to Phase 4+.

2. **Rule Limits**: ✅ No artificial limits. Allow moderators to create as many rules as needed.

3. **Operator Support**: ✅ Add text matching operators:
   - `contains` - Check if field contains substring
   - `not_contains` - Check if field does NOT contain substring
   - `in` - Check if field matches any value in array
   - **Example**: `{ "field": "post.body", "operator": "contains", "value": "dating app" }`
   - **Example**: `{ "field": "post.title", "operator": "in", "value": ["seeking", "looking for love"] }`

4. **Complex Conditions**: ✅ Simple AND/OR sufficient for now. Nested conditions can be added later if needed.

5. **Dry Run Mode**: ✅ Add dry-run mode for testing rules without taking actions. Essential for testing confidence thresholds.

6. **MESSAGE Action**: ❌ Remove MESSAGE action. Pattern is COMMENT + REMOVE (comment explains why, then remove post).

7. **AI Detection Approach**: ✅ **Custom AI questions** instead of hardcoded detection types. Moderators write questions in natural language, AI responds with YES/NO + confidence.

---

## Next Steps

1. ✅ **User Approval** - Design approved with custom AI questions approach
2. **Update Phase 2** - Modify AI system to support custom questions instead of hardcoded checks
3. **Implementation** - Build Phase 3.1-3.6 in order
4. **Testing** - Comprehensive unit + integration tests with custom AI questions
5. **Documentation** - Create moderator guide for writing effective AI questions

---

**Status**: ✅ Approved - Ready for implementation
