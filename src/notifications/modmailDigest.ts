/**
 * Modmail Digest Module
 *
 * Sends daily digest of AI moderation actions to moderators via modmail.
 * Supports sending to all moderators (Mod Notifications) or a specific moderator.
 *
 * @module notifications/modmailDigest
 */

import { Context } from '@devvit/public-api';
import { AuditLog } from '../types/storage.js';

/**
 * Send daily digest of AI moderation actions via modmail
 *
 * NOTE: This function is a stub placeholder. Full implementation requires
 * adding getLogsInRange() method to AuditLogger and implementing key tracking
 * in Redis storage layer.
 *
 * @param context - Devvit context with redis and reddit API access
 *
 * @example
 * ```typescript
 * // Called by scheduled job
 * await sendDailyDigest(context);
 * ```
 */
export async function sendDailyDigest(context: Context): Promise<void> {
  try {
    console.log('[ModmailDigest] Daily digest called (not yet fully implemented)');

    // Get settings
    const settings = await context.settings.getAll();
    const dailyDigestEnabled = settings.dailyDigestEnabled as boolean;
    const dailyDigestRecipient = (settings.dailyDigestRecipient as string[])?.[0] || 'all';
    const dailyDigestRecipientUsernames = settings.dailyDigestRecipientUsernames as string;

    // Check if daily digest is enabled
    if (!dailyDigestEnabled) {
      console.log('[ModmailDigest] Daily digest is disabled, skipping');
      return;
    }

    console.log('[ModmailDigest] Daily digest not yet fully implemented - requires getLogsInRange() on AuditLogger');
    // TODO: Implement full daily digest when AuditLogger.getLogsInRange() is available
    // When implemented:
    // - If dailyDigestRecipient is 'all', send to modmail
    // - If dailyDigestRecipient is 'specific', split dailyDigestRecipientUsernames by comma, trim, and send PM to each
  } catch (error) {
    console.error('[ModmailDigest] Error in daily digest:', error);
    // Don't throw - we don't want to crash the scheduler
  }
}

/**
 * Send real-time digest for a single moderation action
 *
 * Sends immediate notification via modmail for each action taken.
 * Useful for testing and real-time monitoring.
 *
 * @param context - Devvit context
 * @param auditLog - Single audit log entry for the action just taken
 */
export async function sendRealtimeDigest(context: Context, auditLog: AuditLog): Promise<void> {
  try {
    const settings = await context.settings.getAll();
    const realtimeNotificationsEnabled = settings.realtimeNotificationsEnabled as boolean;
    const realtimeRecipient = (settings.realtimeRecipient as string[])?.[0] || 'all';
    const realtimeRecipientUsernames = settings.realtimeRecipientUsernames as string;

    console.log('[ModmailDigest] Real-time notification settings:', {
      realtimeNotificationsEnabled,
      realtimeRecipient,
      realtimeRecipientUsernames,
    });

    // Check if real-time notifications are enabled
    if (!realtimeNotificationsEnabled) {
      console.log('[ModmailDigest] Skipping - real-time notifications disabled');
      return;
    }

    // Format the single action message
    const message = formatRealtimeMessage(auditLog, settings);
    const subject = `AI Automod - ${auditLog.action} Action`;

    // Send via PM if specific user(s), modmail if all mods
    if (realtimeRecipient === 'specific' && realtimeRecipientUsernames) {
      // Parse comma-separated usernames
      const usernames = realtimeRecipientUsernames
        .split(',')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (usernames.length === 0) {
        console.log('[ModmailDigest] No valid usernames found, skipping');
        return;
      }

      console.log(`[ModmailDigest] Sending PMs to ${usernames.length} specific user(s): ${usernames.join(', ')}`);

      // Send individual PM to each username
      for (const username of usernames) {
        try {
          await context.reddit.sendPrivateMessage({
            to: username,
            subject: subject,
            text: message,
          });
          console.log(`[ModmailDigest] ✓ PM sent to u/${username}`);
        } catch (error) {
          console.error(`[ModmailDigest] Error sending PM to u/${username}:`, error);
          // Continue with other usernames even if one fails
        }
      }
    } else {
      // Send as modmail to all mods
      console.log('[ModmailDigest] Sending modmail to Mod Notifications (all mods)');

      await context.reddit.modMail.createModInboxConversation({
        subredditId: context.subredditId,
        subject: subject,
        bodyMarkdown: message,
      });

      console.log('[ModmailDigest] ✓ Modmail sent to all mods');
    }

    console.log(`[ModmailDigest] ✓ Realtime notification sent for ${auditLog.action} action on ${auditLog.contentId}`);
  } catch (error) {
    console.error('[ModmailDigest] Error sending realtime digest:', error);
    // Don't throw - we don't want to crash the handler
  }
}

/**
 * Format a single audit log entry into a real-time notification message
 *
 * @param log - Single audit log entry
 * @param settings - App settings
 * @returns Formatted markdown string
 */
function formatRealtimeMessage(log: AuditLog, settings: any): string {
  const dryRunMode = settings.dryRunMode as boolean;
  const metadata = log.metadata as any || {};

  // Determine content type from contentId (t3_ = post, t1_ = comment)
  const contentType = log.contentId.startsWith('t3_') ? 'Post' :
                      log.contentId.startsWith('t1_') ? 'Comment' :
                      'Content';

  let message = `## AI Automod - ${log.action} Action\n\n`;

  if (dryRunMode) {
    message += `**⚠️ DRY-RUN MODE** - Action was logged but not executed.\n\n`;
  }

  message += `**Action:** ${log.action}\n`;
  message += `**Target:** ${contentType} ${log.contentId}\n`;
  message += `**User:** u/${log.userId}\n`;
  message += `**Reason:** ${log.reason}\n`;

  if (log.confidence !== undefined) {
    message += `**Confidence:** ${log.confidence}%\n`;
  }

  if (metadata.aiCost) {
    message += `**AI Cost:** $${metadata.aiCost.toFixed(4)}\n`;
  }

  if (log.ruleId) {
    message += `**Matched Rule:** ${log.ruleId}\n`;
  }

  if (metadata.dryRun !== undefined) {
    message += `**Rule Dry-Run:** ${metadata.dryRun ? 'Yes' : 'No'}\n`;
  }

  if (metadata.executionTime !== undefined) {
    message += `**Execution Time:** ${metadata.executionTime}ms\n`;
  }

  // Add post/comment details if available
  if (metadata.postTitle) {
    message += `\n**Post Title:** ${metadata.postTitle}\n`;
  }

  if (metadata.bodyPreview) {
    message += `**Content Preview:** ${metadata.bodyPreview}\n`;
  }

  message += `\n**Timestamp:** ${new Date(log.timestamp).toISOString()}\n`;

  message += `\n---\n`;
  message += `*View full details in mod log or subreddit menu*`;

  return message;
}

