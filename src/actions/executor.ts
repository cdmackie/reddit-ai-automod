/**
 * AI Automod - AI Automod for Reddit
 * Copyright (C) 2025 CoinsTax LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Action Executor - Executes moderation actions on Reddit posts
 *
 * This module handles the actual execution of moderation actions determined by
 * the rules engine. It provides:
 * - Action execution with dry-run mode support
 * - Consistent error handling and logging
 * - Comment posting for user communication
 * - Audit trail integration
 *
 * @module actions/executor
 */

import { TriggerContext, Post } from '@devvit/public-api';
import { RuleEvaluationResult, ActionExecutionResult } from '../types/rules.js';
import { UserProfile } from '../types/profile.js';
import { DEFAULT_REMOVE_TEMPLATE, DEFAULT_COMMENT_TEMPLATE, formatTemplate } from './templates.js';
import { addAutomodNote } from './modNotes.js';
import { AIQuestionBatchResult } from '../types/ai.js';

/**
 * Reddit API limits and constants
 */
const MAX_COMMENT_LENGTH = 10000;
const MAX_REPORT_REASON_LENGTH = 100;

/**
 * Validate and truncate comment text to Reddit's character limit
 *
 * @param text - Comment text to validate
 * @param correlationId - Correlation ID for logging
 * @returns Validated and potentially truncated comment text
 */
function validateCommentLength(text: string, correlationId: string): string {
  if (text.length > MAX_COMMENT_LENGTH) {
    console.warn(`[ActionExecutor:${correlationId}] Comment too long, truncating`, {
      original: text.length,
      truncated: MAX_COMMENT_LENGTH,
    });
    return text.substring(0, MAX_COMMENT_LENGTH - 100) + '\n\n[Comment truncated due to length]';
  }
  return text;
}

/**
 * Extract AI reasoning from analysis result
 * Gets reasoning from the first answer with high confidence
 */
function extractAIReasoning(aiAnalysis: AIQuestionBatchResult | undefined): string | undefined {
  if (!aiAnalysis || !aiAnalysis.answers || aiAnalysis.answers.length === 0) {
    return undefined;
  }

  // Find first answer with YES response and confidence >= 70
  const significantAnswer = aiAnalysis.answers.find(
    a => a.answer === 'YES' && a.confidence >= 70
  );

  return significantAnswer?.reasoning;
}

/**
 * Create mod note after successful action execution
 * Handles all the data extraction and error handling
 */
async function createModNote(
  params: ExecuteActionParams,
  action: 'REMOVE' | 'FLAG' | 'COMMENT',
  correlationId: string
): Promise<void> {
  const { post, profile, ruleResult, context, aiAnalysis } = params;

  // Don't create mod notes in dry-run mode
  if (params.dryRun) {
    console.log(`[ActionExecutor:${correlationId}] Skipping mod note creation (dry-run mode)`);
    return;
  }

  try {
    // Get AI data from analysis result
    const aiProvider = aiAnalysis?.provider;
    const aiModel = aiAnalysis?.model;
    const aiReasoning = extractAIReasoning(aiAnalysis);

    await addAutomodNote(context, {
      userId: post.authorId || 'unknown',
      username: post.authorName || '[deleted]',
      subreddit: post.subredditName,
      contentId: post.id,
      action,
      ruleName: ruleResult.matchedRule,
      trustScore: Math.round(profile.totalKarma / 100), // Simplified trust score
      accountAge: profile.accountAgeInDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
      totalKarma: profile.totalKarma,
      confidence: ruleResult.confidence,
      aiProvider,
      aiModel,
      aiReasoning,
      reason: ruleResult.reason,
    });

    console.log(`[ActionExecutor:${correlationId}] Mod note created successfully`);
  } catch (error) {
    // Log error but don't throw - mod note failure shouldn't block action execution
    console.error(`[ActionExecutor:${correlationId}] Failed to create mod note:`, {
      error: error instanceof Error ? error.message : String(error),
      action,
    });
  }
}

/**
 * Parameters for executing an action
 */
export interface ExecuteActionParams {
  /** Reddit post to act upon */
  post: Post;
  /** Rule evaluation result containing action and metadata */
  ruleResult: RuleEvaluationResult;
  /** User profile for context */
  profile: UserProfile;
  /** Devvit context for Reddit API access */
  context: TriggerContext;
  /** If true, log instead of execute */
  dryRun: boolean;
  /** Optional AI analysis result for mod notes */
  aiAnalysis?: AIQuestionBatchResult;
}

/**
 * Execute a moderation action based on rule evaluation result
 *
 * This is the main entry point for action execution. It routes to the
 * appropriate action handler based on the rule result.
 *
 * @param params - Execution parameters
 * @returns Result indicating success/failure and execution details
 *
 * @example
 * ```typescript
 * const result = await executeAction({
 *   post,
 *   ruleResult: { action: 'FLAG', reason: 'Low karma user', ... },
 *   profile,
 *   context,
 *   dryRun: false
 * });
 *
 * if (!result.success) {
 *   console.error('Action failed:', result.error);
 * }
 * ```
 */
export async function executeAction(
  params: ExecuteActionParams
): Promise<ActionExecutionResult> {
  const { post, ruleResult, dryRun } = params;
  const correlationId = `${post.id}-${Date.now()}`;

  console.log(`[ActionExecutor:${correlationId}] Executing action:`, {
    action: ruleResult.action,
    postId: post.id,
    author: post.authorName,
    matchedRule: ruleResult.matchedRule,
    dryRun,
  });

  try {
    // Route to appropriate action handler
    switch (ruleResult.action) {
      case 'APPROVE':
        // No action needed - post is approved by default
        return {
          success: true,
          action: 'APPROVE',
          dryRun,
        };

      case 'FLAG':
        return await executeFlagAction(params, correlationId);

      case 'REMOVE':
        return await executeRemoveAction(params, correlationId);

      case 'COMMENT':
        return await executeCommentAction(params, correlationId);

      default:
        // Should never happen due to TypeScript types, but handle defensively
        console.error(`[ActionExecutor:${correlationId}] Unknown action type:`, ruleResult.action);
        return {
          success: false,
          action: ruleResult.action,
          error: `Unknown action type: ${ruleResult.action}`,
          dryRun,
        };
    }
  } catch (error) {
    // Catch-all error handler for unexpected failures
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ActionExecutor:${correlationId}] Unexpected error:`, {
      error: errorMessage,
      action: ruleResult.action,
      postId: post.id,
    });

    return {
      success: false,
      action: ruleResult.action,
      error: errorMessage,
      dryRun,
    };
  }
}

/**
 * Execute FLAG action - report post to mod queue
 *
 * FLAGS a post for manual moderator review by reporting it.
 * In dry-run mode, logs the action instead of executing.
 *
 * @param params - Execution parameters
 * @param correlationId - Correlation ID for logging
 * @returns Execution result
 */
async function executeFlagAction(
  params: ExecuteActionParams,
  correlationId: string
): Promise<ActionExecutionResult> {
  const { post, ruleResult, context, dryRun } = params;

  try {
    if (dryRun) {
      console.log(`[ActionExecutor:${correlationId}] [DRY-RUN] Would FLAG post:`, {
        postId: post.id,
        reason: ruleResult.reason,
      });

      return {
        success: true,
        action: 'FLAG',
        dryRun: true,
        details: {
          reportReason: ruleResult.reason,
        },
      };
    }

    // Validate report reason length
    let reportReason = ruleResult.reason;
    if (reportReason.length > MAX_REPORT_REASON_LENGTH) {
      console.warn(`[ActionExecutor:${correlationId}] Report reason too long, truncating`, {
        original: reportReason.length,
        truncated: MAX_REPORT_REASON_LENGTH,
      });
      reportReason = reportReason.substring(0, MAX_REPORT_REASON_LENGTH - 3) + '...';
    }

    // Execute: Report post to mod queue
    await context.reddit.report(post, {
      reason: reportReason,
    });

    console.log(`[ActionExecutor:${correlationId}] Successfully flagged post:`, {
      postId: post.id,
      reason: ruleResult.reason,
    });

    // Create mod note after successful FLAG
    await createModNote(params, 'FLAG', correlationId);

    return {
      success: true,
      action: 'FLAG',
      dryRun: false,
      details: {
        reportReason: ruleResult.reason,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a rate limit error
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.error(`[ActionExecutor:${correlationId}] Rate limit hit for FLAG action`, {
        postId: post.id,
        error: errorMessage,
      });
      return {
        success: false,
        action: 'FLAG',
        error: 'Rate limit exceeded - action will be retried',
        dryRun,
      };
    }

    console.error(`[ActionExecutor:${correlationId}] FLAG action failed:`, {
      postId: post.id,
      error: errorMessage,
    });

    return {
      success: false,
      action: 'FLAG',
      error: errorMessage,
      dryRun,
    };
  }
}

/**
 * Execute REMOVE action - remove post and add removal comment
 *
 * Removes a post from the subreddit and posts an explanation comment
 * using the configured template (or default template if not customized).
 * The template is populated with the rule's reason field and other variables.
 *
 * In dry-run mode, logs the action instead of executing.
 *
 * @param params - Execution parameters
 * @param correlationId - Correlation ID for logging
 * @returns Execution result
 */
async function executeRemoveAction(
  params: ExecuteActionParams,
  correlationId: string
): Promise<ActionExecutionResult> {
  const { post, ruleResult, context, dryRun } = params;

  try {
    // Get custom template from settings or use default
    const customTemplate = await context.settings.get('removeCommentTemplate');
    const template = (customTemplate as string) || DEFAULT_REMOVE_TEMPLATE;

    // Format template with variables
    const commentText = formatTemplate(template, {
      reason: ruleResult.reason,
      subreddit: post.subredditName,
      contentType: 'post',
      confidence: ruleResult.confidence,
    });

    // Validate comment length
    const validatedCommentText = validateCommentLength(commentText, correlationId);

    if (dryRun) {
      console.log(`[ActionExecutor:${correlationId}] [DRY-RUN] Would REMOVE post:`, {
        postId: post.id,
        reason: ruleResult.reason,
        wouldComment: true,
        commentText: validatedCommentText,
      });

      return {
        success: true,
        action: 'REMOVE',
        dryRun: true,
        details: {
          commentAdded: false, // Not actually added in dry-run
        },
      };
    }

    // Execute: Add removal comment FIRST (before removing post)
    let commentAdded = false;
    try {
      await context.reddit.submitComment({
        id: post.id,
        text: validatedCommentText,
      });
      commentAdded = true;

      // Phase 5.33: Comment tracking removed - now using getAppUser() in commentSubmit handler
    } catch (commentError) {
      // Log comment failure but don't fail the entire action
      const commentErrorMsg = commentError instanceof Error ? commentError.message : String(commentError);
      console.error(`[ActionExecutor:${correlationId}] Failed to add removal comment:`, {
        postId: post.id,
        error: commentErrorMsg,
      });
    }

    // Execute: Remove post SECOND (false = not spam)
    await context.reddit.remove(post.id, false);

    console.log(`[ActionExecutor:${correlationId}] Successfully removed post:`, {
      postId: post.id,
      reason: ruleResult.reason,
      commentAdded,
    });

    // Create mod note after successful REMOVE
    await createModNote(params, 'REMOVE', correlationId);

    return {
      success: true,
      action: 'REMOVE',
      dryRun: false,
      details: {
        commentAdded,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a rate limit error
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.error(`[ActionExecutor:${correlationId}] Rate limit hit for REMOVE action`, {
        postId: post.id,
        error: errorMessage,
      });
      return {
        success: false,
        action: 'REMOVE',
        error: 'Rate limit exceeded - action will be retried',
        dryRun,
      };
    }

    console.error(`[ActionExecutor:${correlationId}] REMOVE action failed:`, {
      postId: post.id,
      error: errorMessage,
    });

    return {
      success: false,
      action: 'REMOVE',
      error: errorMessage,
      dryRun,
    };
  }
}

/**
 * Execute COMMENT action - post warning/info comment without removing
 *
 * Posts a comment on the post without removing it. Used for warnings,
 * guidance, or informational messages to the user.
 *
 * In dry-run mode, logs the action instead of executing.
 *
 * @param params - Execution parameters
 * @param correlationId - Correlation ID for logging
 * @returns Execution result
 */
async function executeCommentAction(
  params: ExecuteActionParams,
  correlationId: string
): Promise<ActionExecutionResult> {
  const { post, ruleResult, context, dryRun } = params;

  try {
    // Get custom template from settings or use default
    const customTemplate = await context.settings.get('commentActionTemplate');
    const template = (customTemplate as string) || DEFAULT_COMMENT_TEMPLATE;

    // Format template with variables
    const commentText = formatTemplate(template, {
      reason: ruleResult.reason,
      subreddit: post.subredditName,
      contentType: 'post',
      confidence: ruleResult.confidence,
    });

    // Validate comment length
    const validatedCommentText = validateCommentLength(commentText, correlationId);

    if (dryRun) {
      console.log(`[ActionExecutor:${correlationId}] [DRY-RUN] Would COMMENT on post:`, {
        postId: post.id,
        commentText: validatedCommentText,
      });

      return {
        success: true,
        action: 'COMMENT',
        dryRun: true,
        details: {
          commentText: validatedCommentText,
        },
      };
    }

    // Execute: Post comment
    await context.reddit.submitComment({
      id: post.id,
      text: validatedCommentText,
    });

    // Phase 5.33: Comment tracking removed - now using getAppUser() in commentSubmit handler

    console.log(`[ActionExecutor:${correlationId}] Successfully posted comment:`, {
      postId: post.id,
      commentLength: validatedCommentText.length,
    });

    // Create mod note after successful COMMENT
    await createModNote(params, 'COMMENT', correlationId);

    return {
      success: true,
      action: 'COMMENT',
      dryRun: false,
      details: {
        commentText: validatedCommentText,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a rate limit error
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.error(`[ActionExecutor:${correlationId}] Rate limit hit for COMMENT action`, {
        postId: post.id,
        error: errorMessage,
      });
      return {
        success: false,
        action: 'COMMENT',
        error: 'Rate limit exceeded - action will be retried',
        dryRun,
      };
    }

    console.error(`[ActionExecutor:${correlationId}] COMMENT action failed:`, {
      postId: post.id,
      error: errorMessage,
    });

    return {
      success: false,
      action: 'COMMENT',
      error: errorMessage,
      dryRun,
    };
  }
}
