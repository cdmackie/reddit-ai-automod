/**
 * ModAction Event Handler
 *
 * Monitors moderator actions to:
 * 1. Increase trust scores when mods approve content (approvelink, approvecomment)
 * 2. Decrease trust scores when mods remove content we approved (removelink, etc.)
 *
 * Flow for Approvals:
 * 1. Detects approval actions (approvelink, approvecomment)
 * 2. Extracts author and subreddit from event
 * 3. Increases community trust score
 *
 * Flow for Removals:
 * 1. Detects removal actions (removelink, spamlink, removecomment, spamcomment)
 * 2. Checks if we previously approved the content (via tracking record)
 * 3. Verifies moderator provided a removal reason (per user requirement)
 * 4. Applies retroactive trust penalty if reason exists
 * 5. Cleans up tracking records
 *
 * Event Structure (FLAT):
 * - event.action: 'approvelink' | 'removelink' | etc.
 * - event.targetPost: { id, authorId, subredditName, ... }
 * - event.targetComment: { id, authorId, subredditName, ... }
 * - event.targetUser: { id, name, ... }
 * - event.subreddit: { name, ... }
 * - event.moderator: { name, ... }
 *
 * @module handlers/modAction
 */

import { TriggerContext, TriggerEvent } from '@devvit/public-api';
import { CommunityTrustManager } from '../trust/communityTrustManager';
import type { ApprovedContentRecord } from '../types/communityTrust';

/**
 * Handle ModAction events
 *
 * Monitors moderator actions and updates community trust scores when
 * moderators remove content we previously approved.
 *
 * @param event - ModAction trigger event
 * @param context - Devvit trigger context
 */
export async function handleModAction(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { redis, reddit } = context;

  try {
    // Extract action type from event
    // Event structure is FLAT - properties are directly on event object
    const action = (event as any).action;

    if (!action) {
      console.log('[ModAction] No action in event, skipping');
      return;
    }

    // Filter for removal and approval actions
    // Track both removals and approvals to update community trust
    const isRemoval =
      action === 'removelink' ||
      action === 'spamlink' ||
      action === 'removecomment' ||
      action === 'spamcomment';

    const isApproval =
      action === 'approvelink' ||
      action === 'approvecomment';

    if (!isRemoval && !isApproval) {
      console.log(`[ModAction] Ignoring action (not removal or approval): ${action}`);
      return;
    }

    // Extract content ID from target
    // For posts: event.targetPost.id, for comments: event.targetComment.id
    const targetPost = (event as any).targetPost;
    const targetComment = (event as any).targetComment;

    const contentId = (isRemoval || isApproval) &&
                     (action.includes('link') || action.includes('Link'))
      ? targetPost?.id
      : targetComment?.id;

    if (!contentId) {
      console.log(
        `[ModAction] No content ID found for action ${action}, skipping`
      );
      return;
    }

    // Determine content type for logging
    const contentType =
      action === 'removelink' || action === 'spamlink' || action === 'approvelink'
        ? 'post'
        : 'comment';

    // Get moderator name for logging
    const moderator = (event as any).moderator;
    const moderatorName = moderator?.name || 'unknown';

    console.log(
      `[ModAction] Detected ${action} on ${contentType} ${contentId} by mod u/${moderatorName}`
    );

    // Handle approval actions
    if (isApproval) {
      console.log(`[ModAction] Processing manual approval of ${contentType} ${contentId}`);

      // Get author and subreddit from event
      const targetUser = (event as any).targetUser;
      const subredditObj = (event as any).subreddit;

      const authorId = targetUser?.id;
      const subreddit = subredditObj?.name;

      if (!authorId || !subreddit) {
        console.log(`[ModAction] Could not get author/subreddit from event for ${contentId}, skipping`);
        return;
      }

      // Update trust score with APPROVE
      const trustManager = new CommunityTrustManager(context as any);
      await trustManager.updateTrust(authorId, subreddit, 'APPROVE', contentType);

      console.log(
        `[ModAction] ✅ Trust score increased for user ${authorId} after mod approval of ${contentType} ${contentId} by u/${moderatorName}`
      );
      return;
    }

    // Handle removal actions (existing logic)
    // Check if WE approved this content
    const trackingKey = `approved:tracking:${contentId}`;
    const approvedRecord = await redis.get(trackingKey);

    if (!approvedRecord) {
      console.log(
        `[ModAction] No tracking record for ${contentId} - we didn't approve it, skipping`
      );
      return;
    }

    // Parse tracking record to get user details
    const record = JSON.parse(approvedRecord) as ApprovedContentRecord;
    const { userId, subreddit } = record;

    console.log(
      `[ModAction] Mod u/${moderatorName} removed ${contentType} ${contentId} that we approved for user ${userId} in r/${subreddit}`
    );

    // Check for removal reason (per user requirement)
    // User: "If no comment then ignore it" - only penalize if mod gave reason
    let hasRemovalReason = false;

    try {
      if (contentType === 'post') {
        const post = await reddit.getPostById(contentId);
        // Check for mod note or removal reason
        hasRemovalReason = !!(
          (post as any).modNote || (post as any).removalReason
        );
      } else {
        const comment = await reddit.getCommentById(contentId);
        // Check for mod note or removal reason
        hasRemovalReason = !!(
          ('modNote' in comment && (comment as any).modNote) ||
          ('removalReason' in comment && (comment as any).removalReason)
        );
      }
    } catch (error) {
      console.error(
        `[ModAction] Error fetching ${contentType} ${contentId} to check removal reason:`,
        error
      );
      // If we can't fetch it, assume no reason and skip penalty (safe default)
      hasRemovalReason = false;
    }

    if (!hasRemovalReason) {
      console.log(
        `[ModAction] Mod removed ${contentType} ${contentId} without providing removal reason - skipping trust penalty per user requirement`
      );
      // Clean up tracking record even though we're not penalizing
      await redis.del(trackingKey);
      return;
    }

    console.log(
      `[ModAction] Mod provided removal reason for ${contentType} ${contentId} - applying retroactive trust penalty`
    );

    // Apply retroactive penalty via CommunityTrustManager
    const trustManager = new CommunityTrustManager(context as any);
    await trustManager.retroactiveRemoval(contentId);

    console.log(
      `[ModAction] ✅ Trust score updated for user ${userId} after mod removal of ${contentType} ${contentId} by u/${moderatorName}`
    );

    // Clean up tracking record
    await redis.del(trackingKey);
  } catch (error) {
    // Extract content ID for logging if available
    const targetPost = (event as any).targetPost;
    const targetComment = (event as any).targetComment;
    const contentId = targetPost?.id || targetComment?.id || 'unknown';

    console.error(
      `[ModAction] Error handling ModAction for content ${contentId}:`,
      error
    );
    // Don't throw - fail gracefully to avoid disrupting mod workflow
  }
}
