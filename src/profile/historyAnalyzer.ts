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
 * - Last 20 posts and comments (configurable via DEFAULT_PROFILE_CONFIG.historyLimit)
 * - Sorted by creation date (newest first)
 * - Includes content, subreddit, score, and timestamp
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
   * Fetch user post history from Reddit API
   *
   * This method:
   * 1. Uses rate limiter to prevent hitting API limits
   * 2. Fetches up to historyLimit posts/comments via Reddit API
   * 3. Processes each item to extract relevant data
   * 4. Returns array of PostHistoryItem objects
   *
   * The Reddit API returns an async iterator, so we need to iterate it
   * and collect items until we reach the limit or run out of items.
   *
   * @param username - Reddit username
   * @returns Array of post history items (empty on error)
   * @private
   */
  private async fetchFromReddit(username: string): Promise<PostHistoryItem[]> {
    try {
      const items: PostHistoryItem[] = [];

      // Fetch user posts and comments with rate limiting
      const iterator = await this.rateLimiter.withRetry(async () => {
        return await this.reddit.getCommentsAndPostsByUser({
          username,
          limit: this.historyLimit,
          sort: 'new',
        });
      });

      // Iterate the async iterator and collect items
      for await (const item of iterator) {
        // Stop if we've reached the limit
        if (items.length >= this.historyLimit) {
          break;
        }

        // Determine if this is a Post or Comment
        let type: 'post' | 'comment';
        let content: string;
        let subreddit: string;

        // Type guard: Posts have 'title' property, Comments don't
        if ('title' in item) {
          // It's a Post
          type = 'post';
          const post = item as Post;
          content = post.body || post.url || '';
          subreddit = post.subredditName;
        } else {
          // It's a Comment
          type = 'comment';
          const comment = item as Comment;
          content = comment.body || '';
          subreddit = comment.subredditName;
        }

        // Extract common properties
        const historyItem: PostHistoryItem = {
          id: item.id,
          type,
          subreddit,
          content,
          score: item.score,
          createdAt: item.createdAt,
        };

        items.push(historyItem);
      }

      return items;
    } catch (error) {
      console.error(`[HistoryAnalyzer] API error fetching history for ${username}:`, error);
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
