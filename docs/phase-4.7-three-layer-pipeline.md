# Phase 4.7: Three-Layer Moderation Pipeline

**Date**: 2025-10-28
**Status**: Implementation Complete ✅
**Integration**: Ready for handler integration

---

## Overview

Implemented a three-layer moderation pipeline that processes content through progressively sophisticated checks, short-circuiting on the first match to optimize performance and minimize AI costs.

## Architecture

### Layer 0: Trust Score Check (Existing)
- **Purpose**: Fast path bypass for trusted users
- **Latency**: <1ms
- **Cost**: Free
- **Implementation**: Already exists in handlers
- **Result**: Trusted users (score >= 70) skip all moderation

### Layer 1: Built-in Rules
- **Purpose**: Fast, deterministic checks
- **Examples**: Account age + karma + external links
- **Latency**: <1ms
- **Cost**: Free
- **API Calls**: None (pure logic)
- **Configuration**: JSON-based rules in settings

### Layer 2: OpenAI Moderation API
- **Purpose**: Free content moderation
- **Categories**: Hate, harassment, violence, sexual content, self-harm
- **Latency**: ~500ms
- **Cost**: **FREE** (OpenAI provides this API at no charge)
- **API**: `omni-moderation-latest` model
- **Special Handling**: `sexual/minors` always REMOVE (safety measure)

### Layer 3: Custom Rules + AI Analysis (Existing)
- **Purpose**: Complex analysis requiring AI reasoning
- **Implementation**: Existing RulesEngine + AIAnalyzer
- **Latency**: 500-2000ms
- **Cost**: $0.001-0.01 per request
- **Only runs if**: Layers 1-2 don't match

## Files Created

### Type Definitions
**`src/types/moderation.ts`** (4.8 KB)
```typescript
// Key types:
- ModerationCategory: OpenAI category names
- ModerationResult: API response structure
- ModerationConfig: Layer 2 configuration
- BuiltInRulesConfig: Layer 1 configuration
- BuiltInRule: Single rule definition
- PipelineResult: Execution result
```

### Implementation Modules

**`src/moderation/openaiMod.ts`** (6.2 KB)
- `checkContent()`: Main function to check content via OpenAI Moderation API
- 10-second timeout for API calls
- Graceful error handling (returns null on failure)
- Applies threshold and category filters
- Special handling for sexual/minors

**`src/moderation/builtInRules.ts`** (6.3 KB)
- `evaluateBuiltInRules()`: Main function to evaluate rules
- `evaluateRule()`: Single rule evaluation with AND logic
- `compareNumber()`: Numeric comparison utility
- Supports: accountAgeDays, totalKarma, hasExternalLinks, isEmailVerified
- <1ms execution time

**`src/moderation/pipeline.ts`** (9.0 KB)
- `executeModerationPipeline()`: Main orchestrator
- Executes layers in sequence (1 → 2)
- Short-circuits on first match
- Returns metadata for audit logging
- Helper functions for config retrieval

### Settings Configuration

**`src/main.tsx`** (Updated lines 220-310)

Added two new settings sections:

**Built-in Rules Settings (Layer 1)**
- `enableBuiltInRules` (boolean, default: true)
- `builtInRulesJson` (JSON paragraph) - Array of rule objects

**OpenAI Moderation Settings (Layer 2)**
- `enableOpenAIMod` (boolean, default: false)
- `openaiModCategories` (multi-select) - Which categories to check
- `openaiModThreshold` (number, 0.0-1.0, default: 0.5)
- `openaiModAction` (select: FLAG/REMOVE/COMMENT, default: FLAG)
- `openaiModMessage` (string) - Custom message for actions

### Documentation

**`INTEGRATION_GUIDE.md`** (Root directory, 14 KB)
- Complete integration instructions for handlers
- Code examples for postSubmit.ts and commentSubmit.ts
- Testing strategy
- Error handling details
- Performance characteristics
- Configuration examples
- Monitoring guidance

## Integration Points

### Post Submit Handler (`src/handlers/postSubmit.ts`)

**Location**: After trust score check, before existing rules engine (around line 150)

**Integration**:
```typescript
import { executeModerationPipeline } from '../moderation/pipeline.js';

const pipelineResult = await executeModerationPipeline(
  context,
  profileResult.profile,
  currentPost,
  'submission'
);

if (pipelineResult.action !== 'APPROVE') {
  // Execute action and return
}

// Continue to existing custom rules...
```

### Comment Submit Handler (`src/handlers/commentSubmit.ts`)

Same pattern as post handler, with:
- Content type: `'comment'`
- Use `comment` object instead of `submission`

## Built-in Rules Configuration

### Example Rule (Default)
```json
{
  "id": "new-account-links",
  "name": "New account with external links",
  "enabled": true,
  "conditions": {
    "accountAgeDays": { "operator": "<", "value": 7 },
    "totalKarma": { "operator": "<", "value": 50 },
    "hasExternalLinks": true
  },
  "action": "FLAG",
  "message": "New account posting links - please review"
}
```

### Condition Types

**accountAgeDays**
- Type: Number comparison
- Operators: `<`, `>`, `<=`, `>=`
- Example: `{ "operator": "<", "value": 7 }` (less than 7 days old)

**totalKarma**
- Type: Number comparison
- Operators: `<`, `>`, `<=`, `>=`
- Example: `{ "operator": "<", "value": 50 }` (less than 50 karma)

**hasExternalLinks**
- Type: Boolean
- Values: `true` or `false`
- Example: `true` (post must have external links)

**isEmailVerified**
- Type: Boolean
- Values: `true` or `false`
- Example: `false` (email must NOT be verified)

### Condition Logic

All conditions in a rule are **AND**ed together (all must be true).

To create OR logic, use multiple separate rules.

## OpenAI Moderation Configuration

### Categories Available

- `hate` - Hate speech
- `hate/threatening` - Threatening hate speech
- `harassment` - Harassment
- `harassment/threatening` - Threatening harassment
- `self-harm` - Self-harm content
- `self-harm/intent` - Intent to self-harm
- `self-harm/instructions` - Instructions for self-harm
- `sexual` - Sexual content
- `sexual/minors` - Sexual content involving minors
- `violence` - Violence
- `violence/graphic` - Graphic violence

### Threshold Guidelines

- **0.3** - Strict (catches more, may have false positives)
- **0.5** - Balanced (recommended default)
- **0.7** - Lenient (catches less, fewer false positives)

### Special Handling

`sexual/minors` is **always REMOVE** regardless of:
- Configured threshold
- Configured action
- Any other settings

This is a safety measure that cannot be disabled.

## Performance Characteristics

### Expected Layer Hit Rates
- **Layer 0 (Trust)**: 60-70% of users (trusted, immediate APPROVE)
- **Layer 1 (Built-in)**: 5-10% of remaining users
- **Layer 2 (Moderation)**: 2-5% of remaining users
- **Layer 3 (Custom/AI)**: 15-33% of all users

### Expected Latency
- **Trust + Layer 1**: <1ms (70-80% of requests)
- **Trust + Layer 1-2**: ~500ms (80-95% of requests)
- **Trust + Layer 1-3**: 500-2000ms (5-20% of requests)

### Cost Savings

**Before pipeline**: 100% of posts → Layer 3 (AI analysis)
- Cost: $0.001-0.01 per post
- Total for 1000 posts: $1-10

**After pipeline**: 15-33% of posts → Layer 3 (AI analysis)
- Layers 0-2 are FREE
- Cost: $0.15-3.30 for 1000 posts
- **Savings: 67-85%** of AI costs

## Error Handling

### Graceful Degradation

All errors are logged but **never crash** the pipeline:

1. **Built-in rules JSON parse error**
   - Logs error
   - Skips Layer 1
   - Continues to Layer 2

2. **Missing OpenAI API key**
   - Logs warning
   - Skips Layer 2
   - Continues to Layer 3

3. **OpenAI API network error**
   - Logs error
   - Returns null
   - Continues to Layer 3

4. **OpenAI API timeout (10s)**
   - Logs error
   - Returns null
   - Continues to Layer 3

### Fallback Strategy

If all early layers fail or are disabled:
- Pipeline returns `layerTriggered: 'none'`
- Handler continues to existing Layer 3 (custom rules)
- System works exactly as it did before pipeline

## Testing Strategy

### Unit Tests (Recommended)

1. **Built-in Rules**
   - Test each condition type
   - Test AND logic
   - Test rule priority order

2. **OpenAI Moderation**
   - Mock API responses
   - Test threshold filtering
   - Test category filtering
   - Test sexual/minors special handling

3. **Pipeline Orchestrator**
   - Test short-circuit behavior
   - Test layer execution order
   - Test error fallthrough

### Integration Tests

1. **Layer 1 Integration**
   - Configure rule in settings
   - Create matching post
   - Verify rule triggers
   - Verify Layer 2/3 don't execute

2. **Layer 2 Integration**
   - Enable OpenAI Moderation
   - Post flagged content
   - Verify moderation triggers
   - Verify Layer 3 doesn't execute

3. **Layer 3 Fallthrough**
   - Post that passes Layer 1/2
   - Verify Layer 3 executes
   - Verify custom rules work

### Manual Testing Checklist

- [ ] Enable Layer 1, create matching post → Should FLAG
- [ ] Enable Layer 2, post hate speech → Should FLAG
- [ ] Post clean content → Should reach Layer 3
- [ ] Disable Layer 1/2 → Should work like before
- [ ] Invalid Layer 1 JSON → Should skip Layer 1, continue
- [ ] Missing OpenAI key → Should skip Layer 2, continue

## Monitoring

### Key Metrics

1. **Layer Hit Rate**
   - % of requests caught by each layer
   - Expected: 70% Layer 0, 10% Layer 1, 5% Layer 2, 15% Layer 3

2. **Average Latency**
   - Time spent in each layer
   - Expected: <1ms Layer 1, ~500ms Layer 2

3. **OpenAI API Errors**
   - Track failure rate
   - Alert if > 5% error rate

4. **Cost Savings**
   - Compare AI API usage before/after
   - Expected: 67-85% reduction

### Log Queries

```bash
# Layer 1 hit rate
grep "Layer 1 triggered" logs | wc -l

# Layer 2 hit rate
grep "Layer 2 triggered" logs | wc -l

# Layer 3 hit rate
grep "Layer 3 triggered" logs | wc -l

# Average Layer 2 latency
grep "OpenAIMod.*latencyMs" logs | awk '{print $NF}' | average
```

## Migration Path

### No Breaking Changes

Implementation is **completely additive**:
- ✅ Existing handlers work unchanged
- ✅ No functionality changes if not integrated
- ✅ Backward compatible

### Integration Options

**Option 1: Don't integrate (No change)**
- System works exactly as before
- All features work
- No performance impact

**Option 2: Integrate (Recommended)**
- Improved performance (fast path for common patterns)
- Reduced AI costs (67-85% savings)
- Free content moderation
- Enhanced safety (OpenAI Moderation API)

### Rollout Strategy

1. **Phase 1**: Deploy code (no integration)
   - Verify no regressions
   - Enable settings UI

2. **Phase 2**: Enable Layer 1 (dry-run)
   - Monitor logs
   - Tune rule configurations

3. **Phase 3**: Enable Layer 1 (live)
   - Monitor impact
   - Track cost savings

4. **Phase 4**: Enable Layer 2 (dry-run)
   - Test OpenAI Moderation
   - Tune thresholds

5. **Phase 5**: Enable Layer 2 (live)
   - Full production rollout
   - Monitor and optimize

## Next Steps

### Immediate (Required for handler integration)
1. ✅ Create type definitions - **DONE**
2. ✅ Implement Layer 1 (Built-in Rules) - **DONE**
3. ✅ Implement Layer 2 (OpenAI Moderation) - **DONE**
4. ✅ Implement Pipeline Orchestrator - **DONE**
5. ✅ Add settings configuration - **DONE**
6. ✅ Create integration documentation - **DONE**

### Follow-up (For production deployment)
7. [ ] Integrate into postSubmit.ts handler
8. [ ] Integrate into commentSubmit.ts handler
9. [ ] Test in playtest environment
10. [ ] Deploy to production
11. [ ] Monitor performance and costs
12. [ ] Tune configurations based on usage

## Files Modified

### New Files
- `/home/cdm/redditmod/src/types/moderation.ts`
- `/home/cdm/redditmod/src/moderation/openaiMod.ts`
- `/home/cdm/redditmod/src/moderation/builtInRules.ts`
- `/home/cdm/redditmod/src/moderation/pipeline.ts`
- `/home/cdm/redditmod/INTEGRATION_GUIDE.md`
- `/home/cdm/redditmod/docs/phase-4.7-three-layer-pipeline.md` (this file)

### Modified Files
- `/home/cdm/redditmod/src/main.tsx` (lines 220-310) - Added settings

### Handler Files (Ready for integration, not modified yet)
- `/home/cdm/redditmod/src/handlers/postSubmit.ts`
- `/home/cdm/redditmod/src/handlers/commentSubmit.ts`

## Success Criteria

- [x] Type definitions compile without errors
- [x] All modules have comprehensive JSDoc comments
- [x] Graceful error handling (no crashes)
- [x] Settings configuration added
- [x] Integration documentation complete
- [ ] Handlers integrated (pending)
- [ ] Tests passing (pending)
- [ ] Production deployment (pending)

## Risks & Mitigations

### Risk: OpenAI API Rate Limits
**Mitigation**: Free Moderation API has generous limits. Graceful degradation if exceeded.

### Risk: False Positives
**Mitigation**: Start with FLAG action, not REMOVE. Monitor and tune thresholds.

### Risk: Breaking Existing Functionality
**Mitigation**: Completely additive implementation. Doesn't modify existing flow.

### Risk: Performance Impact
**Mitigation**: Layer 1 is <1ms. Layer 2 is async. Short-circuit optimization.

## References

- [OpenAI Moderation API Docs](https://platform.openai.com/docs/guides/moderation)
- [Integration Guide](../INTEGRATION_GUIDE.md)
- [Type Definitions](../src/types/moderation.ts)

---

**Implementation Status**: ✅ Complete and ready for integration
**Next Action**: Integrate into handlers or commit as standalone feature
