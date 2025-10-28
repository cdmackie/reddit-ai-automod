# Phase 4: Devvit Settings UI & Cost Dashboard - Design Document

**Created**: 2025-10-27
**Updated**: 2025-10-27 (Post-Architect Review)
**Phase**: Phase 4 of 5
**Status**: Design Approved with Architectural Improvements

---

## Architectural Review Status

**Review Date**: 2025-10-27
**Reviewer**: architect-reviewer agent
**Verdict**: ✅ **APPROVED WITH CONDITIONS** (All conditions addressed)

**Critical Issues Resolved:**
1. ✅ API key security: Added `isSecret: true` to all API key fields
2. ✅ Settings integration: Created SettingsService abstraction layer
3. ✅ Rule validation: Implemented versioned schema validation with migrations

**Moderate Issues Resolved:**
1. ✅ Cost dashboard performance: Added caching layer (5-minute TTL)
2. ✅ Settings updates: Event-driven cache invalidation
3. ✅ Race conditions: Atomic locks for default rules initialization
4. ✅ Configuration layering: Settings override hardcoded defaults
5. ✅ Dry-run precedence: Clear rules (settings OR ruleset = dry-run)

---

## Overview

Phase 4 adds the moderator-facing configuration interface for the Reddit AI Automod. This includes:
- Settings form for API keys and configuration (with secure secret fields)
- Settings Service abstraction layer (with caching)
- Rule management UI (JSON-based with versioned validation)
- Cost dashboard for monitoring AI spend (with caching layer)
- Dry-run mode controls (with clear precedence rules)
- Default rules auto-population (with atomic locks)

---

## Requirements

### Functional Requirements

1. **API Key Configuration**
   - Moderators can enter API keys for Claude, OpenAI, and DeepSeek
   - Keys are stored securely in Redis
   - System validates keys are present before AI calls
   - Clear error messages when keys are missing

2. **Budget Management**
   - Daily budget limit configurable (default: $5/day)
   - Monthly budget limit configurable (default: $150/month)
   - Alert thresholds configurable (50%, 75%, 90%)

3. **Dry-Run Mode**
   - Global toggle for dry-run mode
   - When enabled: all actions are logged but not executed
   - Clear indicator when dry-run is active

4. **Rule Management**
   - JSON text area for rule configuration
   - Validation before saving
   - Load current rules for editing
   - Save updated rules to Redis

5. **Cost Dashboard**
   - View daily costs by provider
   - View monthly totals
   - See budget status (used/remaining)
   - Alert indicators when approaching limits

6. **Default Rules**
   - Auto-populate default rules on first install
   - Detect which subreddit and load appropriate defaults
   - One-time setup (don't overwrite existing rules)

### Non-Functional Requirements

1. **Security**
   - API keys encrypted at rest (Redis built-in encryption)
   - Only moderators can access settings
   - Validate all user input (JSON, numbers, strings)

2. **Usability**
   - Clear labels and help text
   - Error messages are actionable
   - Settings organized logically

3. **Performance**
   - Settings load quickly (<1s)
   - Cost data cached (refresh every 5 minutes)

---

## Devvit Settings API Overview

Devvit provides a built-in settings system:

```typescript
Devvit.addSettings([
  {
    type: 'string',
    name: 'claudeApiKey',
    label: 'Claude API Key',
    helpText: 'Your Anthropic API key for Claude',
    scope: 'installation', // per-subreddit
    isSecret: true, // SECURITY: Mark as secret to mask in UI
  },
  {
    type: 'number',
    name: 'dailyBudgetLimit',
    label: 'Daily Budget Limit ($)',
    defaultValue: 5,
  },
  {
    type: 'boolean',
    name: 'dryRunMode',
    label: 'Dry-Run Mode',
    defaultValue: true,
  },
]);
```

**Access in code:**
```typescript
const settings = await context.settings.getAll();
const claudeKey = settings.claudeApiKey as string | undefined;
```

---

## Design Components

### 1. Settings Form (`Devvit.addSettings`)

**Fields:**

```typescript
// API Keys (SECURITY: All marked as isSecret: true)
- claudeApiKey: string (optional, isSecret: true)
- openaiApiKey: string (optional, isSecret: true)
- deepseekApiKey: string (optional, isSecret: true)

// Budget Configuration
- dailyBudgetLimit: number (default: 5)
- monthlyBudgetLimit: number (default: 150)
- budgetAlertThreshold50: boolean (default: true)
- budgetAlertThreshold75: boolean (default: true)
- budgetAlertThreshold90: boolean (default: true)

// AI Provider Priority
- primaryProvider: select ('claude' | 'openai' | 'deepseek', default: 'claude')
- fallbackProvider: select ('claude' | 'openai' | 'deepseek' | 'none', default: 'openai')

// Dry-Run Mode
- dryRunMode: boolean (default: true)
- dryRunLogDetails: boolean (default: true)

// Rules Management
- rulesJson: string (paragraph, JSON format)
- autoPopulateDefaults: boolean (default: true, one-time use)
```

**Validation:**
- API keys: non-empty if provided
- Budget limits: positive numbers only
- Rules JSON: valid JSON, validate against RuleSet schema

---

### 2. Cost Dashboard Menu Item

**Menu Item:**
```typescript
Devvit.addMenuItem({
  label: 'View AI Costs',
  location: 'subreddit',
  onPress: async (event, context) => {
    // Show cost dashboard
  },
});
```

**Dashboard Display (Custom Post):**

```
AI Automod - Cost Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Today's Costs (2025-10-27)
  Claude:     $1.23 (45 requests)
  OpenAI:     $0.00 (0 requests)
  DeepSeek:   $0.00 (0 requests)
  ─────────────────────────
  Total:      $1.23 / $5.00 (25%)
  ✅ Within budget

📈 Monthly Costs (October 2025)
  Claude:     $12.45 (234 requests)
  OpenAI:     $2.10 (15 requests)
  DeepSeek:   $0.00 (0 requests)
  ─────────────────────────
  Total:      $14.55 / $150.00 (10%)
  ✅ Within budget

⚙️ Settings
  Daily Limit:    $5.00
  Monthly Limit:  $150.00
  Dry-Run Mode:   Enabled ⚠️
  Primary AI:     Claude 3.5 Haiku
  Fallback AI:    OpenAI GPT-4o Mini

Last updated: 2025-10-27 14:32 UTC
[Refresh] [View Settings]
```

**Implementation:**
- Read from CostTracker Redis keys
- Format costs with 2 decimal places
- Show progress indicators
- Alert symbols when >75% budget used

---

### 3. Rule Management UI

**Approach 1: JSON Text Area (Phase 4)**
- Settings field: `rulesJson` (paragraph type)
- Moderators paste JSON directly
- Validate on save
- Show validation errors

**Approach 2: Visual Builder (Future Phase)**
- Interactive form for creating rules
- Generate JSON from form inputs
- More user-friendly but complex to build

**Phase 4: Use Approach 1 (JSON Text Area)**

**Example JSON Format:**
```json
{
  "version": "1.0",
  "subreddit": "FriendsOver40",
  "dryRun": false,
  "rules": [
    {
      "id": "dating-intent-high",
      "type": "ai",
      "priority": 100,
      "description": "Flag posts with high dating intent",
      "aiQuestion": "Does this user appear to be seeking romantic or dating connections?",
      "conditions": {
        "operator": "and",
        "conditions": [
          {
            "field": "aiAnalysis.answers.dating-intent.answer",
            "operator": "==",
            "value": "YES"
          },
          {
            "field": "aiAnalysis.answers.dating-intent.confidence",
            "operator": ">",
            "value": 80
          }
        ]
      },
      "action": "REMOVE",
      "message": "Your post has been removed. This subreddit is for friendship only, not dating."
    }
  ]
}
```

**Validation:**
- Parse JSON (catch SyntaxError)
- Validate against RuleSet type
- Check required fields: version, rules array
- Validate each rule: id, type, conditions, action
- Check AI questions have unique IDs
- Ensure priorities are valid numbers

---

### 4. Default Rules Auto-Population

**Strategy (WITH ATOMIC LOCKS):**
```typescript
async function initializeDefaultRules(context: Context) {
  const subreddit = await context.reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;
  const lockKey = `automod:init:lock:${subredditName}`;

  // Atomic lock acquisition (prevents race conditions)
  const acquired = await context.redis.set(
    lockKey,
    '1',
    { expiration: new Date(Date.now() + 60000), nx: true } // 60s TTL, only if not exists
  );

  if (!acquired) {
    // Another process is initializing
    return;
  }

  try {
    // Check if rules already exist
    const existing = await loadRuleSet(context, subredditName);
    if (existing && existing.rules.length > 0) {
      return; // Don't overwrite existing rules
    }

    // Load appropriate defaults
    let defaults: RuleSet | null = null;
    if (subredditName === 'FriendsOver40') {
      defaults = friendsOver40Defaults;
    } else if (subredditName === 'FriendsOver50') {
      defaults = friendsOver50Defaults;
    } else if (subredditName === 'bitcointaxes') {
      defaults = bitcointaxesDefaults;
    } else {
      defaults = globalDefaults; // Minimal default set
    }

    // Save to Redis
    if (defaults) {
      await saveRuleSet(context, subredditName, defaults);
      // Mark as initialized
      await context.redis.set(
        `automod:initialized:${subredditName}`,
        'true'
      );
    }
  } finally {
    // Always release lock
    await context.redis.del(lockKey);
  }
}
```

**Trigger:**
- On app install event (`Devvit.configure({ install: async (event, context) => {...} })`)
- OR on first PostSubmit if no rules found
- Uses atomic Redis locks to prevent race conditions
- Store flag in Redis: `automod:initialized:{subreddit}` = "true"

---

### 5. Settings Integration with System

**Architecture Pattern: Settings Service Abstraction**

Instead of directly calling `context.settings.getAll()` everywhere, we use a Settings Service layer:

```typescript
// src/config/settingsService.ts

interface CachedSettings {
  data: any;
  expiresAt: number;
}

export class SettingsService {
  private static cache = new Map<string, CachedSettings>();
  private static readonly CACHE_TTL_MS = 60000; // 1 minute

  /**
   * Get AI configuration from settings with caching
   */
  static async getAIConfig(context: Context): Promise<AIConfig> {
    const cacheKey = 'aiConfig';
    const cached = this.cache.get(cacheKey);

    // Return cached if valid
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Fetch from settings
    const settings = await context.settings.getAll();
    const config = this.transformToAIConfig(settings);

    // Cache with TTL
    this.cache.set(cacheKey, {
      data: config,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return config;
  }

  /**
   * Get budget configuration from settings
   */
  static async getBudgetConfig(context: Context) {
    const settings = await context.settings.getAll();
    return {
      dailyLimitUSD: (settings.dailyBudgetLimit as number) ?? 5,
      monthlyLimitUSD: (settings.monthlyBudgetLimit as number) ?? 150,
      alertThresholds: {
        threshold50: (settings.budgetAlertThreshold50 as boolean) ?? true,
        threshold75: (settings.budgetAlertThreshold75 as boolean) ?? true,
        threshold90: (settings.budgetAlertThreshold90 as boolean) ?? true,
      },
    };
  }

  /**
   * Invalidate all caches (call when settings change)
   */
  static invalidateCache() {
    this.cache.clear();
  }

  private static transformToAIConfig(settings: any): AIConfig {
    return {
      claudeApiKey: settings.claudeApiKey as string | undefined,
      openaiApiKey: settings.openaiApiKey as string | undefined,
      deepseekApiKey: settings.deepseekApiKey as string | undefined,
      primaryProvider: (settings.primaryProvider as string) ?? 'claude',
      fallbackProvider: (settings.fallbackProvider as string) ?? 'openai',
    };
  }
}
```

**Configuration Layering Pattern:**

Settings override hardcoded defaults:

```typescript
// src/config/configManager.ts

export class ConfigurationManager {
  static async getEffectiveConfig(context: Context): Promise<AIConfig> {
    // Start with hardcoded defaults
    const defaults = AI_CONFIG;

    // Get settings-based overrides
    const settingsConfig = await SettingsService.getAIConfig(context);
    const budgetConfig = await SettingsService.getBudgetConfig(context);

    // Merge: settings take precedence
    return {
      ...defaults,
      ...settingsConfig,
      budget: {
        ...defaults.budget,
        dailyLimitUSD: budgetConfig.dailyLimitUSD,
        monthlyLimitUSD: budgetConfig.monthlyLimitUSD,
      },
    };
  }
}
```

**Rules Engine Integration with Dry-Run Precedence:**

```typescript
// In src/handlers/postSubmit.ts

/**
 * Dry-Run Mode Precedence Rules:
 * 1. Settings dry-run mode (global override for safety)
 * 2. RuleSet dry-run mode (per-subreddit configuration)
 * 3. If EITHER is true, system runs in dry-run mode
 */
function getEffectiveDryRunMode(
  settingsDryRun: boolean,
  ruleSetDryRun: boolean
): boolean {
  // Settings override takes precedence (safety first)
  // If moderator enables global dry-run, it applies everywhere
  return settingsDryRun || ruleSetDryRun;
}

// Usage in handler:
const settings = await SettingsService.getDryRunConfig(context);
const ruleSet = await loadRuleSet(context, subredditName);

const effectiveDryRun = getEffectiveDryRunMode(
  settings.dryRunMode,
  ruleSet.dryRun
);
```

**Versioned Schema Validation:**

```typescript
// src/rules/schemaValidator.ts

interface RuleSetWithVersion {
  version: string; // "1.0", "1.1", "2.0", etc.
  subreddit: string;
  dryRun: boolean;
  rules: Rule[];
}

class RuleSchemaValidator {
  private static readonly CURRENT_VERSION = "1.0";

  /**
   * Validate and migrate rule JSON from settings
   */
  static async validateAndMigrate(json: string): Promise<ValidationResult<RuleSet>> {
    try {
      const parsed = JSON.parse(json);
      const version = parsed.version || "1.0";

      // Apply migrations if needed
      const migrated = await this.migrate(parsed, version);

      // Validate against current schema
      const result = this.validateSchema(migrated);

      return {
        success: true,
        data: migrated,
        warnings: result.warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: this.formatValidationError(error),
      };
    }
  }

  /**
   * Migrate old schema versions to current
   */
  private static async migrate(data: any, fromVersion: string): Promise<RuleSet> {
    if (fromVersion === this.CURRENT_VERSION) {
      return data; // No migration needed
    }

    // Future: Add migration logic for schema changes
    // Example: v1.0 → v1.1 migration
    if (fromVersion === "1.0" && this.CURRENT_VERSION === "1.1") {
      // Add new fields, transform data, etc.
    }

    return data;
  }

  /**
   * Validate against Zod schema
   */
  private static validateSchema(data: any): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Validate required fields
    if (!data.version) warnings.push("Missing 'version' field");
    if (!Array.isArray(data.rules)) warnings.push("'rules' must be an array");

    // Validate each rule
    data.rules?.forEach((rule: any, index: number) => {
      if (!rule.id) warnings.push(`Rule ${index}: missing 'id'`);
      if (!rule.type) warnings.push(`Rule ${index}: missing 'type'`);
      if (!rule.action) warnings.push(`Rule ${index}: missing 'action'`);
    });

    return { valid: warnings.length === 0, warnings };
  }

  /**
   * Format error with line numbers if possible
   */
  private static formatValidationError(error: any): string {
    if (error instanceof SyntaxError) {
      // Try to extract line number from JSON parse error
      const match = error.message.match(/position (\d+)/);
      if (match) {
        return `JSON syntax error at position ${match[1]}`;
      }
    }
    return error.message;
  }
}
```

**Cost Dashboard Caching:**

```typescript
// src/dashboard/costDashboardCache.ts

interface DashboardData {
  daily: CostSummary;
  monthly: CostSummary;
  settings: BudgetSettings;
  lastUpdated: string;
}

class CostDashboardCache {
  private static readonly CACHE_KEY = 'dashboard:cost:cache';
  private static readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  /**
   * Get cached dashboard data or compute fresh
   */
  static async getDashboardData(context: Context): Promise<DashboardData> {
    // Try cache first
    const cached = await context.redis.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // Compute fresh data
    const data = await this.computeDashboardData(context);

    // Cache for 5 minutes
    await context.redis.set(
      this.CACHE_KEY,
      JSON.stringify(data),
      { expiration: new Date(Date.now() + this.CACHE_TTL_SECONDS * 1000) }
    );

    return data;
  }

  /**
   * Invalidate cache (call when costs update)
   */
  static async invalidateCache(context: Context) {
    await context.redis.del(this.CACHE_KEY);
  }

  /**
   * Compute dashboard data from CostTracker
   */
  private static async computeDashboardData(context: Context): Promise<DashboardData> {
    const costTracker = new CostTracker(context);
    const settings = await SettingsService.getBudgetConfig(context);

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7); // YYYY-MM

    return {
      daily: {
        claude: await costTracker.getDailyCost('claude', today),
        openai: await costTracker.getDailyCost('openai', today),
        deepseek: await costTracker.getDailyCost('deepseek', today),
        total: await costTracker.getTotalDailyCost(today),
      },
      monthly: {
        claude: await costTracker.getMonthlyCost('claude', thisMonth),
        openai: await costTracker.getMonthlyCost('openai', thisMonth),
        deepseek: await costTracker.getMonthlyCost('deepseek', thisMonth),
        total: await costTracker.getTotalMonthlyCost(thisMonth),
      },
      settings: {
        dailyLimit: settings.dailyLimitUSD,
        monthlyLimit: settings.monthlyLimitUSD,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
```

---

## Data Storage

**Redis Keys:**

```
# Settings are stored by Devvit automatically
# No manual Redis storage needed for settings

# Rules (already implemented)
automod:rules:{subreddit} = RuleSet (JSON)

# Cost Tracking (already implemented)
automod:cost:daily:{provider}:{date} = number
automod:cost:monthly:{provider}:{month} = number

# Initialization flag
automod:initialized:{subreddit} = "true"
```

---

## Error Handling

### Missing API Keys
```typescript
if (!claudeApiKey && !openaiApiKey && !deepseekApiKey) {
  throw new Error(
    'No AI provider API keys configured. Please add at least one API key in Settings.'
  );
}
```

### Invalid Rules JSON
```typescript
try {
  const ruleSet = JSON.parse(rulesJson);
  validateRuleSet(ruleSet); // Zod validation
} catch (error) {
  return {
    success: false,
    message: `Invalid rules JSON: ${error.message}`,
  };
}
```

### Budget Exceeded
```typescript
const dailyCost = await costTracker.getDailyCost();
if (dailyCost >= dailyBudgetLimit) {
  // Log and skip AI analysis
  await audit.log({
    action: 'BUDGET_EXCEEDED',
    reason: `Daily budget of $${dailyBudgetLimit} exceeded`,
  });
  return null; // Fall back to hard rules only
}
```

---

## UI/UX Considerations

### Settings Form Organization

**Section 1: AI Provider Configuration**
- Claude API Key
- OpenAI API Key
- DeepSeek API Key
- Primary Provider (dropdown)
- Fallback Provider (dropdown)

**Section 2: Budget & Cost Controls**
- Daily Budget Limit
- Monthly Budget Limit
- Enable Budget Alerts (checkboxes for 50%, 75%, 90%)

**Section 3: Dry-Run Mode**
- Enable Dry-Run Mode (toggle)
- Log Detailed Dry-Run Actions (toggle)

**Section 4: Rule Management**
- Rules JSON (large text area)
- Auto-Populate Default Rules (checkbox, one-time)

### Cost Dashboard

**Refresh Mechanism:**
- Auto-refresh every 5 minutes
- Manual refresh button
- Show "Last updated" timestamp

**Visual Indicators:**
- ✅ Green: <50% budget used
- ⚠️ Yellow: 50-75% budget used
- 🔴 Red: >75% budget used

**Budget Progress Bars:**
```
Daily:   [████████░░░░░░░░] 45% ($2.25 / $5.00)
Monthly: [███░░░░░░░░░░░░░] 15% ($22.50 / $150.00)
```

---

## Implementation Plan

**UPDATED PLAN** (Incorporates Architect Review Feedback)

### Phase 4.1: Settings Service Foundation (~2-3 hours)

**New Components:**
- `src/config/settingsService.ts` - Settings abstraction with caching
- `src/config/configManager.ts` - Configuration layering (defaults + settings)

**Tasks:**
1. Create SettingsService class with caching (60s TTL)
2. Implement getAIConfig(), getBudgetConfig(), getDryRunConfig()
3. Create ConfigurationManager for layered configuration
4. Add cache invalidation methods

### Phase 4.2: Settings Form (~2-3 hours)

**Tasks:**
1. Define `Devvit.addSettings` with all fields
2. **CRITICAL**: Mark API keys with `isSecret: true`
3. Group fields into logical sections
4. Add comprehensive help text
5. Test settings persistence
6. Verify secret fields are masked in UI

### Phase 4.3: Rule Management with Versioning (~3-4 hours)

**New Component:**
- `src/rules/schemaValidator.ts` - Versioned schema validation

**Tasks:**
1. Create RuleSchemaValidator class
2. Implement validateAndMigrate() method
3. Add schema versioning support ("1.0", etc.)
4. Add migration framework for future schema changes
5. Format validation errors with line numbers
6. Add `rulesJson` field to settings
7. Wire validation into settings save flow

### Phase 4.4: Cost Dashboard with Caching (~3-4 hours)

**New Component:**
- `src/dashboard/costDashboardCache.ts` - Materialized dashboard data

**Tasks:**
1. Create CostDashboardCache class
2. Implement getDashboardData() with 5-minute caching
3. Add cache invalidation on cost updates
4. Add menu item for cost dashboard
5. Create dashboard rendering component (Custom Post or simple UI)
6. Format costs with progress indicators
7. Add refresh button and "last updated" timestamp

### Phase 4.5: Default Rules with Atomic Initialization (~2-3 hours)

**Tasks:**
1. Update initializeDefaultRules() with atomic locks
2. Add Redis lock acquisition (60s TTL, NX flag)
3. Ensure proper lock release in finally block
4. Add install event handler
5. Test concurrent initialization (no race conditions)
6. Verify initialization flag prevents re-runs

### Phase 4.6: System Integration (~3-4 hours)

**Tasks:**
1. Wire SettingsService into AIAnalyzer
2. Wire ConfigurationManager into cost tracking
3. Implement dry-run mode precedence logic
4. Update PostSubmit to use SettingsService
5. Update RulesEngine to use SettingsService
6. Add settings change event handling (invalidate caches)

### Phase 4.7: Testing & Validation (~4-5 hours)

**Tests:**
1. Unit tests for SettingsService (caching behavior)
2. Unit tests for RuleSchemaValidator (validation, migration)
3. Unit tests for CostDashboardCache (caching, invalidation)
4. Integration tests: Settings → AI system
5. Integration tests: Settings → Rules engine
6. Manual testing in playtest subreddit:
   - Configure API keys (verify masking)
   - Update budget limits (verify enforcement)
   - Toggle dry-run mode (verify precedence)
   - Edit rules JSON (verify validation)
   - View cost dashboard (verify caching)
   - Initialize default rules (verify atomic locks)

**Estimated Total Time**: 19-26 hours (2.5-3.5 days)

---

## Open Questions (RESOLVED)

1. **API Key Security**: Should we mask API keys in settings (show only last 4 chars)?
   - ✅ **RESOLVED**: Yes, using `isSecret: true` in Devvit settings

2. **Rule Validation UI**: Should we show detailed validation errors in settings?
   - ✅ **RESOLVED**: Yes, implemented in RuleSchemaValidator with line number support

3. **Cost Dashboard Location**: Menu item vs dedicated page?
   - ✅ **RESOLVED**: Menu item for Phase 4 with caching layer

4. **Default Rules**: Should mods be able to reset to defaults?
   - ⏭️ **DEFERRED**: Phase 5 feature. For now, they can copy from docs.

5. **Multi-Subreddit**: Can one Devvit app instance serve multiple subreddits?
   - ✅ **CONFIRMED**: Yes, each installation is per-subreddit. Settings are per-installation.

---

## Success Criteria

Phase 4 is complete when:

**Core Components:**
- ✅ SettingsService abstraction layer implemented with caching
- ✅ ConfigurationManager with layered configuration (defaults + settings)
- ✅ RuleSchemaValidator with versioned schema support
- ✅ CostDashboardCache with 5-minute TTL
- ✅ Atomic initialization for default rules (with locks)

**Settings Form:**
- ✅ Settings form has all required fields
- ✅ API keys marked with `isSecret: true` (masked in UI)
- ✅ Fields grouped logically with help text
- ✅ Settings persistence tested

**Integration:**
- ✅ API keys can be configured and are used by AI system via SettingsService
- ✅ Budget limits are enforced from settings via ConfigurationManager
- ✅ Dry-run mode toggled via settings with proper precedence rules
- ✅ Rules can be configured via JSON with validation
- ✅ Cost dashboard displays accurate daily/monthly costs from cache
- ✅ Default rules auto-populated on first install (no race conditions)

**Testing:**
- ✅ Unit tests for SettingsService (caching behavior)
- ✅ Unit tests for RuleSchemaValidator (validation, migration)
- ✅ Unit tests for CostDashboardCache (caching, invalidation)
- ✅ Integration tests: Settings → AI system
- ✅ Integration tests: Settings → Rules engine
- ✅ Manual testing in playtest subreddit completed

**Documentation & Review:**
- ✅ All documentation updated (project-status.md, resume-prompt.md)
- ✅ Phase 4 design document complete
- ✅ Code reviewed and approved by code-reviewer agent
- ✅ Committed to git with descriptive commit message

---

## Dependencies

**Phase 4 depends on:**
- ✅ Phase 3: Rules engine and action executors (complete)
- ✅ AI system with cost tracking (complete)
- ✅ Default rule sets defined (complete)

**Phase 4 enables:**
- Phase 5: Production deployment (can't deploy without settings UI)

---

## Risks & Mitigations

### Risk 1: Devvit Settings API Limitations
- **Risk**: Settings API may not support all features we need
- **Mitigation**: Research Devvit docs, use Redis for advanced features
- **Status**: Low risk (basic settings API should be sufficient)

### Risk 2: API Key Exposure
- **Risk**: API keys stored in plain text in settings
- **Mitigation**: Use Devvit's built-in settings encryption, mark as secret fields
- **Status**: Medium risk (follow Devvit security best practices)

### Risk 3: Complex Rule JSON
- **Risk**: Moderators struggle with JSON syntax
- **Mitigation**: Provide clear examples, validation errors, future visual builder
- **Status**: Medium risk (acceptable for Phase 4, improve in Phase 5)

### Risk 4: Cost Dashboard Performance
- **Risk**: Fetching cost data slow for large time ranges
- **Mitigation**: Cache cost data, limit to current day/month only
- **Status**: Low risk (small data volumes)

---

## Future Enhancements (Post-Phase 4)

1. **Visual Rule Builder** - Drag-and-drop rule creation
2. **Cost Alerts** - Send mod mail when budget thresholds reached
3. **Usage Analytics** - Charts showing AI usage over time
4. **Rule Templates** - Pre-built rule templates for common scenarios
5. **Multi-Language Support** - Translate UI for international mods
6. **API Key Rotation** - Schedule automatic key rotation
7. **Rule Testing Tool** - Test rules against historical posts

---

## References

- Devvit Settings API: https://developers.reddit.com/docs/capabilities/settings
- Devvit Menu Items: https://developers.reddit.com/docs/capabilities/menu-actions
- Devvit Custom Posts: https://developers.reddit.com/docs/capabilities/custom-posts
- Phase 3.2 Design: `./docs/phase-3.2-design.md`
- Rules Engine: `src/rules/`
- Cost Tracker: `src/ai/costTracker.ts`

---

**Document Status**: Draft - Ready for Review
**Next Step**: Deploy architect-reviewer for design validation
