# Phase 4.6: System Integration Implementation Specification

**Date**: 2025-10-28
**Phase**: Phase 4.6 - System Integration
**Status**: Implementation Specification

---

## Overview

This is the FINAL integration phase connecting all Settings components (Phases 4.1-4.5) with the existing AI system (Phase 2), Rules Engine (Phase 3), and Event Handlers. This makes settings actually control system behavior.

---

## Task 1: Update PostSubmit Handler

**File**: `src/handlers/postSubmit.ts`

### 1.1 Replace Rule Loading Logic

**Find** (around line 154-157):
```typescript
// 2. Initialize rules engine
const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

// 3. Check if AI analysis is needed for this subreddit
const needsAI = await rulesEngine.needsAIAnalysis(subredditName);
```

**Replace with**:
```typescript
// 2. Load rules from settings (with validation and defaults)
import { loadRulesFromSettings } from '../rules/schemaValidator.js';
const ruleSet = await loadRulesFromSettings(context as Devvit.Context, subredditName);

// 3. Initialize rules engine with validated rules
const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

// 4. Check if AI analysis is needed for this subreddit
const needsAI = await rulesEngine.needsAIAnalysis(subredditName);
```

**Add Import** (at top of file):
```typescript
import { loadRulesFromSettings } from '../rules/schemaValidator.js';
```

### 1.2 Implement Dry-Run Mode Precedence

**Find** (around line 220-240 where ruleResult is used):
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

**Add BEFORE "Evaluate rules" section**:
```typescript
import { SettingsService } from '../config/settingsService.js';

// Get dry-run configuration (settings take precedence)
const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
```

**Modify "Evaluate rules" section**:
```typescript
// 5. Evaluate rules
const startTime = Date.now();
const ruleResult = await rulesEngine.evaluateRules(evalContext);
const executionTime = Date.now() - startTime;

// Check effective dry-run mode (settings OR ruleSet - safety first)
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

**Find all references to `ruleResult.dryRun`** and replace with `effectiveDryRun`:
- Line ~234: `dryRun: ruleResult.dryRun,` → `dryRun: effectiveDryRun,`
- Line ~246: `dryRun: ruleResult.dryRun,` → `dryRun: effectiveDryRun,`

**Add Import** (at top of file):
```typescript
import { SettingsService } from '../config/settingsService.js';
```

---

## Task 2: Update AIAnalyzer

**File**: `src/ai/analyzer.ts`

### 2.1 Import ConfigurationManager

**Find** (around line 98):
```typescript
import { getCacheTTLForTrustScore } from '../config/ai.js';
```

**Add Below**:
```typescript
import { ConfigurationManager } from '../config/configManager.js';
```

### 2.2 Update analyzeUserWithQuestions Method

**Find** (around line 250-280 where AI_CONFIG is used):
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

**Add BEFORE budget check**:
```typescript
// Get effective AI configuration from settings
const config = await ConfigurationManager.getEffectiveAIConfig(this.context);

// Check if any providers are configured
if (!ConfigurationManager.hasConfiguredProviders(config)) {
  console.warn('[AIAnalyzer] No AI providers configured (missing API keys) - skipping analysis');
  return null;
}
```

### 2.3 Update Provider Initialization (in getInstance or constructor)

**Find** (wherever ProviderSelector is initialized):
```typescript
// This might be in getInstance() or constructor
// Need to find actual location in code
```

**Replace provider initialization with**:
```typescript
// Get effective configuration
const config = await ConfigurationManager.getEffectiveAIConfig(context);

// Initialize providers only if API keys are configured
const providers: Map<AIProviderType, IAIProvider> = new Map();

// Claude provider
if (config.providers.claude.enabled && config.providers.claude.apiKey) {
  const ClaudeProvider = (await import('./claude.js')).ClaudeProvider;
  providers.set('claude', new ClaudeProvider(
    config.providers.claude.apiKey,
    config.providers.claude.model
  ));
}

// OpenAI provider
if (config.providers.openai.enabled && config.providers.openai.apiKey) {
  const OpenAIProvider = (await import('./openai.js')).OpenAIProvider;
  providers.set('openai', new OpenAIProvider(
    config.providers.openai.apiKey,
    config.providers.openai.model
  ));
}

// DeepSeek provider
if (config.providers.deepseek.enabled && config.providers.deepseek.apiKey) {
  const DeepSeekProvider = (await import('./deepseek.js')).DeepSeekProvider;
  providers.set('deepseek', new DeepSeekProvider(
    config.providers.deepseek.apiKey,
    config.providers.deepseek.model
  ));
}

// Validate at least one provider configured
if (providers.size === 0) {
  console.error('[AIAnalyzer] No AI providers configured (missing API keys)');
  // Don't throw - return gracefully
}

// Initialize ProviderSelector with configured providers
const providerSelector = new ProviderSelector(
  providers,
  config.primaryProvider,
  config.fallbackProvider
);
```

**Note**: Find the ACTUAL location in analyzer.ts where providers are initialized. The above is the pattern to apply.

---

## Task 3: Update CostTracker

**File**: `src/ai/costTracker.ts`

### 3.1 Update Budget Limits from Settings

**Find** (around line 50-58):
```typescript
const DEFAULT_CONFIG = {
  /** Daily spending limit in cents */
  dailyLimitCents: 500, // $5.00
  /** Monthly spending limit in cents */
  monthlyLimitCents: 15000, // $150.00
  /** Alert thresholds as fractions (50%, 75%, 90% of daily budget) */
  alertThresholds: [0.5, 0.75, 0.9],
};
```

**Keep this as fallback defaults, but modify getBudgetStatus() method**:

**Find** (getBudgetStatus method - likely around line 300-350):
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

**Replace with**:
```typescript
import { SettingsService } from '../config/settingsService.js';

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

**Find** (canAfford method):
```typescript
async canAfford(estimatedCostUSD: number): Promise<boolean> {
  const dailySpent = await this.getDailySpent();
  const dailyLimitUSD = centsToUSD(this.config.dailyLimitCents);
  return dailySpent + estimatedCostUSD <= dailyLimitUSD;
}
```

**Replace with**:
```typescript
async canAfford(estimatedCostUSD: number): Promise<boolean> {
  const budgetConfig = await SettingsService.getBudgetConfig(this.context);
  const dailySpent = await this.getDailySpent();
  return dailySpent + estimatedCostUSD <= budgetConfig.dailyLimitUSD;
}
```

**Add Import** (at top of file):
```typescript
import { SettingsService } from '../config/settingsService.js';
```

### 3.2 Invalidate Dashboard Cache on Cost Update

**Find** (trackCost method - likely around line 200-250):
```typescript
async trackCost(costRecord: CostRecord): Promise<void> {
  // ... existing cost recording logic ...

  // Last line should be something like:
  console.log(`[CostTracker] Recorded cost: $${costRecord.costUSD.toFixed(4)}`);
}
```

**Add at END of method (after console.log)**:
```typescript
// Invalidate dashboard cache when costs change
import { CostDashboardCache } from '../dashboard/costDashboardCache.js';
await CostDashboardCache.invalidateCache(this.context);
```

**Add Import** (at top of file):
```typescript
import { CostDashboardCache } from '../dashboard/costDashboardCache.js';
```

---

## Task 4: Update Rules Engine (if needed)

**File**: `src/rules/engine.ts`

**Check if RulesEngine calls loadRuleSet directly from storage**:

**Search for**:
```typescript
import { loadRuleSet } from './storage.js';
```

**If found, replace with**:
```typescript
import { loadRulesFromSettings } from './schemaValidator.js';
```

**Then find any calls to**:
```typescript
const ruleSet = await loadRuleSet(context, subredditName);
```

**And replace with**:
```typescript
const ruleSet = await loadRulesFromSettings(context, subredditName);
```

**Note**: Only make this change IF the engine calls storage directly. If it already uses settings, skip this task.

---

## Task 5: Update Provider Classes (if needed)

**Files**: `src/ai/claude.ts`, `src/ai/openai.ts`, `src/ai/deepseek.ts`

**Check each provider constructor**:

### Expected Pattern:
```typescript
export class ClaudeProvider implements IAIProvider {
  constructor(
    private readonly apiKey: string,  // ← First parameter should be apiKey
    private readonly model: string,
    // ... other params
  ) {
    if (!apiKey) {
      throw new Error('[ClaudeProvider] API key is required');
    }
    // Initialize client with apiKey
    this.client = new Anthropic({ apiKey });
  }
}
```

**If constructors don't accept apiKey as first parameter**, update them:

**OLD**:
```typescript
constructor(
  private readonly model: string,
  // other params
) {
  // Uses hardcoded API key from env
}
```

**NEW**:
```typescript
constructor(
  private readonly apiKey: string,
  private readonly model: string,
  // other params
) {
  if (!apiKey) {
    throw new Error('[ProviderName] API key is required');
  }
  this.client = new Client({ apiKey }); // Pass apiKey to client
}
```

---

## Task 6: Create Integration Checklist

**File**: `src/config/integrationChecklist.md`

**Content**:
```markdown
# Phase 4.6 Integration Checklist

**Date**: 2025-10-28
**Status**: Testing Checklist

---

## Settings → AI System
- [ ] API keys from settings are passed to providers
- [ ] Budget limits from settings are enforced in CostTracker
- [ ] Primary/fallback provider selection works from settings
- [ ] System works with no API keys configured (graceful degradation)
- [ ] ConfigurationManager merges settings with defaults correctly
- [ ] Providers only initialize when API keys are present

## Settings → Rules Engine
- [ ] Rules loaded from settings JSON (validated)
- [ ] Falls back to defaults when settings empty
- [ ] Invalid JSON handled gracefully (uses defaults)
- [ ] Subreddit-specific defaults work
- [ ] loadRulesFromSettings() never throws, always returns valid rules

## Settings → Event Handlers
- [ ] PostSubmit uses loadRulesFromSettings()
- [ ] Dry-run mode checks both settings and ruleSet
- [ ] Settings dry-run overrides ruleSet dry-run (safety first)
- [ ] Effective dry-run mode applied to all actions
- [ ] DryRunConfig correctly loaded from SettingsService

## Dashboard → Cost Tracking
- [ ] Dashboard displays real costs from CostTracker
- [ ] Budget limits shown from settings
- [ ] Cache invalidates when costs update
- [ ] 5-minute cache works correctly
- [ ] Budget status calculations use settings-based limits

## Default Rules Initialization
- [ ] AppInstall event initializes rules
- [ ] PostSubmit fallback works if AppInstall missed
- [ ] Atomic locks prevent race conditions
- [ ] Existing rules not overwritten
- [ ] Subreddit-specific defaults loaded correctly

## Error Handling
- [ ] Missing API keys → log error, skip AI analysis
- [ ] Invalid rules JSON → log error, use defaults
- [ ] Budget exceeded → log warning, skip AI analysis
- [ ] Provider failures → try fallback provider
- [ ] All errors logged, none crash app
- [ ] Graceful degradation in all failure modes

## Type Safety
- [ ] No TypeScript compilation errors
- [ ] No new `any` types leaked to public APIs
- [ ] All imports resolve correctly
- [ ] No circular dependencies

## Documentation
- [ ] Integration spec complete
- [ ] All changes documented in project-status.md
- [ ] Resume prompt updated with Phase 4.6 completion
- [ ] Integration checklist created

---

## Testing Notes

### Manual Testing Steps
1. Deploy with empty settings → should use defaults
2. Configure API keys → should use configured providers
3. Set dry-run mode in settings → should apply to all actions
4. Set budget limits → should enforce correctly
5. Add invalid rules JSON → should fall back to defaults
6. Exceed budget → should skip AI analysis gracefully

### Expected Behaviors
- **No API keys configured**: Skip AI analysis, log warning, continue with hard rules only
- **Invalid rules JSON**: Log error, use default rules for subreddit
- **Settings dry-run = true**: All actions logged only, no actual moderation
- **Budget exceeded**: Skip AI analysis, log warning, continue with hard rules only
- **All providers down**: Skip AI analysis, log error, continue with hard rules only

---

## Completion Criteria

Phase 4.6 is complete when:
1. All checklist items above verified
2. TypeScript compiles without errors
3. Manual testing shows graceful degradation
4. Documentation updated
5. Code committed with descriptive message
```

---

## Task 7: TypeScript Compilation Verification

After all changes:

```bash
cd /home/cdm/redditmod
npm run build
```

Expected output:
- No new TypeScript errors
- Clean compilation (existing errors are pre-existing Devvit type issues)

---

## Task 8: Update Documentation

### File: `docs/project-status.md`

**Add to "Completed Tasks" section**:
```markdown
**Phase 4.6: System Integration (COMPLETE ✅ - 2025-10-28)**
- [x] Updated PostSubmit handler to use loadRulesFromSettings - 2025-10-28
- [x] Implemented dry-run mode precedence (settings OR ruleSet) - 2025-10-28
- [x] Updated AIAnalyzer to use ConfigurationManager - 2025-10-28
- [x] Updated AIAnalyzer to pass API keys to providers - 2025-10-28
- [x] Updated CostTracker to use settings-based budget limits - 2025-10-28
- [x] Updated CostTracker to invalidate dashboard cache on updates - 2025-10-28
- [x] Updated provider classes to accept API keys in constructors - 2025-10-28
- [x] Created integration checklist document - 2025-10-28
- [x] Verified TypeScript compilation - 2025-10-28
```

### File: `docs/resume-prompt.md`

**Update "Current Phase" section**:
```markdown
**Current Phase**: Phase 4 - COMPLETE ✅ (All settings integrated with system)
**Phase 4 Status**: COMPLETE ✅
  - Phase 4.1: Settings Service Foundation - COMPLETE ✅
  - Phase 4.2: Devvit Settings UI - COMPLETE ✅
  - Phase 4.3: Rule Management with Schema Validation - COMPLETE ✅
  - Phase 4.4: Cost Dashboard UI - COMPLETE ✅
  - Phase 4.5: Default Rules Initialization - COMPLETE ✅
  - Phase 4.6: System Integration - COMPLETE ✅ (NEW)
```

**Add new session summary**:
```markdown
### Session 18 (2025-10-28): Phase 4.6 Complete - System Integration

**Achievements**:
1. ✅ Updated PostSubmit handler (src/handlers/postSubmit.ts)
   - Uses loadRulesFromSettings() instead of direct Redis loading
   - Implements dry-run precedence (settings OR ruleSet - safety first)
   - Imports SettingsService for configuration
2. ✅ Updated AIAnalyzer (src/ai/analyzer.ts)
   - Uses ConfigurationManager.getEffectiveAIConfig()
   - Passes API keys to provider constructors
   - Graceful degradation when no API keys configured
   - Checks hasConfiguredProviders() before analysis
3. ✅ Updated CostTracker (src/ai/costTracker.ts)
   - Uses SettingsService.getBudgetConfig() for limits
   - Invalidates dashboard cache on cost updates
   - Settings-based budget enforcement
4. ✅ Updated provider classes (if needed)
   - Constructors accept apiKey as first parameter
   - Validate API keys before initialization
5. ✅ Created integration checklist (src/config/integrationChecklist.md)
   - Comprehensive testing checklist
   - Manual testing steps
   - Expected behaviors documented
6. ✅ TypeScript compilation verified - No new errors ✅
7. ✅ Updated all documentation
8. ✅ **Phase 4.6 COMPLETE** ✅

**Key Integration Points**:
- Settings → AI System: API keys, budget limits, provider selection
- Settings → Rules Engine: Validated rules with defaults
- Settings → Event Handlers: Dry-run mode precedence
- Dashboard → Cost Tracking: Cache invalidation on updates
- Graceful degradation: Missing API keys, invalid JSON, budget exceeded

**Phase 4 Status**: COMPLETE ✅ (All 6 sub-phases done)
**Next**: Phase 5 - Production Deployment & Testing
```

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

### Cache Management
- Dashboard cache invalidated on cost updates
- 5-minute TTL prevents stale data
- Manual invalidation available

### Dry-Run Precedence
- `effectiveDryRun = settingsDryRun OR ruleSetDryRun`
- Safety first: If either is true, system runs in dry-run mode
- Settings can force dry-run even if rules say otherwise

### Provider Initialization
- Only initialize providers with API keys
- Check `hasConfiguredProviders()` before analysis
- Null provider map is valid (graceful degradation)

---

## Deliverables Checklist

- [ ] `src/handlers/postSubmit.ts` - Updated with loadRulesFromSettings, dry-run precedence
- [ ] `src/ai/analyzer.ts` - Updated with ConfigurationManager, API key handling
- [ ] `src/ai/costTracker.ts` - Updated with settings-based budgets, cache invalidation
- [ ] `src/rules/engine.ts` - Updated if calling storage directly (check needed)
- [ ] `src/ai/claude.ts` - Constructor accepts apiKey (if not already)
- [ ] `src/ai/openai.ts` - Constructor accepts apiKey (if not already)
- [ ] `src/ai/deepseek.ts` - Constructor accepts apiKey (if not already)
- [ ] `src/config/integrationChecklist.md` - Created with testing checklist
- [ ] TypeScript compilation verified
- [ ] Documentation updated (project-status.md, resume-prompt.md)

---

## Success Criteria

Phase 4.6 is complete when:
1. PostSubmit uses validated rules from settings
2. AIAnalyzer uses configured API keys from settings
3. CostTracker enforces settings-based budget limits
4. Dry-run mode checks both settings and ruleSet
5. Dashboard cache invalidates on cost updates
6. All integrations handle missing configuration gracefully
7. TypeScript compiles without new errors
8. Integration checklist created
9. Documentation updated
10. Code committed with descriptive message

This is the FINAL step to make Phase 4 settings fully operational!
