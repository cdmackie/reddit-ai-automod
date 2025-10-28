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

    // Execute: Report post to mod queue
    await context.reddit.report(post, {
      reason: ruleResult.reason,
    });

    console.log(`[ActionExecutor:${correlationId}] Successfully flagged post:`, {
      postId: post.id,
      reason: ruleResult.reason,
    });

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
 * Execute REMOVE action - remove post and optionally add comment
 *
 * Removes a post from the subreddit and optionally posts an explanation
 * comment. If ruleResult.comment is provided, it's used as the removal
 * explanation. Otherwise, uses a default message with the reason.
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
    // Determine comment text
    const commentText = ruleResult.comment ||
      `Your post has been removed.\n\nReason: ${ruleResult.reason}\n\nIf you believe this was done in error, please contact the moderators.`;

    if (dryRun) {
      console.log(`[ActionExecutor:${correlationId}] [DRY-RUN] Would REMOVE post:`, {
        postId: post.id,
        reason: ruleResult.reason,
        wouldComment: true,
        commentText,
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

    // Execute: Remove post (false = not spam)
    await context.reddit.remove(post.id, false);

    // Execute: Add removal comment
    let commentAdded = false;
    try {
      await context.reddit.submitComment({
        id: post.id,
        text: commentText,
      });
      commentAdded = true;
    } catch (commentError) {
      // Log comment failure but don't fail the entire action
      // (post is already removed, which is the primary action)
      const commentErrorMsg = commentError instanceof Error ? commentError.message : String(commentError);
      console.error(`[ActionExecutor:${correlationId}] Failed to add removal comment:`, {
        postId: post.id,
        error: commentErrorMsg,
      });
    }

    console.log(`[ActionExecutor:${correlationId}] Successfully removed post:`, {
      postId: post.id,
      reason: ruleResult.reason,
      commentAdded,
    });

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
    // Comment text is required for COMMENT action
    if (!ruleResult.comment) {
      console.error(`[ActionExecutor:${correlationId}] COMMENT action missing comment text:`, {
        postId: post.id,
        matchedRule: ruleResult.matchedRule,
      });

      return {
        success: false,
        action: 'COMMENT',
        error: 'Comment text is required for COMMENT action',
        dryRun,
      };
    }

    const commentText = ruleResult.comment;

    if (dryRun) {
      console.log(`[ActionExecutor:${correlationId}] [DRY-RUN] Would COMMENT on post:`, {
        postId: post.id,
        commentText,
      });

      return {
        success: true,
        action: 'COMMENT',
        dryRun: true,
        details: {
          commentText,
        },
      };
    }

    // Execute: Post comment
    await context.reddit.submitComment({
      id: post.id,
      text: commentText,
    });

    console.log(`[ActionExecutor:${correlationId}] Successfully posted comment:`, {
      postId: post.id,
      commentLength: commentText.length,
    });

    return {
      success: true,
      action: 'COMMENT',
      dryRun: false,
      details: {
        commentText,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
