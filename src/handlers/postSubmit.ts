/**
 * Post submission event handler
 *
 * Handles new post submissions and applies moderation rules
 */

import { TriggerContext, TriggerEvent } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit';

/**
 * Handle post submission events
 */
export async function handlePostSubmit(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { reddit, redis } = context;

  // Get post from event
  if (!('post' in event) || !event.post) {
    console.error('[PostSubmit] No post in event');
    return;
  }

  const postId = event.post.id;

  // Fetch full post details
  const post = await reddit.getPostById(postId);

  // Initialize audit logger
  const auditLogger = new AuditLogger(redis);

  const author = post.authorName || '[deleted]';
  const title = post.title || '';
  const subredditName = post.subredditName || 'unknown';

  console.log(`[PostSubmit] Processing post: ${postId} by u/${author}`);
  console.log(`[PostSubmit] Subreddit: r/${subredditName}`);
  console.log(`[PostSubmit] Title: ${title}`);

  // For now, just log that we received the event
  // In Phase 2, we'll add rule matching and evaluation
  await auditLogger.logApproval(
    postId,
    author,
    'Phase 1: Auto-approved (no rules active yet)'
  );

  console.log(`[PostSubmit] Post ${postId} processed successfully`);
}
