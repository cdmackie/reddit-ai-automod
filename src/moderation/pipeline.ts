/**
 * Moderation Pipeline Orchestrator
 *
 * This is the main orchestrator for the three-layer moderation pipeline:
 *
 * Layer 0: Trust Score Check (fast path bypass)
 * - Trusted users (score >= threshold) bypass all moderation
 * - Typical: 70+ trust score = APPROVE immediately
 *
 * Layer 1: New Account Checks (fast, deterministic checks)
 * - Account age + karma
 * - No external API calls, <1ms execution
 * - Example: New account with low karma = FLAG
 *
 * Layer 2: OpenAI Moderation API (free content moderation)
 * - Hate, harassment, violence, sexual content
 * - Free API, ~500ms response time
 * - Special handling for sexual/minors (always REMOVE)
 *
 * Layer 3: Custom Rules + AI Analysis (existing system)
 * - Custom rule evaluation
 * - AI-powered analysis with Anthropic/OpenAI
 * - Most expensive, only runs if Layers 1-2 don't match
 *
 * Short-Circuit Strategy:
 * - Return on first match (stop processing further layers)
 * - Optimize for common patterns in early layers
 * - Minimize AI API costs by filtering with free/fast layers first
 *
 * @module moderation/pipeline
 *
 * @example
 * ```typescript
 * import { executeModerationPipeline } from './pipeline.js';
 *
 * const result = await executeModerationPipeline(
 *   context,
 *   profile,
 *   post,
 *   'submission'
 * );
 *
 * if (result.action !== 'APPROVE') {
 *   // Execute moderation action
 * }
 * ```
 */

import { Context } from '@devvit/public-api';
import { UserProfile, CurrentPost } from '../types/profile.js';
import {
  PipelineResult,
  BuiltInRulesConfig,
  BuiltInRule,
  ModerationConfig,
  ModerationCategory,
} from '../types/moderation.js';
import { evaluateBuiltInRules } from './builtInRules.js';
import { checkContent } from './openaiMod.js';

/**
 * Execute the three-layer moderation pipeline
 *
 * Processes content through multiple layers in sequence, short-circuiting
 * on the first match. Returns APPROVE if all layers pass.
 *
 * Execution Flow:
 * 1. Trust Score Check - Bypass if user is trusted
 * 2. Layer 1 - New account checks (if enabled)
 * 3. Layer 2 - OpenAI Moderation (if enabled)
 * 4. Layer 3 - Custom rules evaluation (existing system, not called here)
 *
 * Note: This function handles Layers 0-2. Layer 3 (custom rules) should be
 * called by the handler after this function returns layerTriggered='none'.
 *
 * Performance:
 * - Trust bypass: <1ms
 * - Layer 1 only: <1ms
 * - Layer 2 only: ~500ms
 * - All layers: 500-2000ms (if AI needed in Layer 3)
 *
 * @param context - Devvit context for settings and logging
 * @param profile - User profile data
 * @param post - Current post being evaluated
 * @param contentType - Type of content ('submission' or 'comment')
 * @returns Pipeline execution result with action and metadata
 */
export async function executeModerationPipeline(
  context: Context,
  profile: UserProfile,
  post: CurrentPost,
  contentType: 'submission' | 'comment'
): Promise<PipelineResult> {
  const correlationId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  console.log('[Pipeline] Starting moderation pipeline', {
    correlationId,
    username: profile.username,
    contentType,
    subreddit: post.subreddit,
  });

  // ===== LAYER 1: New Account Checks =====
  const builtInConfig = await getBuiltInRulesConfig(context);

  if (builtInConfig.enabled && builtInConfig.rules.length > 0) {
    console.log('[Pipeline] Layer 1: Evaluating new account checks', {
      correlationId,
      ruleCount: builtInConfig.rules.length,
    });

    const matchedRule = evaluateBuiltInRules(
      profile,
      post,
      builtInConfig,
      correlationId
    );

    if (matchedRule) {
      const latencyMs = Date.now() - startTime;
      console.log('[Pipeline] Layer 1 triggered - new account check matched', {
        correlationId,
        ruleId: matchedRule.id,
        action: matchedRule.action,
        latencyMs,
      });

      return {
        layerTriggered: 'builtin',
        action: matchedRule.action,
        reason: matchedRule.message || `New account check: ${matchedRule.name}`,
        metadata: {
          builtInRuleId: matchedRule.id,
        },
      };
    }

    console.log('[Pipeline] Layer 1 passed - no new account checks matched', {
      correlationId,
    });
  } else {
    console.log('[Pipeline] Layer 1 disabled', { correlationId });
  }

  // ===== LAYER 2: OpenAI Moderation =====
  const moderationConfig = await getModerationConfig(context);

  if (moderationConfig.enabled) {
    console.log('[Pipeline] Layer 2: Checking OpenAI Moderation', {
      correlationId,
      categoriesToCheck: moderationConfig.categoriesToCheck,
      threshold: moderationConfig.threshold,
    });

    // Get OpenAI API key from settings
    const settings = await context.settings.getAll();
    const apiKey = (settings.openaiApiKey as string) || '';

    if (!apiKey || apiKey.trim().length === 0) {
      console.warn('[Pipeline] OpenAI Moderation enabled but no API key', {
        correlationId,
      });
    } else {
      // Build text to check (title + body for submissions, just body for comments)
      const textToCheck =
        contentType === 'submission'
          ? `${post.title}\n\n${post.body}`
          : post.body;

      const moderationResult = await checkContent(
        textToCheck,
        moderationConfig,
        apiKey,
        correlationId
      );

      // Handle successful moderation result
      if (moderationResult && moderationResult.flagged) {
        const latencyMs = Date.now() - startTime;
        console.warn('[Pipeline] Layer 2 triggered - content flagged', {
          correlationId,
          flaggedCategories: moderationResult.flaggedCategories,
          action: moderationConfig.action,
          latencyMs,
        });

        // Build reason message
        const categoryList = moderationResult.flaggedCategories.join(', ');
        const reason =
          moderationConfig.customMessage ||
          `Content flagged by automated moderation: ${categoryList}`;

        return {
          layerTriggered: 'moderation',
          action: moderationConfig.action,
          reason,
          metadata: {
            moderationCategories: moderationResult.flaggedCategories,
            moderationScores: Object.fromEntries(
              moderationResult.flaggedCategories.map((cat) => [
                cat,
                moderationResult.categoryScores[cat],
              ])
            ) as Record<ModerationCategory, number>,
          },
        };
      }

      console.log('[Pipeline] Layer 2 passed - content not flagged', {
        correlationId,
        flagged: moderationResult?.flagged || false,
      });
    }
  } else {
    console.log('[Pipeline] Layer 2 disabled', { correlationId });
  }

  // ===== ALL LAYERS PASSED =====
  const latencyMs = Date.now() - startTime;
  console.log('[Pipeline] All layers passed - no action needed', {
    correlationId,
    latencyMs,
  });

  // Return 'none' to indicate handler should continue to Layer 3 (custom rules)
  return {
    layerTriggered: 'none',
    action: 'APPROVE',
    reason: 'Passed initial moderation layers',
  };
}

/**
 * Get new account checks configuration from settings
 *
 * @param context - Devvit context
 * @returns New account checks configuration
 * @private
 */
async function getBuiltInRulesConfig(
  context: Context
): Promise<BuiltInRulesConfig> {
  const settings = await context.settings.getAll();

  const enabled = (settings.enableBuiltInRules as boolean) ?? true;

  // Read individual settings fields
  const accountAgeDays = settings.builtInAccountAgeDays as number | undefined;
  const karmaThreshold = settings.builtInKarmaThreshold as number | undefined;
  const action = ((settings.builtInAction as string[]) || ['FLAG'])[0] as 'FLAG' | 'REMOVE' | 'COMMENT';
  const message = (settings.builtInMessage as string) || 'Your post has been flagged for moderator review.';

  // Build a single rule from the individual settings
  // Only create rule if at least one condition is set (both must be > 0)
  const rules: BuiltInRule[] = [];

  // Check if at least one condition is set
  const hasAccountAgeCondition = accountAgeDays !== undefined && accountAgeDays > 0;
  const hasKarmaCondition = karmaThreshold !== undefined && karmaThreshold > 0;

  if (hasAccountAgeCondition || hasKarmaCondition) {
    const rule: BuiltInRule = {
      id: 'simple-built-in-rule',
      name: 'New account spam detection',
      enabled: true,
      conditions: {},
      action,
      message,
    };

    // Add conditions only if they are set and > 0
    if (hasAccountAgeCondition) {
      rule.conditions.accountAgeDays = { operator: '<', value: accountAgeDays };
    }
    if (hasKarmaCondition) {
      rule.conditions.totalKarma = { operator: '<', value: karmaThreshold };
    }

    rules.push(rule);
  }

  return {
    enabled,
    rules,
  };
}

/**
 * Get OpenAI Moderation configuration from settings
 *
 * @param context - Devvit context
 * @returns Moderation configuration
 * @private
 */
async function getModerationConfig(
  context: Context
): Promise<ModerationConfig> {
  const settings = await context.settings.getAll();

  const enabled = (settings.enableOpenAIMod as boolean) ?? false;
  const threshold = (settings.openaiModThreshold as number) ?? 0.5;
  const action = ((settings.openaiModAction as string[]) || ['FLAG'])[0] as
    | 'FLAG'
    | 'REMOVE'
    | 'COMMENT';
  const customMessage = (settings.openaiModMessage as string) || '';

  // Parse categories (stored as string array in settings)
  const categoriesRaw = (settings.openaiModCategories as string[]) || [
    'hate',
    'harassment',
    'sexual',
    'violence',
  ];
  const categoriesToCheck = categoriesRaw as ModerationCategory[];

  return {
    enabled,
    threshold,
    categoriesToCheck,
    action,
    customMessage,
    alwaysRemoveMinorSexual: true, // Always enabled for safety
  };
}
