# Phase 5.14: Community Trust System - Implementation Plan

**Version:** 0.1.16
**Status:** Planning - Awaiting Approval
**Estimated Time:** 4-6 hours implementation + testing
**Complexity:** High (architectural refactor)

---

## Executive Summary

Replace global trust score with community-specific trust scores that track user behavior within each subreddit separately. This prevents high-karma veterans from bypassing community-specific rules when posting for the first time.

### Key Changes
- ✅ Remove global trust score bypass
- ✅ Add community-specific trust tracking (posts and comments separate)
- ✅ Ratio-based scoring (70% approval rate minimum)
- ✅ Real-time ModAction listener for mod removals
- ✅ Decay system (-5% per month of inactivity)
- ✅ Always run Layer 1 (trivial cost)

---

## Problem Statement

**Current Flaw:**
```typescript
// User has high global trust score (old account, good karma)
if (trustScore > 70) {
  return; // Skip ALL checks including community-specific rules
}
```

**Scenario:**
- User: 10-year account, 50k karma (HIGH global trust)
- First post in r/FriendsOver40: "Looking for romance"
- Current: ❌ Skips all checks (violates community norms but bypassed)
- Should: ✅ Run Layer 3 AI rules (catches dating intent)

**Root Cause:** Global trust measures "legitimate Reddit account" not "follows THIS community's rules"

---

## Solution Architecture

### 1. Data Structure

**New: Community Trust (Per-Subreddit)**
```typescript
interface CommunityTrust {
  userId: string;
  subreddit: string;

  posts: {
    submitted: number;
    approved: number;
    flagged: number;
    removed: number;
    approvalRate: number; // (approved / submitted) * 100
  };

  comments: {
    submitted: number;
    approved: number;
    flagged: number;
    removed: number;
    approvalRate: number;
  };

  lastActivity: Date;
  lastCalculated: Date;
}
```

**Redis Keys:**
```
trust:community:{userId}:{subreddit} → CommunityTrust JSON
approved:tracking:{contentId} → ApprovedContentRecord (24h TTL)
```

### 2. Trust Evaluation Logic

**Thresholds:**
- Minimum approval rate: **70%**
- Minimum submissions: **3** (updated from 10 based on user feedback)
- Decay rate: **-5% per month** of inactivity

**Formula:**
```typescript
// Step 1: Calculate raw approval rate
approvalRate = (approved / submitted) * 100

// Step 2: Apply decay for inactivity
monthsInactive = getMonthsSince(lastActivity)
decayAmount = monthsInactive * 5
approvalRate = Math.max(0, approvalRate - decayAmount)

// Step 3: Check if trusted
isTrusted = (submitted >= 3) && (approvalRate >= 70)
```

**Examples:**
- 3 posts, 3 approved = 100% ✅ TRUSTED
- 3 posts, 2 approved, 1 flagged = 67% ❌ NOT TRUSTED
- 4 posts, 3 approved, 1 flagged = 75% ✅ TRUSTED
- 10 posts, 7 approved, 3 flagged = 70% ✅ TRUSTED
- 2 posts, 2 approved = 100% but < 3 minimum ❌ NOT TRUSTED
- 5 posts, 4 approved, 3 months inactive = 80% - 15% = 65% ❌ NOT TRUSTED

### 3. Flow Changes

**Current Flow:**
```
1. Check global trust score
2. If > 70 → Skip ALL checks (❌ PROBLEM)
3. Otherwise → Run Layers 1, 2, 3
```

**New Flow:**
```
1. Check whitelist → Complete bypass
2. ALWAYS run Layer 1 (account age, karma) - FREE
   └─ If fails → Execute action
3. Check community trust (separate for posts/comments)
   └─ If trusted (≥70% approval, ≥3 submissions):
      └─ Skip Layers 2 & 3 (COST SAVINGS)
   └─ Otherwise:
      └─ Run Layer 2 (OpenAI Moderation) - FREE
      └─ Run Layer 3 (Custom AI Rules) - PAID
4. Execute action
5. Update community trust score
6. Track if APPROVED (for ModAction audit)
```

---

## Implementation Details

### Component 1: CommunityTrustManager (NEW)

**File:** `src/trust/communityTrustManager.ts`
**Lines:** ~400 lines

**Functions:**
```typescript
class CommunityTrustManager {
  // Get trust for user in subreddit (with decay applied)
  async getTrust(userId, subreddit, contentType): Promise<TrustEvaluation>

  // Update trust after action
  async updateTrust(userId, subreddit, action, contentType): Promise<void>

  // Track approved content for ModAction audit
  async trackApproved(contentId, userId, subreddit, contentType): Promise<void>

  // Retroactively update trust (called by ModAction handler)
  async retroactiveRemoval(contentId): Promise<void>

  // Calculate approval rate with decay
  private calculateApprovalRate(stats, lastActivity): number

  // Initialize new community trust record
  private initializeTrust(userId, subreddit): CommunityTrust
}
```

**Key Logic:**
```typescript
async getTrust(userId, subreddit, contentType) {
  const trust = await redis.get(`trust:community:${userId}:${subreddit}`);
  if (!trust) return { isTrusted: false, approvalRate: 0, ... };

  const stats = contentType === 'post' ? trust.posts : trust.comments;

  // Apply decay
  const monthsInactive = getMonthsSince(trust.lastActivity);
  const decayAmount = monthsInactive * 5;
  const approvalRate = Math.max(0,
    (stats.approved / stats.submitted) * 100 - decayAmount
  );

  const isTrusted = stats.submitted >= 3 && approvalRate >= 70;

  return { isTrusted, approvalRate, submissions: stats.submitted, ... };
}
```

### Component 2: ModAction Event Handler (NEW)

**File:** `src/handlers/modAction.ts`
**Lines:** ~150 lines

**Purpose:** Catch when mods manually remove posts/comments that we approved

**Implementation:**
```typescript
Devvit.addTrigger({
  event: 'ModAction',
  onEvent: async (event, context) => {
    const { redis } = context;
    const action = event.action;

    // Only care about removals
    if (action !== 'removelink' && action !== 'spamlink' &&
        action !== 'removecomment' && action !== 'spamcomment') {
      return;
    }

    // Get content ID
    const contentId = event.targetPost?.id || event.targetComment?.id;
    if (!contentId) return;

    // Check if WE approved this content
    const approvedRecord = await redis.get(`approved:tracking:${contentId}`);
    if (!approvedRecord) return; // We didn't approve it

    console.log(`[ModAction] Mod removed ${contentId} that we approved`);

    // Retroactively update trust score
    const trustManager = new CommunityTrustManager(context);
    await trustManager.retroactiveRemoval(contentId);

    // Clean up tracking
    await redis.del(`approved:tracking:${contentId}`);
  }
});
```

**Important Note:** Based on your requirement #4:
> "Yes, it probably need to be a reason, so a comment gets added by the mod. If no comment then ignore it."

Unfortunately, the ModAction event **does not include removal reason/comment**. We only get:
- action type (removelink, spamlink)
- moderator
- target post/comment
- timestamp

**Options:**
1. **Count all mod removals** (simpler, but includes non-rule violations)
2. **Use action type as proxy** (spamlink = -30 points, removelink = -20 points)
3. **Skip ModAction entirely**, use hourly audit to check post.removed flag

**My recommendation:** Option 1 - Count all removals. If a mod removes it, user loses trust.

### Component 3: Update PostSubmit Handler

**File:** `src/handlers/postSubmit.ts`
**Changes:** ~50 lines modified

**Key Changes:**
```typescript
// REMOVE this block (lines ~109-120):
const trustScore = await TrustScore.calculate(...);
if (trustScore.score > 70) {
  console.log('User trusted, skipping checks');
  return; // ❌ DELETE THIS
}

// ADD community trust check (after Layer 1):
const trustManager = new CommunityTrustManager(context);
const trustEval = await trustManager.getTrust(author, subreddit, 'post');

if (trustEval.isTrusted) {
  console.log(`[PostSubmit] User trusted in r/${subreddit} (${trustEval.approvalRate.toFixed(1)}%), skipping Layers 2 & 3`);

  // Still update trust (APPROVE)
  await trustManager.updateTrust(author, subreddit, 'APPROVE', 'post');
  await auditLogger.log({ action: 'APPROVE', reason: 'Community trusted', ... });
  return;
}

// After action executed, update trust
await trustManager.updateTrust(author, subreddit, action, 'post');

// If approved, track for ModAction audit
if (action === 'APPROVE') {
  await trustManager.trackApproved(postId, author, subreddit, 'post');
}
```

### Component 4: Update CommentSubmit Handler

**File:** `src/handlers/commentSubmit.ts`
**Changes:** Same pattern as PostSubmit (~50 lines)

### Component 5: Remove Old Trust Score System

**Files to Modify:**
- `src/profile/trustScore.ts` - Keep file but mark as deprecated
- `src/types/profile.ts` - Keep TrustScore type for backwards compatibility
- Both handlers - Remove trust score calculations

**Rationale:** Don't delete old code immediately in case we need to roll back

---

## Migration Strategy

### Phase 1: Deploy with Feature Flag (Version 0.1.16)

```typescript
// Add setting
Devvit.addSettings([{
  name: 'useCommunityTrust',
  type: 'boolean',
  label: 'Use Community Trust (NEW)',
  defaultValue: false,
  helpText: 'Enable new community-specific trust system'
}]);

// In handlers
const useCommunityTrust = settings.get('useCommunityTrust');
if (useCommunityTrust) {
  // New community trust logic
} else {
  // Old global trust logic
}
```

**Testing Plan:**
1. Deploy to r/AiAutomod with flag OFF (no change)
2. Turn flag ON, test with multiple users
3. Verify trust scores update correctly
4. Verify ModAction handler catches removals
5. After 24h validation, deploy to production subs

### Phase 2: Remove Feature Flag (Version 0.1.17)

After successful testing:
- Remove feature flag setting
- Remove old trust score logic
- Make community trust mandatory

---

## Testing Checklist

### Unit Tests (LOCAL TESTING FRAMEWORK CREATED ✅)
- [x] Local testing framework created (src/__mocks__/devvit.ts)
- [x] Comprehensive test suite created (src/trust/__tests__/communityTrust.test.ts)
- [x] Tests cover:
  - [x] Initial state (new users)
  - [x] Building trust (3 posts minimum)
  - [x] Separate post/comment tracking (prevents gaming)
  - [x] Cross-subreddit isolation
  - [x] Retroactive removal (ModAction simulation)
  - [x] Decay system (5% per month)
  - [x] Edge cases (removals, mixed actions, 0% floor)
- [ ] Run tests locally: `npm test src/trust/__tests__/communityTrust.test.ts`

### Integration Tests (Manual)
- [ ] New user (0 posts) → Runs all layers
- [ ] User with 2 approved posts → Runs all layers (< 3 minimum)
- [ ] User with 3 approved posts → Skips Layers 2 & 3
- [ ] User with 8/10 approved (80%) → Trusted
- [ ] User with 6/10 approved (60%) → Not trusted
- [ ] User with 10 approved, 3 months inactive → Decay applied
- [ ] Mod removes approved post → Trust score decreases
- [ ] Whitelisted user → Always bypasses (no trust tracking)
- [ ] Dry-run mode → Doesn't update trust scores

### Performance Tests
- [ ] Trust lookup < 100ms
- [ ] ModAction handler < 200ms
- [ ] No memory leaks with Redis connections

---

## Cost Impact Analysis

### Current Costs (with global trust bypass)
```
Assumptions:
- 1000 posts/month per subreddit
- 30% have high global trust (skip ALL layers)
- 70% run through Layers 1, 2, 3

Layer costs:
- Layer 1: $0 (always run, trivial)
- Layer 2: $0 (OpenAI Mod is free)
- Layer 3: $0.05 per analysis (AI)

Monthly cost:
= 700 posts × $0.05
= $35/month per subreddit
```

### New Costs (with community trust)
```
Assumptions:
- 1000 posts/month per subreddit
- 20% first-time posters (0% community trust)
- 30% regular posters (still building trust, <10 posts)
- 50% trusted contributors (≥10 approved posts, ≥70%)

Layer 3 runs for:
- First-time: 200 posts
- Building: 300 posts
- Trusted: 0 posts (SKIP)

Monthly cost:
= 500 posts × $0.05
= $25/month per subreddit
```

**Savings:** $10/month per subreddit (~29% reduction)

**Key Benefit:** First-time high-karma users are NOW validated for community-specific rules

---

## Rollback Plan

If community trust causes issues:

1. **Immediate:** Turn off `useCommunityTrust` feature flag
2. **Short-term:** System reverts to old global trust logic
3. **Analysis:** Review logs to identify issue
4. **Fix:** Deploy patch with corrections
5. **Retry:** Enable flag after validation

**Data Safety:**
- Old trust score calculations remain in code
- Community trust data stored separately (won't conflict)
- Can run both systems in parallel during transition

---

## Open Questions

1. **ModAction removal reason:** Since we can't access removal reason, should we:
   - Count ALL mod removals? (Current plan)
   - Only count SPAM removals (harsher penalty)?
   - Skip ModAction, use hourly audit instead?

2. **Decay rate:** -5% per month appropriate, or should it be:
   - Higher (e.g., -10%/month for faster reset)?
   - Lower (e.g., -2%/month for seasonal posters)?
   - None (hard reset at 6 months)?

3. **Minimum submissions:** 10 posts seems high for low-traffic subs. Should it be:
   - Configurable per subreddit?
   - Based on sub activity (e.g., 1% of monthly posts)?

4. **Cross-subreddit trust:** Should trust in r/FriendsOver40 give partial trust in r/FriendsOver50 (sister communities)?

5. **Comments vs Posts:** Should comments require lower threshold (e.g., 5 approved comments vs 10 posts)?

---

## Approval Checklist

Before proceeding with implementation, please confirm:

- [ ] Overall architecture approved
- [ ] Ratio-based scoring (70% approval rate) approved
- [ ] Separate post/comment tracking approved
- [ ] ModAction handler approach approved (count all removals)
- [ ] Decay rate (-5%/month) approved
- [ ] Feature flag migration strategy approved
- [ ] Cost impact acceptable ($25/month per sub)
- [ ] Ready to proceed with implementation

---

## Next Steps After Approval

1. Implement CommunityTrustManager service
2. Implement ModAction event handler
3. Update PostSubmit handler
4. Update CommentSubmit handler
5. Add feature flag setting
6. Deploy to r/AiAutomod for testing
7. Validate with multiple test scenarios
8. Deploy to production after 24h validation
9. Monitor costs and trust score accuracy
10. Remove feature flag after 1 week stable operation

**Estimated Timeline:**
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Deployment + monitoring: 24-48 hours
- **Total: 2-3 days to production**
