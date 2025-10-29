/**
 * ModAction Event Handler
 *
 * Monitors moderator actions to maintain accurate community trust scores:
 * 1. Increase trust when mods approve content (approvelink, approvecomment)
 * 2. Decrease trust when mods remove previously-approved content (removelink, etc.)
 *
 * Any removal of tracked content (approved by bot OR mod) applies a trust penalty.
 *
 * Flow for Approvals:
 * 1. Detects approval actions (approvelink, approvecomment)
 * 2. Extracts author and subreddit from event
 * 3. Increases community trust score
 * 4. Creates tracking record (24h TTL) to allow undoing if later removed
 *
 * Flow for Removals:
 * 1. Detects removal actions (removelink, spamlink, removecomment, spamcomment)
 * 2. Checks if content was previously approved (by bot OR by mod via tracking record)
 * 3. Applies retroactive trust penalty (any removal of approved content = penalty)
 * 4. Cleans up tracking records
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

      // Create tracking record so this approval can be undone if later removed
      const trackingKey = `approved:tracking:${contentId}`;
      const trackingRecord: ApprovedContentRecord = {
        userId: authorId,
        subreddit: subreddit,
        contentId: contentId,
        contentType: contentType,
        approvedAt: Date.now(),
      };
      await redis.set(trackingKey, JSON.stringify(trackingRecord), {
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      console.log(
        `[ModAction] ✅ Trust score increased for user ${authorId} after mod approval of ${contentType} ${contentId} by u/${moderatorName}`
      );
      console.log(
        `[ModAction] Created tracking record for ${contentId} (24h expiry)`
      );
      return;
    }

    // Handle removal actions (existing logic)
    // Check if this content was approved (by bot OR by mod)
    const trackingKey = `approved:tracking:${contentId}`;
    const approvedRecord = await redis.get(trackingKey);

    if (!approvedRecord) {
      console.log(
        `[ModAction] No tracking record for ${contentId} - not previously approved (by bot or mod), skipping trust penalty`
      );
      return;
    }

    // Parse tracking record to get user details
    const record = JSON.parse(approvedRecord) as ApprovedContentRecord;
    const { userId, subreddit } = record;

    console.log(
      `[ModAction] Mod u/${moderatorName} removed ${contentType} ${contentId} that was previously approved for user ${userId} in r/${subreddit} - applying trust penalty`
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
