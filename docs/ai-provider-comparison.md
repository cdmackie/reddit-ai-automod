# AI Provider Comparison for Reddit Automod

**Created**: 2025-10-26
**Purpose**: Compare AI providers for user profiling and content analysis use case
**Use Case**: Analyze Reddit user profiles + post history to detect scammers, dating seekers, and underage users

---

## Requirements

Our specific needs for AI analysis:

1. **Content Understanding**: Analyze 20+ posts/comments for patterns
2. **Structured Output**: Return JSON with confidence scores
3. **Context Window**: Handle ~2000-3000 tokens input (user profile + history)
4. **Pattern Recognition**: Detect subtle scammer/dating intent patterns
5. **Cost-Effective**: Budget target of $15-25/month for 600 analyses
6. **Reliability**: High uptime, good API stability
7. **Speed**: Sub-2s response time preferred

---

## Provider Comparison

### 1. Claude 3.5 Haiku (Anthropic)

**Model**: claude-3-5-haiku-20241022

**Pricing**:
- Input: $0.80 per 1M tokens ($0.0000008/token)
- Output: $4.00 per 1M tokens ($0.000004/token)
- **Estimated cost per analysis**: ~$0.05-0.08

**Strengths**:
- ✅ Excellent at nuanced content analysis
- ✅ Strong pattern recognition (scammer detection, subtle intent)
- ✅ Very fast (low latency)
- ✅ Good structured output with tool use
- ✅ Large context window (200K tokens)
- ✅ Strong safety features (appropriate for moderation)
- ✅ Excellent instruction following

**Weaknesses**:
- ⚠️ Slightly more verbose than needed (higher output tokens)
- ⚠️ Newer model (less community testing than GPT-4)

**Best For**: Primary provider - excellent balance of cost, quality, and speed

---

### 2. OpenAI GPT-4o Mini

**Model**: gpt-4o-mini

**Pricing**:
- Input: $0.150 per 1M tokens ($0.00000015/token)
- Output: $0.600 per 1M tokens ($0.0000006/token)
- **Estimated cost per analysis**: ~$0.10-0.12

**Strengths**:
- ✅ Proven reliability and uptime
- ✅ Good structured output (JSON mode)
- ✅ Fast inference
- ✅ Large context window (128K tokens)
- ✅ Excellent API documentation
- ✅ Strong ecosystem and tooling

**Weaknesses**:
- ⚠️ More expensive than Claude Haiku
- ⚠️ Less nuanced at subtle pattern detection
- ⚠️ Slightly higher latency than Haiku

**Best For**: Fallback provider - proven reliability

---

### 3. DeepSeek V3

**Model**: deepseek-chat

**Pricing**:
- Input: $0.27 per 1M tokens ($0.00000027/token)
- Output: $1.10 per 1M tokens ($0.0000011/token)
- **Estimated cost per analysis**: ~$0.02-0.03

**Strengths**:
- ✅ **Very cost-effective** (cheapest option by far)
- ✅ Good at reasoning and analysis
- ✅ Large context window (64K tokens)
- ✅ Competitive performance on benchmarks
- ✅ Open-weights model available

**Weaknesses**:
- ❌ Less proven for content moderation use cases
- ❌ Limited documentation and examples
- ❌ Smaller community and ecosystem
- ⚠️ May require more prompt engineering
- ⚠️ Newer model (launched late 2024)
- ⚠️ Less known reliability/uptime track record

**Best For**: Budget-conscious option if testing shows good quality

---

### 4. Google Gemini 1.5 Flash

**Model**: gemini-1.5-flash-002

**Pricing**:
- Input: $0.075 per 1M tokens ($0.000000075/token)
- Output: $0.30 per 1M tokens ($0.0000003/token)
- **Estimated cost per analysis**: ~$0.04-0.06

**Strengths**:
- ✅ Very cost-effective
- ✅ Extremely large context window (1M tokens)
- ✅ Fast inference
- ✅ Good at structured output
- ✅ Strong safety features

**Weaknesses**:
- ⚠️ Less consistent quality than Claude/GPT-4o
- ⚠️ Sometimes verbose in responses
- ⚠️ API rate limits can be restrictive on free tier
- ⚠️ Less proven for nuanced content analysis

**Best For**: Secondary fallback or A/B testing

---

### 5. Mistral Large 2

**Model**: mistral-large-2407

**Pricing**:
- Input: $2.00 per 1M tokens ($0.000002/token)
- Output: $6.00 per 1M tokens ($0.000006/token)
- **Estimated cost per analysis**: ~$0.12-0.15

**Strengths**:
- ✅ Strong reasoning capabilities
- ✅ Good structured output
- ✅ European company (GDPR-friendly)
- ✅ Competitive performance

**Weaknesses**:
- ❌ More expensive than Claude and DeepSeek
- ⚠️ Smaller ecosystem than OpenAI
- ⚠️ Limited community examples for moderation use cases

**Best For**: Not recommended for this use case (cost not competitive)

---

### 6. Cohere Command R+

**Model**: command-r-plus-08-2024

**Pricing**:
- Input: $2.50 per 1M tokens ($0.0000025/token)
- Output: $10.00 per 1M tokens ($0.00001/token)
- **Estimated cost per analysis**: ~$0.15-0.20

**Strengths**:
- ✅ Good at RAG and grounded responses
- ✅ Multilingual capabilities
- ✅ Tool use support

**Weaknesses**:
- ❌ Most expensive option
- ❌ Not optimized for content moderation
- ⚠️ Smaller ecosystem

**Best For**: Not recommended (too expensive)

---

### 7. Llama 3.1 70B (Self-hosted or via providers)

**Model**: llama-3.1-70b-instruct

**Pricing** (via providers like Together.ai, Groq):
- Input: $0.88 per 1M tokens ($0.00000088/token)
- Output: $0.88 per 1M tokens ($0.00000088/token)
- **Estimated cost per analysis**: ~$0.06-0.08

**Strengths**:
- ✅ Very cost-effective via providers
- ✅ Can self-host for even lower costs
- ✅ Open weights (flexibility)
- ✅ Good performance on benchmarks
- ✅ Large context window (128K)

**Weaknesses**:
- ⚠️ Self-hosting requires infrastructure
- ⚠️ Via providers: less proven reliability than major providers
- ⚠️ May require more prompt engineering
- ⚠️ Structured output less consistent than Claude/GPT-4o

**Best For**: If willing to manage infrastructure or use newer providers

---

## Cost Comparison (Monthly)

**Assumptions**: 20 posts/day analyzed, ~1000 input tokens, ~200 output tokens per analysis, 600 analyses/month

| Provider | Cost/Analysis | Monthly (No Cache) | Monthly (50% Cache) | Monthly (70% Trust Bypass) |
|----------|--------------|-------------------|---------------------|---------------------------|
| **DeepSeek V3** | $0.02-0.03 | $12-18 | $6-9 | $4-5 |
| **Gemini 1.5 Flash** | $0.04-0.06 | $24-36 | $12-18 | $7-11 |
| **Claude 3.5 Haiku** | $0.05-0.08 | $30-48 | $15-24 | $9-14 |
| **Llama 3.1 70B** | $0.06-0.08 | $36-48 | $18-24 | $11-14 |
| **GPT-4o Mini** | $0.10-0.12 | $60-72 | $30-36 | $18-22 |
| **Mistral Large** | $0.12-0.15 | $72-90 | $36-45 | $22-27 |
| **Cohere Command R+** | $0.15-0.20 | $90-120 | $45-60 | $27-36 |

---

## Performance Comparison

### Content Analysis Quality (Subjective, 1-10)

| Provider | Pattern Recognition | Nuance Detection | Instruction Following | Structured Output |
|----------|-------------------|------------------|----------------------|------------------|
| Claude 3.5 Haiku | 9 | 9 | 10 | 9 |
| GPT-4o Mini | 8 | 7 | 9 | 9 |
| DeepSeek V3 | 7 | 6 | 7 | 7 |
| Gemini 1.5 Flash | 7 | 6 | 8 | 8 |
| Llama 3.1 70B | 7 | 6 | 7 | 6 |

### Speed (Latency)

| Provider | Typical Latency | P95 Latency |
|----------|----------------|-------------|
| Claude 3.5 Haiku | 500-800ms | 1.2s |
| GPT-4o Mini | 600-1000ms | 1.5s |
| Gemini 1.5 Flash | 400-700ms | 1.0s |
| DeepSeek V3 | 800-1200ms | 2.0s |
| Llama 3.1 70B (Groq) | 300-500ms | 800ms |

### Reliability

| Provider | Uptime | Rate Limits | API Stability |
|----------|--------|------------|---------------|
| OpenAI GPT-4o | 99.9% | Generous | Excellent |
| Claude 3.5 Haiku | 99.8% | Good | Excellent |
| Gemini Flash | 99.7% | Moderate | Good |
| DeepSeek | Unknown | Good | Unknown (new) |
| Llama (providers) | 99.5% | Varies | Good |

---

## Recommendations

### Option A: Cost-Optimized (Recommended for Testing)

**Primary**: DeepSeek V3
**Fallback**: Claude 3.5 Haiku

**Rationale**:
- Lowest cost (~$4-5/month with optimizations)
- Claude as reliable fallback
- Test DeepSeek quality first - if good, massive cost savings
- Can switch if DeepSeek quality insufficient

**Monthly Cost**: $4-14 (depending on DeepSeek usage ratio)

---

### Option B: Quality-Optimized (Recommended for Production)

**Primary**: Claude 3.5 Haiku
**Fallback**: OpenAI GPT-4o Mini

**Rationale**:
- Best quality for nuanced content analysis
- Proven reliability
- Both providers have excellent uptime
- Cost reasonable with caching + trust scores (~$9-14/month)
- No risk of quality issues

**Monthly Cost**: $9-22

---

### Option C: Experimental Multi-Provider

**Primary**: Claude 3.5 Haiku (50%)
**Secondary**: DeepSeek V3 (40%)
**Fallback**: GPT-4o Mini (10%)

**Rationale**:
- Test DeepSeek in production with real data
- Majority still on proven Claude
- Compare outputs for quality validation
- Gradually shift to DeepSeek if quality proves good
- Ultimate cost target: $6-10/month

**Monthly Cost**: $6-16

---

## Testing Plan

Before finalizing provider choice:

1. **Week 1**: Test Claude, GPT-4o Mini, DeepSeek with same 50 real user profiles
2. **Metrics**:
   - Accuracy (manual review of 50 classifications)
   - False positive rate
   - False negative rate
   - Response time
   - Output consistency
3. **Week 2**: Run parallel analysis (Claude + DeepSeek) on 200 users
4. **Decision**: Choose primary based on quality/cost balance

---

## Implementation Strategy

### Phase 2 Plan (Updated):

1. **Create provider abstraction** (`src/ai/provider.ts`)
   - Interface that all providers implement
   - Unified request/response format

2. **Implement top 3 providers**:
   - Claude 3.5 Haiku
   - OpenAI GPT-4o Mini
   - DeepSeek V3

3. **Add provider selection logic**:
   - Configurable primary/fallback
   - A/B testing capability
   - Per-provider cost tracking

4. **Test with real data**:
   - Compare quality across providers
   - Measure actual costs
   - Monitor reliability

5. **Optimize**:
   - Select best provider(s)
   - Tune prompts per provider
   - Implement smart fallback logic

---

## Environment Configuration

```typescript
// Environment variables needed
ANTHROPIC_API_KEY=sk-ant-...       // Claude
OPENAI_API_KEY=sk-...              // OpenAI
DEEPSEEK_API_KEY=sk-...            // DeepSeek (if using)

// Configuration
AI_PRIMARY_PROVIDER=claude         // or openai, deepseek
AI_FALLBACK_PROVIDER=openai        // or claude, deepseek
AI_ENABLE_AB_TESTING=true          // For quality comparison
AI_AB_TEST_RATIO=0.5               // 50% on each provider
```

---

## Final Recommendation

**Start with Option B (Quality-Optimized)** for initial production:
- Claude 3.5 Haiku (primary)
- OpenAI GPT-4o Mini (fallback)
- Cost: $9-22/month

**Test DeepSeek in parallel** during Phase 2:
- Run comparative analysis
- If quality is acceptable, switch to Option C or A
- Potential savings: 50-70% (reduce cost to $4-10/month)

**Decision point**: After 1 week of testing with real data

---

## Updated Architecture

```
PostSubmit Handler
  ↓
Trust Score Check
  ↓ (if not trusted)
AI Analysis Request
  ↓
Provider Selector
  ├─→ Claude 3.5 Haiku (primary)
  ├─→ OpenAI GPT-4o Mini (fallback)
  └─→ DeepSeek V3 (A/B test / cost optimization)
  ↓
Cost Tracker (per-provider)
  ↓
Cache Result (24h TTL)
  ↓
Return Analysis
```

---

**Status**: Ready to implement multi-provider architecture in Phase 2
**Next**: Update implementation plan to reflect testing strategy
