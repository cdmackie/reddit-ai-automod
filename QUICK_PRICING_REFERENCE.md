# Quick Pricing Reference

Quick lookup for content moderation API costs.

---

## TL;DR - Best Choice by Use Case

| Use Case | Provider | Model | Cost/Month (1000 posts/day) |
|----------|----------|-------|---------------------------|
| **Free tier learning** | OpenAI | Moderation API | **$0** |
| **Small subreddit** | OpenAI + Claude | Moderation + Haiku | **$5-15** |
| **Medium subreddit** | Claude | Haiku with caching | **$10-25** |
| **Large subreddit** | Claude | Haiku Batch + caching | **$5-15** |
| **Budget conscious** | Together AI | Llama 3.1 70B | **$8-12** |
| **High accuracy needed** | Claude | Sonnet + caching | **$25-50** |

---

## Detailed Pricing Breakdown

### 1. OpenAI Moderation API (FREE)

**When to use**: Always - it's free!

**Cost formula**:
- Price: $0 (completely free)
- Limit: 3,500 requests/minute
- Per 1000 calls: $0

**Monthly cost for different volumes**:
- 500 posts/day: $0
- 1,000 posts/day: $0
- 5,000 posts/day: $0
- 10,000 posts/day: $0

**What you get**:
- 7 content categories
- Confidence scores for each
- Fast response (~200ms)
- 85-90% accuracy

**Trade-offs**:
- No explanations
- No custom categories
- Fixed response schema
- Limited to binary flagging

---

### 2. OpenAI GPT-4o Mini (CHEAP FALLBACK)

**Pricing**:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Typical: 200 tokens input, 75 output = ~$0.00013 per request

**Cost formula** (for flagged items):
- Per 1000 detailed analyses: $0.13
- 50% of posts flagged: 500 analyses/day = $3.25/month

**Monthly cost for different volumes** (assuming 10% need detailed analysis):
- 500 posts/day (50 detailed): $1.63
- 1,000 posts/day (100 detailed): $3.25
- 5,000 posts/day (500 detailed): $16.25
- 10,000 posts/day (1000 detailed): $32.50

**Best for**:
- Appeals and edge cases
- Fallback from Moderation API
- Custom subreddit rules

---

### 3. Claude Haiku 4.5 (RECOMMENDED)

**Base pricing**:
- Input: $1.00 per 1M tokens
- Output: $5.00 per 1M tokens
- Typical: 250 tokens input, 75 output = ~$0.000625 per request

**With Prompt Caching** (90% savings on system prompt):
- System prompt: ~1500 tokens cached
- Per request saved: ~1350 tokens × 90% discount = save $0.00135/request
- **Effective cost: ~$0.00046 per request**

**With Batch Processing** (50% discount):
- All costs reduced by 50%
- Real-time: $0.000625/request
- Batch: $0.0003125/request

**With Both** (caching + batch = ~92% total savings):
- Effective cost: **~$0.00005 per request**

**Monthly costs** (average 250 input + 75 output tokens):

| Volume | Base Cost | + Caching | + Batch | Batch + Caching |
|--------|-----------|-----------|---------|-----------------|
| 500/day | $9.38 | $1.56 | $4.69 | $0.78 |
| 1,000/day | $18.75 | $3.13 | $9.38 | $1.56 |
| 5,000/day | $93.75 | $15.63 | $46.88 | $7.81 |
| 10,000/day | $187.50 | $31.25 | $93.75 | $15.63 |

**Why Claude Haiku**:
- Fastest model (200-400ms)
- Best accuracy for cost
- Excellent for moderation edge cases
- Cost optimizations (caching, batch)
- Structured JSON output

---

### 4. Claude Sonnet 4.x (HIGH ACCURACY)

**Pricing**:
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
- Per request: ~$0.001875

**With optimizations**:
- Caching: $0.0003125/request
- Batch: $0.0009375/request
- Both: $0.00015625/request

**When to use**:
- Appeals (needs better reasoning)
- Complex subreddit rules
- Accuracy > speed
- <1000 posts/day

**Monthly costs** (for appeals/complex cases):

| 100 daily appeals | Base Cost | + Caching | + Batch | Batch + Caching |
|--------|-----------|-----------|---------|-----------------|
| 500/month | $2.81 | $0.47 | $1.41 | $0.23 |
| 1,000/month | $5.63 | $0.94 | $2.81 | $0.47 |
| 3,000/month | $16.88 | $2.81 | $8.44 | $1.41 |

---

### 5. Google Gemini 2.5 Flash

**Pricing**:
- Input: $0.30 per 1M tokens
- Output: $2.50 per 1M tokens
- Per request: ~$0.0001875

**With batch discount** (50% off):
- Per request: ~$0.00009375

**Monthly costs** (250 input, 75 output):

| Volume | Base Cost | Batch |
|--------|-----------|-------|
| 500/day | $2.81 | $1.41 |
| 1,000/day | $5.63 | $2.81 |
| 5,000/day | $28.13 | $14.06 |
| 10,000/day | $56.25 | $28.13 |

**Advantage over Claude**:
- Cheaper per token
- No caching cost savings (only 25% batch)
- Slightly slower

---

### 6. Together AI - Llama 3.1 70B

**Pricing**:
- Input: $0.88 per 1M tokens
- Output: $0.88 per 1M tokens
- Per request: ~$0.000275

**With batch** (50% off):
- Per request: ~$0.0001375

**Monthly costs**:

| Volume | Base Cost | Batch |
|--------|-----------|-------|
| 500/day | $4.13 | $2.06 |
| 1,000/day | $8.25 | $4.13 |
| 5,000/day | $41.25 | $20.63 |
| 10,000/day | $82.50 | $41.25 |

**Trade-offs**:
- Lower cost per token
- Much lower accuracy (requires fine-tuning)
- No explanations or confidence scores
- Higher false positive rate (10-15%)

---

## Cost Comparison Table

**For 1,000 posts/day (30,000/month)** with average 250 input + 75 output tokens:

| Provider | Model | Base Cost | Optimized | Accuracy | Notes |
|----------|-------|-----------|-----------|----------|-------|
| **OpenAI** | **Moderation** | **$0** | **$0** | **85-90%** | **START HERE** |
| OpenAI | GPT-4o Mini | $3.25 | - | 90-92% | For 10% flagged items |
| Claude | Haiku | $18.75 | $1.56 | 92-95% | Best combination |
| Claude | Sonnet | $56.25 | $4.69 | 95-97% | For appeals |
| Gemini | Flash | $5.63 | $2.81 | 88-92% | Simple cost-effective |
| Together | Llama 70B | $8.25 | $4.13 | 80-85% | Needs training |

---

## Real-World Examples

### Example 1: r/gaming (500 posts/day)

**Setup**: OpenAI Moderation API only

```
Monthly volume: 500 posts × 30 days = 15,000 posts
Monthly cost: $0
Accuracy: 85-90%
Processing: Real-time
```

**When to upgrade**: If getting false positives > 20%

---

### Example 2: r/news (2,000 posts/day)

**Setup**: OpenAI Moderation API + Claude Haiku for appeals

```
Posts: 2,000 posts × 30 = 60,000
Automated (Moderation API): 54,000 × $0 = $0
Appeals (Claude Haiku): 6,000 × $0.000625 = $3.75
Monthly cost: $3.75
Accuracy: 92-95%
Processing: Mixed real-time + async
```

---

### Example 3: r/AskReddit (5,000 posts/day)

**Setup**: OpenAI Moderation API + Claude Haiku Batch (overnight)

```
Daily volume: 5,000 posts
Monthly: 150,000 posts

Real-time queue (Moderation API): 100,000 × $0 = $0
Nightly batch (Claude Haiku): 50,000 × 250 tokens = 12.5M tokens
  - Base: 12.5M × $0.000006 = $75
  - With batch 50% discount: $37.50
  - With caching 90% discount: $3.75

Monthly cost: $3.75
Accuracy: 95%+
Processing: Real-time + batch
```

---

### Example 4: High-Accuracy Moderation (all appeals reviewed)

**Setup**: Claude Sonnet for all items

```
Volume: 1,000 posts/day
Monthly: 30,000 posts

- All posts analyzed: 30,000 × 250 tokens = 7.5M
- Base cost: 7.5M × $0.000006 = $45
- With batch 50%: $22.50
- With caching 90%: $2.25

Alternative with hybrid (Haiku + Sonnet for appeals):
- Haiku for 95%: 28,500 × $0.000006 = $17.10
- Sonnet for 5%: 1,500 × $0.00001875 = $28.13
- Total: $45.23
- With optimizations: ~$5

Better option: Use only Haiku with caching (~$3.75)
```

---

## Token Counting Reference

### Average Reddit Content Sizes

| Type | Length | Tokens |
|------|--------|--------|
| Title (300 char max) | ~50 words | 65-80 |
| Comment (10k char max) | ~27 words average | 36-45 |
| Short post | ~100 words | 130-150 |
| Medium post | ~300 words | 390-450 |
| Long post | ~800 words | 1040-1200 |
| **Typical (title + comment)** | ~80 words | **100-150** |

**For moderation response**:
- Binary decision: 20-30 tokens
- With categories: 50-75 tokens
- With explanation: 100-150 tokens
- **Typical output: 75 tokens**

**Typical total**: 200-250 input tokens + 75 output tokens = **275 tokens per item**

---

## Cost Calculation Template

```
Monthly calculation:
Items per day: ___
Days: 30
Monthly volume: ___ × 30 = ___

Tokens per item: 275 (or your actual number)
Monthly tokens: ___ × 275 = ___

Cost calculation:
API: _______________
Input tokens: ___ × $/1M input = $_
Output tokens: ___ × $/1M output = $_
Subtotal: $_

Discount calculations:
- Batch (50% off): × 0.5
- Caching (varies): × discount %
Final cost: $_

Cost per item: $_ ÷ items = $0.00___
```

---

## Rule of Thumb Costs

**Quick mental math**:

- **OpenAI Moderation API**: $0/month (always use first)
- **Claude Haiku base**: ~$0.0006 per item = ~$18/month per 1000/day
- **Claude Haiku optimized**: ~$0.00005 per item = ~$1.50/month per 1000/day
- **Gemini Flash**: ~$0.0002 per item = ~$6/month per 1000/day
- **Together AI**: ~$0.0003 per item = ~$9/month per 1000/day

---

## When to Upgrade Models

| Metric | Upgrade From | To | Reason |
|--------|--------------|-----|--------|
| Accuracy <85% | Moderation API | Claude Haiku | Higher accuracy needed |
| Accuracy <92% | Haiku | Sonnet | Better reasoning for complex cases |
| Appeals >10% | Haiku | Hybrid (Haiku + Sonnet) | Appeals need detailed explanation |
| Cost >$50/month | Individual API | Batch processing | Volume justifies async |
| Speed <100ms needed | Any | Gemini Flash-Lite | Fastest possible |
| Custom categories | Moderation API | Claude Haiku | Need flexible schema |

---

## Cost Savings Tips

1. **Always start with OpenAI Moderation API** (FREE)
2. **Use prompt caching** for system prompts/rules (90% savings)
3. **Use batch processing for non-urgent items** (50% savings)
4. **Combine caching + batch** for ~92% total savings
5. **Set confidence thresholds** to reduce unnecessary detailed analysis
6. **Cache subreddit-specific rules** to save tokens
7. **Use Haiku instead of Sonnet** unless accuracy is critical
8. **Submit batch jobs during off-peak hours** (may get faster processing)
9. **Monitor API usage** and adjust thresholds quarterly
10. **Consider dedicated endpoint** if >100k requests/day

---

## Annual Budget Examples

| Scenario | Monthly | Annual | Setup |
|----------|---------|--------|-------|
| Small subreddit (1k posts/day) | $0-5 | $0-60 | OpenAI Moderation API |
| Medium (5k posts/day) | $5-15 | $60-180 | OpenAI + Claude Haiku |
| Large (10k posts/day) | $10-30 | $120-360 | OpenAI + Claude Batch |
| Enterprise (50k posts/day) | $50-150 | $600-1800 | Multi-model hybrid |

---

## Free Tier Limits

| Provider | Free Tier Limit | When You Hit It |
|----------|-----------------|-----------------|
| OpenAI Moderation | Unlimited (free forever) | Never (it's free!) |
| Claude | Tier 1: 50 RPM, 30K ITPM | 5,000+ posts/day |
| Gemini | 2 requests/sec | 170,000 requests/day |
| Together AI | 6,000 req/min | 8,640,000/day (unlimited) |

---

## Total Cost of Ownership (6 months)

**Setup + Operation for medium subreddit (5,000 posts/day)**:

| Cost Category | Amount |
|---------------|--------|
| Development time | 16 hours × $100/hr = $1,600 |
| API costs (6 months) | $75 × 6 = $450 |
| Infrastructure (if self-hosted) | $0-200 |
| Monitoring/logging tools | $0-100 |
| Human moderator time (appeals) | ~10 hrs/month × $50 = $3,000 |
| **Total 6-month cost** | **~$5,200** |

vs Traditional moderation:
- 1 full-time moderator: $30k/year (+ benefits)
- Still makes economic sense at >10 posts/day!
