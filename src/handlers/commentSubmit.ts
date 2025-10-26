/**
 * Comment submission event handler
 *
 * Handles new comment submissions and applies moderation rules
 */

import { TriggerContext, TriggerEvent } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit';

/**
 * Handle comment submission events
 */
export async function handleCommentSubmit(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { reddit, redis } = context;

  // Get comment from event
  if (!('comment' in event) || !event.comment) {
    console.error('[CommentSubmit] No comment in event');
    return;
  }

  const commentId = event.comment.id;

  // Fetch full comment details
  const comment = await reddit.getCommentById(commentId);

  // Initialize audit logger
  const auditLogger = new AuditLogger(redis);

  const author = comment.authorName || '[deleted]';
  const body = comment.body || '';
  const subredditName = (await comment.getSubreddit()).name;

  console.log(`[CommentSubmit] Processing comment: ${commentId} by u/${author}`);
  console.log(`[CommentSubmit] Subreddit: r/${subredditName}`);
  console.log(`[CommentSubmit] Body preview: ${body.substring(0, 100)}...`);

  // For now, just log that we received the event
  // In Phase 2, we'll add rule matching and evaluation
  await auditLogger.logApproval(
    commentId,
    author,
    'Phase 1: Auto-approved (no rules active yet)'
  );

  console.log(`[CommentSubmit] Comment ${commentId} processed successfully`);
}
