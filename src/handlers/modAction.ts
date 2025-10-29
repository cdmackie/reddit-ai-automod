/**
 * ModAction Event Handler
 *
 * Monitors moderator actions to detect when mods manually remove content
 * that was previously approved by our automod system. This enables the
 * Community Trust System to retroactively update trust scores when our
 * approvals are overridden by human moderators.
 *
 * Flow:
 * 1. Detects removal actions (removelink, spamlink, removecomment, spamcomment)
 * 2. Checks if we previously approved the content (via tracking record)
 * 3. Verifies moderator provided a removal reason (per user requirement)
 * 4. Applies retroactive trust penalty if reason exists
 * 5. Cleans up tracking records
 *
 * User Requirement: "If no comment then ignore it" - we only penalize when
 * moderators provide a removal reason, indicating intentional moderation.
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
    // Extract action from event
    // Type guard: ModAction events have 'action' property
    if (!('action' in event) || !event.action) {
      console.log('[ModAction] No action in event, skipping');
      return;
    }

    const action = event.action;

    // Filter for removal actions only
    // We only care when mods remove content (not approve, lock, flair, etc.)
    if (
      action !== 'removelink' &&
      action !== 'spamlink' &&
      action !== 'removecomment' &&
      action !== 'spamcomment'
    ) {
      console.log(`[ModAction] Ignoring non-removal action: ${action}`);
      return;
    }

    // Extract content ID from target post or comment
    let contentId: string | undefined;
    if ('targetPost' in event && event.targetPost) {
      contentId = (event.targetPost as any).id;
    } else if ('targetComment' in event && event.targetComment) {
      contentId = (event.targetComment as any).id;
    }

    if (!contentId) {
      console.log(
        `[ModAction] No content ID found for action ${action}, skipping`
      );
      return;
    }

    // Determine content type for logging
    const contentType =
      action === 'removelink' || action === 'spamlink' ? 'post' : 'comment';

    // Get moderator name for logging
    const moderatorName =
      ('moderator' in event && (event.moderator as any)?.username) || 'unknown';

    console.log(
      `[ModAction] Detected ${action} on ${contentType} ${contentId} by mod u/${moderatorName}`
    );

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
    let contentId = 'unknown';
    if ('targetPost' in event && event.targetPost) {
      contentId = (event.targetPost as any).id || 'unknown';
    } else if ('targetComment' in event && event.targetComment) {
      contentId = (event.targetComment as any).id || 'unknown';
    }

    console.error(
      `[ModAction] Error handling ModAction for content ${contentId}:`,
      error
    );
    // Don't throw - fail gracefully to avoid disrupting mod workflow
  }
}
