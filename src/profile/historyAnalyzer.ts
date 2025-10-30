/**
 * Post History Analyzer
 *
 * This module fetches and analyzes a user's recent post and comment history
 * across ALL subreddits. It caches the results in Redis to minimize API calls
 * and calculates metrics used for trust score calculation.
 *
 * **Caching Strategy**:
 * - Redis key pattern: `user:{userId}:history`
 * - TTL: 24 hours (86400000 ms)
 * - Check cache first, fetch from API on miss
 *
 * **Data Fetched**:
 * - Up to 100 posts and 100 comments (200 total max, configurable via DEFAULT_PROFILE_CONFIG.historyLimit)
 * - Sorted by creation date (newest first)
 * - Content is sanitized and compacted to optimize token usage for AI analysis
 * - Includes subreddit, score, and timestamp
 *
 * **Content Sanitization**:
 * - Post titles: kept as-is (already short)
 * - Post bodies: truncated to 500 characters
 * - Comment bodies: truncated to 300 characters
 * - URLs replaced with [URL]
 * - Markdown formatting removed
 * - Excessive whitespace collapsed
 *
 * **Metrics Calculated**:
 * - Total items fetched
 * - Number of posts in target subreddits (FriendsOver40/50, bitcointaxes)
 * - Number of posts in dating/relationship subreddits
 * - Average score across all posts and comments
 * - Date range of post history
 *
 * **Error Handling**:
 * - User not found → Return empty history (0 items)
 * - API errors → Log error, return empty history
 * - Never throws exceptions, always returns empty history on failure
 *
 * **Usage**:
 * ```typescript
 * const analyzer = new PostHistoryAnalyzer(redis, reddit, rateLimiter);
 * const history = await analyzer.getPostHistory('t2_abc123', 'username');
 * console.log(`User has ${history.metrics.postsInTargetSubs} posts in target subs`);
 * ```
 */

import { RedisClient, RedditAPIClient, Post, Comment } from '@devvit/public-api';
import { UserPostHistory, PostHistoryItem, DEFAULT_PROFILE_CONFIG } from '../types/profile';
import { RateLimiter } from './rateLimiter';
import { RedisStorage } from '../storage/redis';
import { StorageKey } from '../types/storage';

/**
 * Fetches and analyzes user post history from Reddit
 */
export class PostHistoryAnalyzer {
  private storage: RedisStorage;
  private cacheTTL: number;
  private historyLimit: number;
  private targetSubreddits: Set<string>; // Lowercase for case-insensitive comparison
  private datingSubreddits: Set<string>; // Lowercase for case-insensitive comparison

  constructor(
    redis: RedisClient,
    private reddit: RedditAPIClient,
    private rateLimiter: RateLimiter
  ) {
    this.storage = new RedisStorage(redis);
    this.cacheTTL = DEFAULT_PROFILE_CONFIG.historyCacheTTL;
    this.historyLimit = DEFAULT_PROFILE_CONFIG.historyLimit;

    // Convert to lowercase for case-insensitive matching
    this.targetSubreddits = new Set(
      DEFAULT_PROFILE_CONFIG.targetSubreddits.map(sub => sub.toLowerCase())
    );
    this.datingSubreddits = new Set(
      DEFAULT_PROFILE_CONFIG.datingSubreddits.map(sub => sub.toLowerCase())
    );
  }

  /**
   * Get user post history (from cache or Reddit API)
   *
   * This is the main public method. It:
   * 1. Checks Redis cache for existing post history
   * 2. If cache miss, fetches from Reddit API and caches the result
   * 3. Calculates metrics from the post history
   * 4. Handles all errors gracefully by returning empty history
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @param username - Reddit username (used for API calls)
   * @returns User post history with metrics or empty history on error
   */
  async getPostHistory(userId: string, username: string): Promise<UserPostHistory> {
    try {
      // Check cache first
      // Key format: user:{userId}:history
      const cacheKey = this.storage.buildKey(StorageKey.USER_HISTORY, userId, 'history');
      const cached = await this.storage.get<UserPostHistory>(cacheKey);

      if (cached) {
        console.log(`[HistoryAnalyzer] Cache hit for user ${username} (${userId})`);
        // Deserialize Date objects
        return {
          ...cached,
          items: cached.items.map(item => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
          metrics: {
            ...cached.metrics,
            oldestItemDate: new Date(cached.metrics.oldestItemDate),
            newestItemDate: new Date(cached.metrics.newestItemDate),
          },
          fetchedAt: new Date(cached.fetchedAt),
        };
      }

      console.log(`[HistoryAnalyzer] Cache miss for user ${username}, fetching from API`);

      // Fetch from Reddit API
      const items = await this.fetchFromReddit(username);

      // Calculate metrics
      const fetchedAt = new Date();
      const metrics = this.calculateMetrics(items, fetchedAt);

      // Calculate additional metrics
      const totalPosts = items.filter((item) => item.type === 'post').length;
      const totalComments = items.filter((item) => item.type === 'comment').length;
      const subreddits = [...new Set(items.map((item) => item.subreddit))];

      // Build UserPostHistory object
      const history: UserPostHistory = {
        userId,
        username,
        items,
        metrics,
        totalPosts,
        totalComments,
        subreddits,
        fetchedAt,
      };

      // Cache the result
      await this.cacheHistory(history);

      console.log(
        `[HistoryAnalyzer] Successfully fetched and cached history for ${username} (${items.length} items)`
      );
      return history;
    } catch (error) {
      console.error(`[HistoryAnalyzer] Error fetching history for ${username} (${userId}):`, error);

      // Return empty history on error (graceful degradation)
      const fetchedAt = new Date();
      return {
        userId,
        username,
        items: [],
        metrics: {
          totalItems: 0,
          postsInTargetSubs: 0,
          postsInDatingSubs: 0,
          averageScore: 0,
          oldestItemDate: fetchedAt,
          newestItemDate: fetchedAt,
        },
        totalPosts: 0,
        totalComments: 0,
        subreddits: [],
        fetchedAt,
      };
    }
  }

  /**
   * Sanitize and compact text content
   *
   * This method reduces token usage for AI analysis by:
   * - Removing excessive whitespace (multiple spaces, newlines)
   * - Removing markdown formatting (**, __, ~~, etc.)
   * - Replacing URLs with [URL]
   * - Truncating to maxLength if longer
   *
   * @param text - Text to sanitize
   * @param maxLength - Maximum length before truncation (default: 300)
   * @returns Sanitized and compacted text
   * @private
   */
  private sanitizeAndCompactText(text: string, maxLength: number = 300): string {
    if (!text || text.trim() === '') return '';

    // Remove excessive whitespace (collapse multiple spaces/newlines to single space)
    let sanitized = text.replace(/\s+/g, ' ').trim();

    // Remove markdown bold/italic/strikethrough/code formatting
    sanitized = sanitized.replace(/[*_~`]/g, '');

    // Replace URLs with [URL] placeholder
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '[URL]');

    // Truncate if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
  }

  /**
   * Fetch user post history from Reddit API
   *
   * This method:
   * 1. Uses rate limiter to prevent hitting API limits
   * 2. Fetches up to historyLimit items (200) via Reddit API
   * 3. Separates posts and comments, taking up to 100 of each
   * 4. Applies sanitization to reduce token usage for AI analysis
   * 5. Returns combined array of sanitized PostHistoryItem objects
   *
   * The Reddit API returns an async iterator, so we need to iterate it
   * and collect items until we reach the limits or run out of items.
   *
   * Sanitization strategy:
   * - Post titles: kept as-is (already short)
   * - Post bodies: truncated to 500 characters
   * - Comment bodies: truncated to 300 characters
   * - URLs replaced with [URL]
   * - Markdown formatting removed
   *
   * @param username - Reddit username
   * @returns Array of sanitized post history items (empty on error)
   * @private
   */
  private async fetchFromReddit(username: string): Promise<PostHistoryItem[]> {
    try {
      const posts: PostHistoryItem[] = [];
      const comments: PostHistoryItem[] = [];

      // Fetch user posts and comments with rate limiting
      const iterator = await this.rateLimiter.withRetry(async () => {
        return await this.reddit.getCommentsAndPostsByUser({
          username,
          limit: this.historyLimit,
          sort: 'new',
        });
      });

      // Iterate the async iterator and separate posts/comments
      for await (const item of iterator) {
        // Stop if we have 100 posts AND 100 comments
        if (posts.length >= 100 && comments.length >= 100) {
          break;
        }

        // Type guard: Posts have 'title' property, Comments don't
        const isComment = 'body' in item && !('title' in item);

        if (isComment && comments.length < 100) {
          // It's a Comment
          const comment = item as Comment;
          const sanitizedBody = this.sanitizeAndCompactText(comment.body || '', 300);

          comments.push({
            id: comment.id,
            type: 'comment',
            subreddit: comment.subredditName,
            content: sanitizedBody,
            score: comment.score,
            createdAt: comment.createdAt,
          });
        } else if (!isComment && posts.length < 100) {
          // It's a Post
          const post = item as Post;
          const sanitizedBody = this.sanitizeAndCompactText(post.body || '', 500);
          // Combine title (kept as-is) with sanitized body
          const content = post.title + (sanitizedBody ? ' | ' + sanitizedBody : '');

          posts.push({
            id: post.id,
            type: 'post',
            subreddit: post.subredditName,
            content: content,
            score: post.score,
            createdAt: post.createdAt,
          });
        }
      }

      // Combine posts and comments, then sort by date (newest first)
      const items = [...posts, ...comments].sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      // ===== DATA ACCESS SCOPE VERIFICATION =====
      console.log(`[HistoryAnalyzer] ===== DATA ACCESS SCOPE VERIFICATION =====`);
      console.log(`[HistoryAnalyzer] User: ${username}`);
      console.log(`[HistoryAnalyzer] Total items fetched: ${posts.length + comments.length}`);
      console.log(`[HistoryAnalyzer] Posts: ${posts.length}, Comments: ${comments.length}`);

      // Calculate subreddit diversity
      const allItems = [...posts, ...comments];
      const subreddits = new Set(allItems.map(item => item.subreddit));
      console.log(`[HistoryAnalyzer] Unique subreddits: ${subreddits.size}`);

      if (subreddits.size > 0) {
        console.log(`[HistoryAnalyzer] Subreddits found: ${Array.from(subreddits).slice(0, 10).join(', ')}${subreddits.size > 10 ? '...' : ''}`);

        if (subreddits.size === 1) {
          console.warn(`[HistoryAnalyzer] ⚠️ WARNING: Only 1 subreddit found - data may be scoped to installed subreddit only!`);
        } else {
          console.log(`[HistoryAnalyzer] ✅ VERIFIED: Site-wide access working (${subreddits.size} different subreddits)`);
        }
      }

      if (allItems.length === 0) {
        console.warn(`[HistoryAnalyzer] ⚠️ No items fetched - possible private profile or no activity`);
      }

      console.log(`[HistoryAnalyzer] =========================================`);

      return items;
    } catch (error) {
      // Check if this is a "private profile" or "forbidden" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isPrivateProfile =
        errorMessage.toLowerCase().includes('private') ||
        errorMessage.toLowerCase().includes('forbidden') ||
        errorMessage.toLowerCase().includes('403');

      if (isPrivateProfile) {
        console.warn(`[HistoryAnalyzer] User ${username} has a private/hidden profile - cannot access history`);
      } else {
        console.error(`[HistoryAnalyzer] API error fetching history for ${username}:`, error);
      }

      return []; // Return empty array on error
    }
  }

  /**
   * Calculate metrics from post history items
   *
   * This method analyzes the post history and calculates:
   * - Total number of items
   * - Number of posts in target subreddits (case-insensitive)
   * - Number of posts in dating subreddits (case-insensitive)
   * - Average score across all items
   * - Date range of post history
   *
   * @param items - Array of post history items
   * @param fetchedAt - Timestamp when history was fetched (fallback for empty history)
   * @returns Calculated metrics
   * @private
   */
  private calculateMetrics(
    items: PostHistoryItem[],
    fetchedAt: Date
  ): UserPostHistory['metrics'] {
    // Handle empty history
    if (items.length === 0) {
      return {
        totalItems: 0,
        postsInTargetSubs: 0,
        postsInDatingSubs: 0,
        averageScore: 0,
        oldestItemDate: fetchedAt,
        newestItemDate: fetchedAt,
      };
    }

    // Count posts in target subreddits
    const postsInTargetSubs = items.filter(item =>
      this.targetSubreddits.has(item.subreddit.toLowerCase())
    ).length;

    // Count posts in dating subreddits
    const postsInDatingSubs = items.filter(item =>
      this.datingSubreddits.has(item.subreddit.toLowerCase())
    ).length;

    // Calculate average score
    const totalScore = items.reduce((sum, item) => sum + item.score, 0);
    const averageScore = items.length > 0 ? totalScore / items.length : 0;

    // Find oldest and newest items
    // Items are already sorted by creation date (newest first)
    const newestItemDate = items[0].createdAt;
    const oldestItemDate = items[items.length - 1].createdAt;

    return {
      totalItems: items.length,
      postsInTargetSubs,
      postsInDatingSubs,
      averageScore,
      oldestItemDate,
      newestItemDate,
    };
  }

  /**
   * Cache user post history in Redis
   *
   * Stores the post history data with a 24-hour TTL. Date objects are
   * serialized as ISO strings by JSON.stringify and need to be deserialized
   * on retrieval.
   *
   * @param history - User post history data to cache
   * @private
   */
  private async cacheHistory(history: UserPostHistory): Promise<void> {
    try {
      // Key format: user:{userId}:history
      const cacheKey = this.storage.buildKey(StorageKey.USER_HISTORY, history.userId, 'history');
      await this.storage.set(cacheKey, history, this.cacheTTL);
    } catch (error) {
      console.error(`[HistoryAnalyzer] Error caching history for ${history.userId}:`, error);
      // Non-fatal error, don't throw - cache failure shouldn't break the request
    }
  }
}
