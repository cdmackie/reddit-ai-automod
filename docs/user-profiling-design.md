# User Profiling System - Architecture Design

**Created**: 2025-10-26
**Status**: Design Phase
**Phase**: Phase 1.2

---

## Overview

This document describes the architecture for the user profiling system that will analyze Reddit users to detect problematic posters (romance scammers, dating seekers, underage users, spammers).

## Goals

1. Fetch user profile data (account age, karma, email verified)
2. Analyze post history (last 20 posts/comments from ALL subreddits)
3. Calculate trust scores (0-100) to identify trusted users
4. Cache aggressively to minimize API calls and costs
5. Provide foundation for AI analysis in Phase 2

## Architecture Components

### 1. User Profile Fetcher (`src/profile/fetcher.ts`)

**Purpose**: Fetch basic Reddit user profile data

**Data to Fetch**:
- Account creation date (calculate account age in days)
- Total karma (link karma + comment karma)
- Email verified status
- Is moderator status

**Devvit API**:
```typescript
const user = await reddit.getUserById(userId);
// Available properties:
// - user.createdAt: Date
// - user.linkKarma: number
// - user.commentKarma: number
// - user.isEmailVerified: boolean
// - user.username: string
```

**Caching Strategy**:
- Redis key: `user:{userId}:profile`
- TTL: 24 hours (86400000 ms)
- Rationale: User profile data changes slowly

**Return Type**:
```typescript
interface UserProfile {
  userId: string;
  username: string;
  accountAgeInDays: number;
  totalKarma: number;
  emailVerified: boolean;
  isModerator: boolean;
  fetchedAt: Date;
}
```

**Error Handling**:
- User not found → Return null
- API error → Log error, return null
- Rate limit hit → Wait and retry with exponential backoff
- Never throw, always graceful degradation

**Rate Limiting**:
- Respect Reddit API rate limits (60 requests/minute typical)
- Implement exponential backoff on rate limit errors
- Track request count per minute in Redis

---

### 2. Post History Analyzer (`src/profile/historyAnalyzer.ts`)

**Purpose**: Fetch and analyze user's recent post/comment history across ALL subreddits

**Data to Fetch**:
- Last 20 posts/comments (combined)
- For each item:
  - Content text (post body or comment body)
  - Subreddit name
  - Timestamp
  - Score (upvotes - downvotes)
  - Type (post or comment)

**Devvit API**:
```typescript
// Fetch user's posts and comments
const items = await reddit.getCommentsAndPostsByUser({
  username: username,
  limit: 20,
  sort: 'new'
});

// Items are sorted by creation time (newest first)
// Each item is either a Post or Comment
```

**Processing**:
1. Fetch last 20 items
2. For each item, extract:
   - Text content
   - Subreddit name
   - Creation timestamp
   - Score
   - Type (post/comment)
3. Calculate metrics:
   - Number of posts in target subreddits
   - Number of posts in dating/relationship subreddits
   - Average score across all posts
   - Posting frequency

**Caching Strategy**:
- Redis key: `user:{userId}:history`
- TTL: 24 hours (86400000 ms)
- Rationale: Post history changes, but 24h cache is acceptable for cost savings

**Return Type**:
```typescript
interface PostHistoryItem {
  id: string;
  type: 'post' | 'comment';
  subreddit: string;
  content: string;
  score: number;
  createdAt: Date;
}

interface UserPostHistory {
  userId: string;
  username: string;
  items: PostHistoryItem[];
  metrics: {
    totalItems: number;
    postsInTargetSubs: number; // posts in FriendsOver40/50, bitcointaxes
    postsInDatingSubs: number; // posts in dating/r4r subreddits
    averageScore: number;
    oldestItemDate: Date;
    newestItemDate: Date;
  };
  fetchedAt: Date;
}
```

**Error Handling**:
- User not found → Return empty history
- API error → Log error, return empty history
- Rate limit hit → Wait and retry with exponential backoff
- Never throw, always graceful degradation

**Rate Limiting**:
- Respect Reddit API rate limits
- Implement exponential backoff on rate limit errors
- Share rate limiter with UserProfileFetcher

---

### 3. Trust Score System (`src/profile/trustScore.ts`)

**Purpose**: Calculate a 0-100 trust score to identify users who can bypass expensive AI analysis

**Input Data**:
- User profile (from fetcher)
- Post history (from analyzer)
- Approved post history in current subreddit (from Redis audit logs)

**Scoring Algorithm**:

```
Total Score = Account Age Score (0-40)
            + Karma Score (0-30)
            + Email Verified Score (0-15)
            + Approved History Score (0-15)
```

**Score Breakdown**:

1. **Account Age Score (0-40 points)**:
   - < 7 days: 0 points
   - 7-30 days: 10 points
   - 30-90 days: 20 points
   - 90-365 days: 30 points
   - > 365 days: 40 points

2. **Karma Score (0-30 points)**:
   - < 10 karma: 0 points
   - 10-100 karma: 5 points
   - 100-500 karma: 10 points
   - 500-1000 karma: 15 points
   - 1000-5000 karma: 20 points
   - > 5000 karma: 30 points

3. **Email Verified Score (0-15 points)**:
   - Not verified: 0 points
   - Verified: 15 points

4. **Approved History Score (0-15 points)**:
   - Based on approved posts in THIS subreddit
   - 0 approved posts: 0 points
   - 1-2 approved posts: 5 points
   - 3-5 approved posts: 10 points
   - > 5 approved posts: 15 points

**Trust Threshold**:
- Score >= 70: User is "trusted" → Bypass AI analysis
- Score < 70: User needs AI analysis

**Storage**:
- Redis key: `user:{userId}:trustScore` → Store score as number
- Redis key: `user:{subreddit}:trusted:{userId}` → Store boolean (true if trusted in this sub)
- TTL: 7 days (604800000 ms) - longer than profile cache

**Cache Invalidation**:
- Invalidate trust score when user receives ban/spam action
- Invalidate on major negative action (e.g., user gets flagged 3+ times)
- Allow manual cache clear via mod tools (Phase 4)

**Return Type**:
```typescript
interface TrustScore {
  userId: string;
  subreddit: string;
  totalScore: number;
  breakdown: {
    accountAgeScore: number;
    karmaScore: number;
    emailVerifiedScore: number;
    approvedHistoryScore: number;
  };
  isTrusted: boolean; // true if totalScore >= 70
  calculatedAt: Date;
}
```

**Recalculation Logic**:
- Recalculate when:
  - User makes a new post (update approved history)
  - Cache expires (7 days)
- Trust score can increase over time as user posts more

---

## Type Definitions (`src/types/profile.ts`)

All interfaces and enums for the profiling system will be defined here:

```typescript
/**
 * Type definitions for user profiling system
 */

export interface UserProfile {
  userId: string;
  username: string;
  accountAgeInDays: number;
  totalKarma: number;
  emailVerified: boolean;
  isModerator: boolean;
  fetchedAt: Date;
}

export interface PostHistoryItem {
  id: string;
  type: 'post' | 'comment';
  subreddit: string;
  content: string;
  score: number;
  createdAt: Date;
}

export interface UserPostHistory {
  userId: string;
  username: string;
  items: PostHistoryItem[];
  metrics: {
    totalItems: number;
    postsInTargetSubs: number;
    postsInDatingSubs: number;
    averageScore: number;
    oldestItemDate: Date;
    newestItemDate: Date;
  };
  fetchedAt: Date;
}

export interface TrustScoreBreakdown {
  accountAgeScore: number;
  karmaScore: number;
  emailVerifiedScore: number;
  approvedHistoryScore: number;
}

export interface TrustScore {
  userId: string;
  subreddit: string;
  totalScore: number;
  breakdown: TrustScoreBreakdown;
  isTrusted: boolean;
  calculatedAt: Date;
}

export interface ProfileAnalysisResult {
  profile: UserProfile;
  history: UserPostHistory;
  trustScore: TrustScore;
  shouldBypassAI: boolean; // true if isTrusted
}
```

---

## Redis Storage Keys

### User Profile
- Pattern: `user:{userId}:profile`
- Example: `user:t2_abc123:profile`
- TTL: 24 hours
- Value: JSON serialized `UserProfile`

### Post History
- Pattern: `user:{userId}:history`
- Example: `user:t2_abc123:history`
- TTL: 24 hours
- Value: JSON serialized `UserPostHistory`

### Trust Score
- Pattern: `user:{userId}:trustScore`
- Example: `user:t2_abc123:trustScore`
- TTL: 7 days
- Value: JSON serialized `TrustScore`

### Trusted User Flag (per subreddit)
- Pattern: `user:{subreddit}:trusted:{userId}`
- Example: `user:FriendsOver40:trusted:t2_abc123`
- TTL: 7 days
- Value: `"true"` or absent (redis.get returns null)

---

## Integration with PostSubmit Handler

**Current Flow**:
1. Post is submitted
2. Handler receives event
3. Auto-approve (Phase 1 placeholder)

**New Flow (Phase 1.2)**:
1. Post is submitted
2. Handler receives event
3. **Check if user is trusted (Redis lookup)**:
   - Key: `user:{subreddit}:trusted:{userId}`
   - If exists → Approve immediately, skip to step 8
4. **Fetch user profile** (with cache):
   - Check Redis cache first
   - If cache miss → Fetch from Reddit API, cache for 24h
5. **Fetch post history** (with cache):
   - Check Redis cache first
   - If cache miss → Fetch from Reddit API, cache for 24h
6. **Calculate trust score**:
   - Use profile + history + approved post count
   - Store in Redis (7 day TTL)
   - If score >= 70 → Store trusted flag
7. **Phase 2 placeholder**: If not trusted, will call AI analysis here
8. **Log action** (audit log)
9. **Return**

**Performance Optimization**:
- Profile and history fetches will be parallelized using `Promise.all()`
- Both API calls happen simultaneously to minimize latency

**Code Changes Needed in `handlePostSubmit`**:
```typescript
import { UserProfileFetcher } from '../profile/fetcher';
import { PostHistoryAnalyzer } from '../profile/historyAnalyzer';
import { TrustScoreCalculator } from '../profile/trustScore';

// Inside handlePostSubmit:
const userId = post.authorId;
const username = author;
const subredditName = post.subredditName;

// Initialize profiling services
const profileFetcher = new UserProfileFetcher(redis, reddit);
const historyAnalyzer = new PostHistoryAnalyzer(redis, reddit);
const trustScoreCalc = new TrustScoreCalculator(redis);

// Check if user is trusted (fast path)
const isTrusted = await trustScoreCalc.isTrustedUser(userId, subredditName);
if (isTrusted) {
  console.log(`[PostSubmit] User ${username} is trusted, auto-approving`);
  await auditLogger.logApproval(postId, username, 'Trusted user (score >= 70)');
  return;
}

// Fetch profile and history in parallel (with cache)
const [profile, history] = await Promise.all([
  profileFetcher.getUserProfile(userId),
  historyAnalyzer.getPostHistory(userId, username)
]);

if (!profile) {
  console.log(`[PostSubmit] Could not fetch profile for ${username}`);
  // Fallback: FLAG for manual review (fail safe)
  await auditLogger.logFlag(postId, username, 'Profile fetch failed, flagged for manual review');
  return;
}

// Calculate trust score
const trustScore = await trustScoreCalc.calculateTrustScore(
  profile,
  history,
  subredditName
);

console.log(`[PostSubmit] Trust score for ${username}: ${trustScore.totalScore}/100`);

// If trusted now, mark as trusted
if (trustScore.isTrusted) {
  console.log(`[PostSubmit] User ${username} achieved trusted status`);
  await auditLogger.logApproval(
    postId,
    username,
    `Trusted user (score: ${trustScore.totalScore}/100)`
  );
  return;
}

// Phase 2: Here we will add AI analysis for non-trusted users
console.log(`[PostSubmit] User ${username} not trusted, will need AI analysis (Phase 2)`);
await auditLogger.logApproval(
  postId,
  username,
  `Not trusted (score: ${trustScore.totalScore}/100), approved for now (AI analysis in Phase 2)`
);
```

---

## Rate Limiter (`src/profile/rateLimiter.ts`)

**Purpose**: Prevent hitting Reddit API rate limits

**Implementation**:
```typescript
export class RateLimiter {
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private readonly maxRequests: number = 60; // per minute
  private readonly windowMs: number = 60000; // 1 minute

  async checkLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.windowStart >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If at limit, wait until window resets
    if (this.requestCount >= this.maxRequests) {
      const waitMs = this.windowMs - (now - this.windowStart);
      console.log(`[RateLimiter] Rate limit reached, waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }

  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.checkLimit();
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (error.message?.includes('rate limit')) {
          const backoffMs = Math.pow(2, i) * 1000; // exponential backoff
          console.log(`[RateLimiter] Retry ${i + 1}/${maxRetries} after ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Not a rate limit error, don't retry
          throw error;
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}
```

**Usage**:
- Shared singleton instance across all profile fetchers
- Automatically enforces 60 requests/minute limit
- Exponential backoff on rate limit errors
- Transparent to callers via `withRetry()` wrapper

---

## Class Structure

### UserProfileFetcher
```typescript
export class UserProfileFetcher {
  constructor(
    private redis: RedisClient,
    private redditApi: RedditAPIClient,
    private rateLimiter: RateLimiter
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile | null>

  private async fetchFromReddit(userId: string): Promise<UserProfile | null>

  private async cacheProfile(profile: UserProfile): Promise<void>

  private validateUserId(userId: string): boolean // Validate Reddit ID format (t2_*)
}
```

### PostHistoryAnalyzer
```typescript
export class PostHistoryAnalyzer {
  constructor(
    private redis: RedisClient,
    private redditApi: RedditAPIClient,
    private rateLimiter: RateLimiter
  ) {}

  async getPostHistory(userId: string, username: string): Promise<UserPostHistory>

  private async fetchFromReddit(username: string): Promise<PostHistoryItem[]>

  private calculateMetrics(items: PostHistoryItem[]): UserPostHistory['metrics']

  private async cacheHistory(history: UserPostHistory): Promise<void>
}
```

### TrustScoreCalculator
```typescript
export class TrustScoreCalculator {
  constructor(private redis: RedisClient) {}

  async calculateTrustScore(
    profile: UserProfile,
    history: UserPostHistory,
    subreddit: string
  ): Promise<TrustScore>

  async isTrustedUser(userId: string, subreddit: string): Promise<boolean>

  private async getApprovedPostCount(userId: string, subreddit: string): Promise<number>

  private calculateAccountAgeScore(accountAgeInDays: number): number

  private calculateKarmaScore(totalKarma: number): number

  private calculateEmailScore(emailVerified: boolean): number

  private calculateApprovedHistoryScore(approvedCount: number): number

  private async storeTrustScore(trustScore: TrustScore): Promise<void>

  private async storeTrustedFlag(userId: string, subreddit: string): Promise<void>

  async invalidateTrustScore(userId: string, subreddit: string): Promise<void> // Clear cache on negative action
}
```

---

## Configuration

Add to `src/types/config.ts`:

```typescript
export interface ProfileConfig {
  /** Number of posts/comments to fetch for history analysis */
  historyLimit: number; // default: 20

  /** Cache TTL for user profiles (ms) */
  profileCacheTTL: number; // default: 24h = 86400000

  /** Cache TTL for post history (ms) */
  historyCacheTTL: number; // default: 24h = 86400000

  /** Cache TTL for trust scores (ms) */
  trustScoreCacheTTL: number; // default: 7d = 604800000

  /** Trust threshold (0-100) for bypassing AI analysis */
  trustThreshold: number; // default: 70

  /** Target subreddits for detecting relevant activity */
  targetSubreddits: string[]; // default: ['FriendsOver40', 'FriendsOver50', 'bitcointaxes']

  /** Dating-related subreddits for pattern detection */
  datingSubreddits: string[]; // default: ['r4r', 'ForeverAloneDating', 'Dating', etc.]
}

export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  historyLimit: 20,
  profileCacheTTL: 86400000, // 24 hours
  historyCacheTTL: 86400000, // 24 hours
  trustScoreCacheTTL: 604800000, // 7 days
  trustThreshold: 70,
  targetSubreddits: ['FriendsOver40', 'FriendsOver50', 'bitcointaxes'],
  datingSubreddits: [
    'r4r',
    'ForeverAloneDating',
    'Dating',
    'dating_advice',
    'seduction',
    'r4r30plus',
    'r4r40plus'
  ]
};
```

---

## Error Handling Strategy

**Principle**: Never fail hard. Fail safely with FLAG action for manual review.

1. **Profile fetch fails** → Return null → FLAG post for manual review (log warning)
2. **History fetch fails** → Return empty history → Calculate trust score with just profile data
3. **Trust score calculation fails** → Assume not trusted → FLAG post for manual review
4. **Redis cache failures** → Skip cache, fetch from API directly (log error)
5. **All data fetches fail** → FLAG post for manual review (fail safe, not fail open)
6. **Rate limit errors** → Retry with exponential backoff (max 3 retries), then FLAG for review

**Rationale**: Auto-approving on errors creates security risk. Flagging ensures human review of problematic cases.

**Logging**:
- Log all errors to console with `[ProfileFetcher]`, `[HistoryAnalyzer]`, `[TrustScore]` prefixes
- Include userId, username in all logs for debugging
- Log cache hits/misses for monitoring

---

## Testing Plan

**Manual Testing** (Phase 1.2):
1. Test with new account (< 7 days, low karma) → Should get low trust score
2. Test with established account (> 1 year, high karma, verified) → Should get high trust score (>= 70)
3. Test with account that has posted in sub before → Should get approved history bonus
4. Test cache hits (second post from same user within 24h) → Should use cached data
5. Test with [deleted] user → Should handle gracefully
6. Test with suspended user → Should handle gracefully

**Automated Testing** (Phase 1.3 - Next):
- Unit tests for trust score calculation logic
- Unit tests for metrics calculation
- Integration tests with mock Reddit API
- Cache behavior tests

---

## Performance Considerations

**Expected Performance**:
- **Trusted user check**: < 10ms (single Redis lookup)
- **Cached profile + history**: < 20ms (two Redis lookups + calculation)
- **Uncached (first time user)**: 200-500ms (Reddit API calls + calculation + caching)

**Optimization**:
- Trust flag is checked FIRST (fastest path for returning users)
- Profile and history are cached separately (can reuse if one expires)
- Trust scores have longer TTL (7 days vs 24 hours for raw data)
- All Redis operations are awaited in parallel where possible

---

## Security & Privacy

**Data Minimization**:
- Only fetch publicly available Reddit data
- Only store what's needed for analysis
- Cache expiration ensures data doesn't persist forever

**No PII**:
- No email addresses stored (only verified status)
- No IP addresses or device info
- Only public Reddit usernames and content

**Compliance**:
- Complies with Reddit API ToS (only public data)
- Complies with Devvit platform policies
- No data sold or shared with third parties

---

## Success Criteria

Phase 1.2 is complete when:
- ✅ All three components implemented (fetcher, analyzer, trust score)
- ✅ Type definitions created
- ✅ PostSubmit handler integrated
- ✅ Manual testing shows:
  - Established users get high trust scores (>= 70)
  - New users get low trust scores (< 70)
  - Cache works (second request uses cached data)
  - Errors are handled gracefully
- ✅ Deployed to playtest subreddit
- ✅ Code review completed
- ✅ Documentation updated
- ✅ Committed to git

---

## Next Steps (Phase 2)

After Phase 1.2 is complete:
1. Integrate OpenAI API for AI analysis of non-trusted users
2. Implement cost tracking system
3. Create AI analysis prompts for dating/scammer/age detection
4. Add budget enforcement (daily limits)
5. Cache AI analysis results

---

**Status**: Ready for architect review
**Next**: Deploy architect-reviewer to validate this design
