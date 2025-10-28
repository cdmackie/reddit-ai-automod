/**
 * Comment submission event handler
 *
 * Handles new comment submissions and applies moderation rules
 */

import { TriggerContext, TriggerEvent, Devvit } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit';
import { ModAction } from '../types/storage.js';
import { sendRealtimeDigest } from '../notifications/modmailDigest.js';

/**
 * Handle comment submission events
 */
export async function handleCommentSubmit(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { reddit, redis } = context;

  // Get comment from event (type guard for TriggerEvent union)
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
  const subredditName = comment.subredditName || 'unknown';

  console.log(`[CommentSubmit] Processing comment: ${commentId} by u/${author}`);
  console.log(`[CommentSubmit] Subreddit: r/${subredditName}`);
  console.log(`[CommentSubmit] Body preview: ${body.substring(0, 100)}...`);

  // For now, just log that we received the event
  // In Phase 2, we'll add rule matching and evaluation
  const auditLog = await auditLogger.log({
    action: ModAction.APPROVE,
    userId: author,
    contentId: commentId,
    reason: 'Phase 1: Auto-approved (no rules active yet)',
    metadata: {
      bodyPreview: body.substring(0, 200),
    },
  });

  // Send realtime digest if enabled
  await sendRealtimeDigest(context as Devvit.Context, auditLog);

  console.log(`[CommentSubmit] Comment ${commentId} processed successfully`);
}
