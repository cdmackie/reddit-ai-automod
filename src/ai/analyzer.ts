/**
 * AI Analyzer - Main orchestrator for user profile analysis
 *
 * This is the central orchestrator that coordinates all AI system components
 * to analyze Reddit users and return risk assessments. It integrates:
 *
 * - **Provider Selector**: Chooses healthy AI provider with automatic failover
 * - **Request Coalescer**: Prevents duplicate analysis requests for same user
 * - **Cost Tracker**: Enforces budget limits and tracks spending
 * - **Prompt Manager**: Builds analysis prompts with A/B testing support
 * - **Caching**: Differential TTL based on trust scores for cost optimization
 *
 * ## Analysis Flow
 *
 * ```
 * 1. Check cache (differential TTL based on trust score)
 *    ├─ Cache hit → Return cached result (save cost)
 *    └─ Cache miss → Continue
 *
 * 2. Check budget (prevent runaway costs)
 *    ├─ Budget exceeded → Return null (caller flags for review)
 *    └─ Budget OK → Continue
 *
 * 3. Request deduplication (prevent concurrent duplicate analyses)
 *    ├─ Lock acquired → Perform analysis
 *    └─ Lock held → Wait for existing analysis result
 *
 * 4. Select AI provider (with circuit breaker and health checks)
 *    ├─ No healthy provider → Return null
 *    └─ Provider found → Continue
 *
 * 5. Perform analysis
 *    ├─ Build prompt with user data
 *    ├─ Call AI provider
 *    ├─ Validate response
 *    └─ Return result
 *
 * 6. Record cost and cache result
 *    ├─ Track spending per provider
 *    └─ Cache with differential TTL
 * ```
 *
 * ## Differential Caching Strategy
 *
 * Cache TTL varies based on user trust score and risk level:
 * - **High trust (60-69)**: 48 hours - stable users, rare re-analysis needed
 * - **Medium trust (40-59)**: 24 hours - moderate stability
 * - **Low trust (<40)**: 12 hours - frequent monitoring needed
 * - **Known bad actors**: 7 days - well-established behavior
 *
 * This reduces costs by analyzing trusted users less frequently while
 * maintaining vigilance on suspicious accounts.
 *
 * ## Error Handling
 *
 * Returns `null` on any error (budget exceeded, all providers down, etc.).
 * Caller is responsible for deciding action (FLAG for manual review, etc.).
 *
 * This keeps error handling logic in the moderation layer where it belongs.
 *
 * @module ai/analyzer
 *
 * @example
 * ```typescript
 * const analyzer = AIAnalyzer.getInstance(context);
 *
 * // Analyze user
 * const result = await analyzer.analyzeUser(
 *   userId,
 *   profile,
 *   postHistory,
 *   currentPost,
 *   subreddit
 * );
 *
 * if (result === null) {
 *   // Budget exceeded or all providers down
 *   console.error('AI analysis failed - flagging for manual review');
 *   // Take appropriate action
 * } else {
 *   console.log('Risk:', result.overallRisk);
 *   console.log('Action:', result.recommendedAction);
 * }
 *
 * // Clear cache if user behavior changes
 * await analyzer.clearCache(userId);
 * ```
 */

import { Devvit } from '@devvit/public-api';
import { v4 as uuidv4 } from 'uuid';
import { AIAnalysisRequest, AIAnalysisResult } from '../types/ai.js';
import { UserProfile, UserPostHistory } from '../types/profile.js';
import { ProviderSelector } from './selector.js';
import { RequestCoalescer } from './requestCoalescer.js';
import { CostTracker } from './costTracker.js';
import { getCacheTTLForTrustScore } from '../config/ai.js';

/**
 * Current post data for analysis context
 */
interface CurrentPost {
  /** Post title */
  title: string;
  /** Post body text */
  body: string;
  /** Subreddit where post was submitted */
  subreddit: string;
}

/**
 * AIAnalyzer - Main orchestrator for AI-powered user analysis
 *
 * Singleton class that coordinates all AI components to analyze Reddit users
 * and return risk assessments. Handles caching, budget enforcement, request
 * deduplication, provider selection, and cost tracking.
 *
 * Key Features:
 * - **Intelligent Caching**: Differential TTL based on trust scores
 * - **Budget Enforcement**: Hard limits prevent runaway costs
 * - **Request Deduplication**: Prevents concurrent duplicate analyses
 * - **Automatic Failover**: Switches between providers if one fails
 * - **Cost Tracking**: Per-provider spending reports
 * - **Graceful Degradation**: Returns null on failure (caller decides action)
 */
export class AIAnalyzer {
  /**
   * Private constructor - use getInstance() instead
   * @param context - Devvit context for Redis and Secrets Manager access
   */
  private constructor(private context: Devvit.Context) {}

  /**
   * Singleton instances keyed by Devvit context
   * Ensures one AIAnalyzer per context
   */
  private static instances = new Map<any, AIAnalyzer>();

  /**
   * Get or create AIAnalyzer instance for this context
   *
   * Uses singleton pattern to ensure consistent state within a context.
   * Each Devvit context gets its own AIAnalyzer instance.
   *
   * @param context - Devvit context containing Redis and Secrets Manager
   * @returns AIAnalyzer instance for this context
   *
   * @example
   * ```typescript
   * const analyzer = AIAnalyzer.getInstance(context);
   * ```
   */
  static getInstance(context: Devvit.Context): AIAnalyzer {
    if (!this.instances.has(context)) {
      this.instances.set(context, new AIAnalyzer(context));
    }
    return this.instances.get(context)!;
  }

  /**
   * Analyze user and return risk assessment
   *
   * Main entry point for AI analysis. Coordinates all components to:
   * 1. Check cache for existing analysis
   * 2. Check budget before spending
   * 3. Deduplicate concurrent requests
   * 4. Select healthy AI provider
   * 5. Perform analysis
   * 6. Record cost and cache result
   *
   * **Cache Strategy**: Uses differential TTL based on trust score
   * - High trust users: Longer cache (48h)
   * - Low trust users: Shorter cache (12h)
   * - Known bad actors: Very long cache (7d)
   *
   * **Error Handling**: Returns null on any error (budget exceeded, all
   * providers down, etc.). Caller decides action (FLAG for review, etc.).
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @param profile - User profile from Phase 1 profiling system
   * @param postHistory - User post history from Phase 1 profiling system
   * @param currentPost - The post that triggered this analysis
   * @param subreddit - Name of subreddit where post was submitted
   * @param trustScore - Optional trust score (0-100) for differential caching
   * @returns Analysis result with risk assessment, or null on error
   *
   * @example
   * ```typescript
   * const result = await analyzer.analyzeUser(
   *   't2_abc123',
   *   userProfile,
   *   postHistory,
   *   { title: 'Hi everyone!', body: 'Looking for friends', subreddit: 'FriendsOver40' },
   *   'FriendsOver40',
   *   65 // Optional trust score
   * );
   *
   * if (result === null) {
   *   console.error('Analysis failed - flagging for manual review');
   * } else {
   *   console.log('Risk:', result.overallRisk);
   *   console.log('Recommended action:', result.recommendedAction);
   * }
   * ```
   */
  async analyzeUser(
    userId: string,
    profile: UserProfile,
    postHistory: UserPostHistory,
    currentPost: CurrentPost,
    subreddit: string,
    trustScore?: number
  ): Promise<AIAnalysisResult | null> {
    const correlationId = uuidv4();

    console.log('[AIAnalyzer] Starting analysis', {
      userId,
      correlationId,
      subreddit,
      trustScore: trustScore || 'unknown',
    });

    // 1. Check cache for existing analysis
    const cached = await this.getCachedAnalysis(userId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      console.log('[AIAnalyzer] Cache hit', {
        userId,
        correlationId,
        ageSeconds: Math.round(age / 1000),
        risk: cached.overallRisk,
      });
      return cached;
    }

    console.log('[AIAnalyzer] Cache miss - analysis required', { userId, correlationId });

    // 2. Check budget before spending
    const costTracker = CostTracker.getInstance(this.context);
    const estimatedCost = 0.08; // ~$0.08 per analysis (conservative estimate)

    if (!(await costTracker.canAfford(estimatedCost))) {
      console.error('[AIAnalyzer] Budget exceeded - cannot analyze', {
        userId,
        correlationId,
        estimatedCost,
      });
      return null; // Caller will flag for manual review
    }

    console.log('[AIAnalyzer] Budget OK - proceeding with analysis', {
      userId,
      correlationId,
      estimatedCost,
    });

    // 3. Request deduplication - prevent concurrent duplicate analyses
    const coalescer = RequestCoalescer.getInstance(this.context);

    if (!(await coalescer.acquireLock(userId, correlationId))) {
      console.log('[AIAnalyzer] Request coalesced - waiting for existing analysis', {
        userId,
        correlationId,
      });

      // Another request is already analyzing this user - wait for result
      const result = await coalescer.waitForResult(userId);

      if (result) {
        console.log('[AIAnalyzer] Received coalesced result', {
          userId,
          correlationId,
          risk: result.overallRisk,
        });
      } else {
        console.warn('[AIAnalyzer] Coalesced result not found', { userId, correlationId });
      }

      return result;
    }

    console.log('[AIAnalyzer] Lock acquired - performing analysis', { userId, correlationId });

    try {
      // 4. Build analysis request
      const request: AIAnalysisRequest = {
        userId,
        username: profile.username,
        profile,
        postHistory,
        currentPost: {
          title: currentPost.title,
          body: currentPost.body,
          subreddit: currentPost.subreddit,
        },
        context: {
          subredditName: subreddit,
          subredditType: this.getSubredditType(subreddit),
          correlationId,
          promptVersion: 'v1.0', // Will be set by promptManager
        },
      };

      // 5. Perform analysis
      const result = await this.performAnalysis(request, trustScore || 50);

      // 6. Cache result with differential TTL
      const isKnownBad = result.overallRisk === 'HIGH' || result.overallRisk === 'CRITICAL';
      const cacheTTL = getCacheTTLForTrustScore(trustScore || 50, isKnownBad);

      await this.cacheResult(userId, result, cacheTTL);

      console.log('[AIAnalyzer] Analysis complete', {
        userId,
        correlationId,
        risk: result.overallRisk,
        action: result.recommendedAction,
        costUSD: result.costUSD.toFixed(4),
        cacheTTL,
      });

      return result;
    } catch (error) {
      console.error('[AIAnalyzer] Analysis failed', {
        userId,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error && 'type' in error ? error.type : 'UNKNOWN',
      });
      return null; // Caller will flag for manual review
    } finally {
      // Always release lock, even on error
      await coalescer.releaseLock(userId);
      console.log('[AIAnalyzer] Lock released', { userId, correlationId });
    }
  }

  /**
   * Perform AI analysis by selecting provider and calling it
   *
   * Internal method that:
   * 1. Selects best available AI provider (with health checks and circuit breakers)
   * 2. Calls provider to analyze user
   * 3. Records cost in cost tracker
   * 4. Returns result with metadata
   *
   * Throws error if no provider is available or analysis fails.
   *
   * @param request - Complete analysis request data
   * @param trustScore - User trust score (0-100) for differential caching
   * @returns Analysis result with risk assessment
   * @throws {Error} If no provider available or analysis fails
   * @private
   */
  private async performAnalysis(
    request: AIAnalysisRequest,
    trustScore: number
  ): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    // Select best available AI provider
    const selector = ProviderSelector.getInstance(this.context);
    const provider = await selector.selectProvider();

    if (provider === null) {
      console.error('[AIAnalyzer] No AI provider available', {
        correlationId: request.context.correlationId,
      });
      throw new Error('No AI provider available');
    }

    console.log('[AIAnalyzer] Provider selected', {
      provider: provider.type,
      model: provider.model,
      correlationId: request.context.correlationId,
    });

    // Call provider to analyze user
    const result = await provider.analyze(request);

    // Record cost for budget tracking
    const costTracker = CostTracker.getInstance(this.context);
    await costTracker.recordCost({
      id: request.context.correlationId,
      timestamp: Date.now(),
      provider: provider.type,
      userId: request.userId,
      tokensUsed: result.tokensUsed,
      costUSD: result.costUSD,
      cached: false, // This is a fresh analysis, not cached
    });

    console.log('[AIAnalyzer] Cost recorded', {
      correlationId: request.context.correlationId,
      provider: provider.type,
      tokensUsed: result.tokensUsed,
      costUSD: result.costUSD.toFixed(4),
    });

    // Add metadata to result
    result.correlationId = request.context.correlationId;
    result.latencyMs = Date.now() - startTime;

    // Calculate cache TTL based on trust score and risk
    const isKnownBad = result.overallRisk === 'HIGH' || result.overallRisk === 'CRITICAL';
    result.cacheTTL = getCacheTTLForTrustScore(trustScore, isKnownBad);

    return result;
  }

  /**
   * Get cached analysis result if available
   *
   * Checks Redis cache for existing analysis result for this user.
   * Cache uses differential TTL based on trust scores:
   * - High trust: 48h
   * - Medium trust: 24h
   * - Low trust: 12h
   * - Known bad: 7d
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @returns Cached analysis result, or null if not in cache
   *
   * @example
   * ```typescript
   * const cached = await analyzer.getCachedAnalysis('t2_abc123');
   * if (cached) {
   *   console.log('Using cached result:', cached.overallRisk);
   * }
   * ```
   */
  async getCachedAnalysis(userId: string): Promise<AIAnalysisResult | null> {
    const key = `ai:analysis:${userId}`;

    try {
      const cached = await this.context.redis.get(key);

      if (!cached) {
        return null;
      }

      const result = JSON.parse(cached) as AIAnalysisResult;

      // Validate that cached result has required fields
      if (!result.userId || !result.overallRisk || !result.recommendedAction) {
        console.warn('[AIAnalyzer] Invalid cached data - clearing', { userId });
        await this.clearCache(userId);
        return null;
      }

      return result;
    } catch (error) {
      console.error('[AIAnalyzer] Failed to parse cached analysis', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Clear bad cache to prevent repeated errors
      await this.clearCache(userId);
      return null;
    }
  }

  /**
   * Cache analysis result with differential TTL
   *
   * Stores analysis result in Redis with TTL based on trust score and risk level.
   * Higher trust users get longer cache times to reduce analysis costs.
   *
   * Cache key: `ai:analysis:{userId}`
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @param result - Analysis result to cache
   * @param cacheTTL - Time to live in seconds
   *
   * @example
   * ```typescript
   * await analyzer.cacheResult(userId, result, 86400); // Cache for 24 hours
   * ```
   * @private
   */
  private async cacheResult(
    userId: string,
    result: AIAnalysisResult,
    cacheTTL: number
  ): Promise<void> {
    const key = `ai:analysis:${userId}`;

    try {
      // Convert TTL (seconds) to Date object
      const expirationDate = new Date(Date.now() + cacheTTL * 1000);
      await this.context.redis.set(key, JSON.stringify(result), { expiration: expirationDate });

      console.log('[AIAnalyzer] Result cached', {
        userId,
        ttlSeconds: cacheTTL,
        ttlHours: Math.round(cacheTTL / 3600),
        risk: result.overallRisk,
      });
    } catch (error) {
      console.error('[AIAnalyzer] Failed to cache result', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - caching failure shouldn't break analysis
    }
  }

  /**
   * Clear cached analysis for a user
   *
   * Use this when user behavior changes significantly (e.g., moderator action,
   * new suspicious activity, etc.) to force fresh analysis on next request.
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   *
   * @example
   * ```typescript
   * // Clear cache after moderator approves user
   * await analyzer.clearCache(userId);
   *
   * // Next analysis will be fresh, not cached
   * const result = await analyzer.analyzeUser(...);
   * ```
   */
  async clearCache(userId: string): Promise<void> {
    const key = `ai:analysis:${userId}`;

    try {
      await this.context.redis.del(key);
      console.log('[AIAnalyzer] Cache cleared', { userId });
    } catch (error) {
      console.error('[AIAnalyzer] Failed to clear cache', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache clear failure is not critical
    }
  }

  /**
   * Get subreddit type for specialized analysis
   *
   * Maps subreddit name to type for context-specific analysis rules.
   * Different subreddit types have different detection patterns.
   *
   * @param subreddit - Subreddit name (case-insensitive)
   * @returns Subreddit type for analysis context
   *
   * @example
   * ```typescript
   * getSubredditType('FriendsOver40') // Returns 'FriendsOver40'
   * getSubredditType('RandomSub')     // Returns 'other'
   * ```
   * @private
   */
  private getSubredditType(
    subreddit: string
  ): 'FriendsOver40' | 'FriendsOver50' | 'bitcointaxes' | 'other' {
    const lower = subreddit.toLowerCase();

    if (lower === 'friendsover40') return 'FriendsOver40';
    if (lower === 'friendsover50') return 'FriendsOver50';
    if (lower === 'bitcointaxes') return 'bitcointaxes';

    return 'other';
  }
}
