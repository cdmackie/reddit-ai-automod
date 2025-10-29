/**
 * OpenAI Moderation API Module (Layer 2)
 *
 * This module provides integration with OpenAI's free Moderation API for
 * detecting harmful content across multiple categories:
 * - Hate speech
 * - Harassment
 * - Self-harm content
 * - Sexual content (including minors)
 * - Violence
 *
 * Key Features:
 * - FREE API with no usage costs
 * - Fast response times (typically <500ms)
 * - Model: omni-moderation-latest (most accurate)
 * - Configurable thresholds and categories
 * - Special handling for sexual/minors (always REMOVE)
 * - Graceful error handling with fallthrough
 *
 * @module moderation/openaiMod
 *
 * @example
 * ```typescript
 * import { checkContent } from './openaiMod.js';
 *
 * const result = await checkContent(
 *   "Post content to check",
 *   config,
 *   correlationId
 * );
 *
 * if (result.flagged) {
 *   console.log('Flagged categories:', result.flaggedCategories);
 * }
 * ```
 */

import OpenAI from 'openai';
import {
  ModerationCategory,
  ModerationResult,
  ModerationConfig,
} from '../types/moderation.js';

/**
 * Check content using OpenAI Moderation API
 *
 * Analyzes text content for harmful material across multiple categories.
 * Applies configured thresholds and category filters. Special handling
 * for sexual/minors category (always REMOVE regardless of threshold).
 *
 * Error Handling:
 * - Network errors: Log and return null (graceful degradation)
 * - API errors: Log and return null (don't block moderation pipeline)
 * - Timeout: 10 second timeout, log and return null
 *
 * @param text - Content to analyze (post title + body or comment text)
 * @param config - Moderation configuration from settings
 * @param apiKey - OpenAI API key from settings
 * @param correlationId - Correlation ID for logging
 * @returns Moderation result, or null if API fails
 */
export async function checkContent(
  text: string,
  config: ModerationConfig,
  apiKey: string,
  correlationId: string
): Promise<ModerationResult | null> {
  const startTime = Date.now();

  console.log('[OpenAIMod] Checking content', {
    correlationId,
    textLength: text.length,
    threshold: config.threshold,
    categoriesToCheck: config.categoriesToCheck,
  });

  // Validate API key
  if (!apiKey || apiKey.trim().length === 0) {
    console.error('[OpenAIMod] No API key provided', { correlationId });
    return null;
  }

  // Create OpenAI client
  const client = new OpenAI({ apiKey });

  try {
    // Create timeout promise (10 seconds)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('OpenAI Moderation API timeout (10s)')),
        10000
      )
    );

    // Call OpenAI Moderation API with latest model
    const apiPromise = client.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });

    // Race timeout vs API call
    const response = await Promise.race([apiPromise, timeoutPromise]);

    // Extract result (API returns array, we only sent one input)
    const result = response.results[0];
    if (!result) {
      console.error('[OpenAIMod] Empty response from API', { correlationId });
      return null;
    }

    // Build category results map
    const categories: Record<ModerationCategory, boolean> = {
      hate: result.categories.hate || false,
      'hate/threatening': result.categories['hate/threatening'] || false,
      harassment: result.categories.harassment || false,
      'harassment/threatening':
        result.categories['harassment/threatening'] || false,
      'self-harm': result.categories['self-harm'] || false,
      'self-harm/intent': result.categories['self-harm/intent'] || false,
      'self-harm/instructions':
        result.categories['self-harm/instructions'] || false,
      sexual: result.categories.sexual || false,
      'sexual/minors': result.categories['sexual/minors'] || false,
      violence: result.categories.violence || false,
      'violence/graphic': result.categories['violence/graphic'] || false,
    };

    const categoryScores: Record<ModerationCategory, number> = {
      hate: result.category_scores.hate || 0,
      'hate/threatening': result.category_scores['hate/threatening'] || 0,
      harassment: result.category_scores.harassment || 0,
      'harassment/threatening':
        result.category_scores['harassment/threatening'] || 0,
      'self-harm': result.category_scores['self-harm'] || 0,
      'self-harm/intent': result.category_scores['self-harm/intent'] || 0,
      'self-harm/instructions':
        result.category_scores['self-harm/instructions'] || 0,
      sexual: result.category_scores.sexual || 0,
      'sexual/minors': result.category_scores['sexual/minors'] || 0,
      violence: result.category_scores.violence || 0,
      'violence/graphic': result.category_scores['violence/graphic'] || 0,
    };

    // Apply threshold and category filters
    const flaggedCategories: ModerationCategory[] = [];

    for (const category of config.categoriesToCheck) {
      const score = categoryScores[category];

      // Special handling for sexual/minors - always flag if detected
      if (
        category === 'sexual/minors' &&
        config.alwaysRemoveMinorSexual &&
        categories[category]
      ) {
        flaggedCategories.push(category);
        console.warn('[OpenAIMod] CRITICAL: sexual/minors detected', {
          correlationId,
          score,
        });
        continue;
      }

      // Check if score exceeds threshold
      if (score >= config.threshold) {
        flaggedCategories.push(category);
      }
    }

    const flagged = flaggedCategories.length > 0;
    const latencyMs = Date.now() - startTime;

    console.log('[OpenAIMod] Content check complete', {
      correlationId,
      flagged,
      flaggedCategories,
      categoryScores: Object.fromEntries(
        flaggedCategories.map(cat => [cat, categoryScores[cat]])
      ),
      threshold: config.threshold,
      latencyMs,
    });

    return {
      flagged,
      categories,
      categoryScores,
      flaggedCategories,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    console.error('[OpenAIMod] Error checking content', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
    });

    // Graceful degradation - return null to allow pipeline to continue
    return null;
  }
}
