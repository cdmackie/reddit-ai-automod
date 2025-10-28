# Phase 4.6: System Integration - Implementation Request for javascript-pro

**Date**: 2025-10-28
**Agent**: javascript-pro
**Task**: Implement all Phase 4.6 system integrations according to specification

---

## Overview

This is the FINAL integration phase. You will wire all Settings components (Phases 4.1-4.5) into the existing AI system, Rules Engine, and Event Handlers. This makes settings actually control system behavior.

**Reference Document**: See `/home/cdm/redditmod/docs/phase-4.6-integration-spec.md` for full specification.

---

## Files to Modify

1. **src/handlers/postSubmit.ts**
   - Replace direct storage loading with `loadRulesFromSettings()`
   - Implement dry-run mode precedence (settings OR ruleSet)
   - Add imports: `loadRulesFromSettings`, `SettingsService`

2. **src/ai/analyzer.ts**
   - Use `ConfigurationManager.getEffectiveAIConfig()` instead of hardcoded `AI_CONFIG`
   - Check `hasConfiguredProviders()` before analysis
   - Initialize providers only when API keys are configured
   - Add import: `ConfigurationManager`

3. **src/ai/costTracker.ts**
   - Use `SettingsService.getBudgetConfig()` for limits in `getBudgetStatus()`
   - Use settings-based limits in `canAfford()`
   - Invalidate dashboard cache at end of `trackCost()`
   - Add imports: `SettingsService`, `CostDashboardCache`

4. **src/rules/engine.ts**
   - Replace `loadRuleSet()` calls with `loadRulesFromSettings()`
   - Add import: `loadRulesFromSettings`

---

## Implementation Details

### Task 1: PostSubmit Handler Integration

**File**: `src/handlers/postSubmit.ts`

#### Change 1: Replace rule loading (around line 150-157)

**FIND**:
```typescript
// 2. Initialize rules engine
const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

// 3. Check if AI analysis is needed for this subreddit
const needsAI = await rulesEngine.needsAIAnalysis(subredditName);
```

**REPLACE WITH**:
```typescript
// 2. Load rules from settings (with validation and defaults)
const ruleSet = await loadRulesFromSettings(context as Devvit.Context, subredditName);

// 3. Initialize rules engine
const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

// 4. Check if AI analysis is needed for this subreddit
const needsAI = await rulesEngine.needsAIAnalysis(subredditName);
```

**ADD IMPORT** (top of file, after existing imports):
```typescript
import { loadRulesFromSettings } from '../rules/schemaValidator.js';
```

#### Change 2: Dry-run mode precedence (around line 220-240)

**FIND** (line ~147):
```typescript
// Phase 3.3: Rules engine integration with optional AI analysis
console.log(`[PostSubmit] User ${author} not trusted, evaluating rules...`);
```

**ADD AFTER THIS LINE**:
```typescript
// Get dry-run configuration (settings take precedence)
const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
```

**FIND** (line ~220-230):
```typescript
// 5. Evaluate rules
const startTime = Date.now();
const ruleResult = await rulesEngine.evaluateRules(evalContext);
const executionTime = Date.now() - startTime;

console.log(`[PostSubmit] Rule evaluation complete:`, {
  action: ruleResult.action,
  matchedRule: ruleResult.matchedRule,
  confidence: ruleResult.confidence,
  dryRun: ruleResult.dryRun,
  executionTime,
});
```

**REPLACE WITH**:
```typescript
// 5. Evaluate rules
const startTime = Date.now();
const ruleResult = await rulesEngine.evaluateRules(evalContext);
const executionTime = Date.now() - startTime;

// Effective dry-run: settings OR ruleSet (safety first)
const effectiveDryRun = dryRunConfig.dryRunMode || ruleResult.dryRun;

console.log(`[PostSubmit] Rule evaluation complete:`, {
  action: ruleResult.action,
  matchedRule: ruleResult.matchedRule,
  confidence: ruleResult.confidence,
  settingsDryRun: dryRunConfig.dryRunMode,
  ruleSetDryRun: ruleResult.dryRun,
  effectiveDryRun: effectiveDryRun,
  executionTime,
});
```

**FIND ALL** instances of `ruleResult.dryRun` (lines ~234, ~246) and **REPLACE WITH** `effectiveDryRun`:
- Line ~234: `dryRun: ruleResult.dryRun,` → `dryRun: effectiveDryRun,`
- Line ~246: `dryRun: ruleResult.dryRun,` → `dryRun: effectiveDryRun,`

**ADD IMPORT** (top of file):
```typescript
import { SettingsService } from '../config/settingsService.js';
```

---

### Task 2: AIAnalyzer Integration

**File**: `src/ai/analyzer.ts`

#### Change 1: Add ConfigurationManager import

**FIND** (line ~98):
```typescript
import { getCacheTTLForTrustScore } from '../config/ai.js';
```

**ADD AFTER**:
```typescript
import { ConfigurationManager } from '../config/configManager.js';
```

#### Change 2: Use ConfigurationManager in analyzeUserWithQuestions()

**FIND** the `analyzeUserWithQuestions()` method (around line 250-350).

**LOCATE** the budget check section (should be around line 260-280):
```typescript
// Check budget before analysis
const costTracker = CostTracker.getInstance(this.context);
const estimatedCost = this.estimateCost(questions.length);

if (!(await costTracker.canAfford(estimatedCost))) {
  console.warn(
    `[AIAnalyzer] Budget exceeded - estimated cost $${estimatedCost.toFixed(4)} not affordable`
  );
  return null;
}
```

**ADD BEFORE** the budget check:
```typescript
// Get effective AI configuration from settings
const config = await ConfigurationManager.getEffectiveAIConfig(this.context);

// Check if any providers are configured
if (!ConfigurationManager.hasConfiguredProviders(config)) {
  console.warn('[AIAnalyzer] No AI providers configured (missing API keys) - skipping analysis');
  return null;
}
```

#### Change 3: Update provider initialization

**FIND** where ProviderSelector is instantiated (likely in `analyzeUserWithQuestions()` or a helper method).

The current code likely looks like:
```typescript
const providerSelector = ProviderSelector.getInstance(this.context);
```

**IF ProviderSelector.getInstance() exists**, we need to modify it to accept configuration.

**SEARCH** for `ProviderSelector.getInstance()` implementation (likely in `selector.ts`).

**ALTERNATIVE APPROACH** (if getInstance doesn't accept config):

**ADD** a new method to `analyzer.ts` called `getProviderSelector()`:

```typescript
/**
 * Get or create provider selector with configured providers
 * @private
 */
private async getProviderSelector(): Promise<ProviderSelector | null> {
  // Get effective configuration
  const config = await ConfigurationManager.getEffectiveAIConfig(this.context);

  // Initialize providers only if API keys are configured
  const providers: Map<AIProviderType, IAIProvider> = new Map();

  // Claude provider
  if (config.providers.claude.enabled && config.providers.claude.apiKey) {
    const { ClaudeProvider } = await import('./claude.js');
    providers.set('claude', new ClaudeProvider(config.providers.claude.apiKey));
  }

  // OpenAI provider
  if (config.providers.openai.enabled && config.providers.openai.apiKey) {
    const { OpenAIProvider } = await import('./openai.js');
    providers.set('openai', new OpenAIProvider(config.providers.openai.apiKey));
  }

  // DeepSeek provider
  if (config.providers.deepseek.enabled && config.providers.deepseek.apiKey) {
    const { DeepSeekProvider } = await import('./deepseek.js');
    providers.set('deepseek', new DeepSeekProvider(config.providers.deepseek.apiKey));
  }

  // Validate at least one provider configured
  if (providers.size === 0) {
    console.error('[AIAnalyzer] No AI providers configured (missing API keys)');
    return null;
  }

  // Return new ProviderSelector with configured providers
  return new ProviderSelector(
    this.context,
    Array.from(providers.values()),
    config.primaryProvider,
    config.fallbackProvider
  );
}
```

**THEN UPDATE** `analyzeUserWithQuestions()` to use it:

**FIND**:
```typescript
const providerSelector = ProviderSelector.getInstance(this.context);
```

**REPLACE WITH**:
```typescript
const providerSelector = await this.getProviderSelector();
if (!providerSelector) {
  console.warn('[AIAnalyzer] No providers available - skipping analysis');
  return null;
}
```

**IMPORTANT**: Check the actual ProviderSelector constructor signature to ensure the parameters match.

---

### Task 3: CostTracker Integration

**File**: `src/ai/costTracker.ts`

#### Change 1: Add imports

**FIND** (top of file, after existing imports):
```typescript
import { Devvit } from '@devvit/public-api';
import { AIProviderType, CostRecord, BudgetStatus, SpendingReport } from '../types/ai.js';
```

**ADD AFTER**:
```typescript
import { SettingsService } from '../config/settingsService.js';
import { CostDashboardCache } from '../dashboard/costDashboardCache.js';
```

#### Change 2: Update getBudgetStatus() method

**FIND** the `getBudgetStatus()` method (around line 300-350):
```typescript
async getBudgetStatus(): Promise<BudgetStatus> {
  const dailySpent = await this.getDailySpent();
  const monthlySpent = await this.getMonthlySpent();

  return {
    dailySpent,
    monthlySpent,
    dailyLimit: centsToUSD(this.config.dailyLimitCents),
    monthlyLimit: centsToUSD(this.config.monthlyLimitCents),
    // ... rest of status
  };
}
```

**REPLACE WITH**:
```typescript
async getBudgetStatus(): Promise<BudgetStatus> {
  // Get budget limits from settings (falls back to defaults)
  const budgetConfig = await SettingsService.getBudgetConfig(this.context);

  const dailySpent = await this.getDailySpent();
  const monthlySpent = await this.getMonthlySpent();

  return {
    dailySpent,
    monthlySpent,
    dailyLimit: budgetConfig.dailyLimitUSD,
    monthlyLimit: budgetConfig.monthlyLimitUSD,
    dailyRemaining: Math.max(0, budgetConfig.dailyLimitUSD - dailySpent),
    monthlyRemaining: Math.max(0, budgetConfig.monthlyLimitUSD - monthlySpent),
    percentUsed: (dailySpent / budgetConfig.dailyLimitUSD) * 100,
    isOverBudget: dailySpent >= budgetConfig.dailyLimitUSD,
    alerts: this.generateAlerts(dailySpent, budgetConfig),
  };
}
```

**NOTE**: If `generateAlerts()` doesn't exist, you can simplify to:
```typescript
alerts: budgetConfig.alertThresholds
  .filter(threshold => dailySpent >= budgetConfig.dailyLimitUSD * threshold)
  .map(threshold => `${(threshold * 100).toFixed(0)}% budget threshold exceeded`)
```

#### Change 3: Update canAfford() method

**FIND** the `canAfford()` method (around line 250-280):
```typescript
async canAfford(estimatedCostUSD: number): Promise<boolean> {
  const dailySpent = await this.getDailySpent();
  const dailyLimitUSD = centsToUSD(this.config.dailyLimitCents);
  return dailySpent + estimatedCostUSD <= dailyLimitUSD;
}
```

**REPLACE WITH**:
```typescript
async canAfford(estimatedCostUSD: number): Promise<boolean> {
  const budgetConfig = await SettingsService.getBudgetConfig(this.context);
  const dailySpent = await this.getDailySpent();
  return dailySpent + estimatedCostUSD <= budgetConfig.dailyLimitUSD;
}
```

#### Change 4: Invalidate dashboard cache in trackCost()

**FIND** the `trackCost()` method (around line 200-250).

**LOCATE** the last line (probably a console.log):
```typescript
console.log(`[CostTracker] Recorded cost: $${costRecord.costUSD.toFixed(4)}`);
```

**ADD AFTER** (as the very last line of the method):
```typescript
// Invalidate dashboard cache when costs change
await CostDashboardCache.invalidateCache(this.context);
```

---

### Task 4: Rules Engine Integration

**File**: `src/rules/engine.ts`

#### Change 1: Check for direct storage usage

**SEARCH** for:
```typescript
import { RuleStorage } from './storage.js';
```

**IF FOUND**, check if there are calls to `storage.loadRuleSet()`.

**FIND**:
```typescript
const ruleSet = await this.storage.loadRuleSet(subreddit);
```

**IF THIS EXISTS**, replace with:
```typescript
import { loadRulesFromSettings } from './schemaValidator.js';

// In the method where loadRuleSet was called:
const ruleSet = await loadRulesFromSettings(this.context, subreddit);
```

**NOTE**: You'll need to pass `context` to the RulesEngine constructor if it doesn't already have it.

**IF NO DIRECT STORAGE CALLS EXIST**, skip this task entirely.

---

## Testing Requirements

After implementation:

1. **TypeScript Compilation**:
   ```bash
   cd /home/cdm/redditmod
   npm run build
   ```
   Expected: No new TypeScript errors (existing Devvit type issues are pre-existing)

2. **Integration Points Verified**:
   - PostSubmit uses `loadRulesFromSettings()`
   - PostSubmit implements dry-run precedence
   - AIAnalyzer uses `ConfigurationManager`
   - AIAnalyzer checks for configured providers
   - CostTracker uses settings-based budgets
   - CostTracker invalidates dashboard cache
   - Rules Engine uses validated rules (if applicable)

3. **Imports Added**:
   - `postSubmit.ts`: `loadRulesFromSettings`, `SettingsService`
   - `analyzer.ts`: `ConfigurationManager`
   - `costTracker.ts`: `SettingsService`, `CostDashboardCache`
   - `engine.ts`: `loadRulesFromSettings` (if needed)

---

## Success Criteria

Implementation is complete when:

1. ✅ All 4 files modified according to spec
2. ✅ All imports added correctly
3. ✅ TypeScript compiles without new errors
4. ✅ Dry-run mode checks both settings and ruleSet
5. ✅ Budget limits come from settings, not hardcoded
6. ✅ API keys come from settings, not hardcoded
7. ✅ Rules come from settings with validation
8. ✅ Dashboard cache invalidates on cost updates
9. ✅ Graceful degradation: missing API keys, invalid JSON, budget exceeded
10. ✅ No breaking changes to existing functionality

---

## Important Notes

### Backward Compatibility
- Keep DEFAULT_CONFIG as fallback in CostTracker
- ConfigurationManager merges settings with defaults
- Empty settings should not break anything

### Graceful Degradation
- Missing API keys: Log error, skip AI analysis, continue with hard rules
- Invalid rules JSON: Log error, use default rules
- Budget exceeded: Log warning, skip AI analysis
- Settings errors: Fall back to hardcoded defaults

### Safety First
- Dry-run precedence: `effectiveDryRun = settingsDryRun OR ruleSetDryRun`
- If either is true, system runs in dry-run mode
- Settings can force dry-run even if rules say otherwise

---

## Questions for Agent

If you encounter any of these, ask for clarification:

1. **ProviderSelector signature unclear**: What parameters does `ProviderSelector` constructor accept?
2. **Rules Engine context**: Does `RulesEngine` already have access to `Devvit.Context`?
3. **Missing helper methods**: Does `generateAlerts()` exist in CostTracker?
4. **Import conflicts**: Any circular dependency issues?

Otherwise, implement according to this specification. Good luck!
