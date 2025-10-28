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
    const digestEnabled = settings.digestEnabled as boolean;
    const digestMode = (settings.digestMode as string[])?.[0] || 'daily';

    // Check if digest is enabled and in daily mode
    if (!digestEnabled || digestMode !== 'daily') {
      console.log('[ModmailDigest] Daily digest is disabled or not in daily mode, skipping');
      return;
    }

    console.log('[ModmailDigest] Daily digest not yet fully implemented - requires getLogsInRange() on AuditLogger');
    // TODO: Implement full daily digest when AuditLogger.getLogsInRange() is available
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
    const digestEnabled = settings.digestEnabled as boolean;
    const digestMode = (settings.digestMode as string[])?.[0] || 'daily';
    const digestRecipient = (settings.digestRecipient as string[])?.[0] || 'all';
    const digestRecipientUsername = settings.digestRecipientUsername as string;

    console.log('[ModmailDigest] Settings:', {
      digestEnabled,
      digestMode,
      digestRecipient,
      digestRecipientUsername,
    });

    // Check if digest is enabled and mode is realtime
    if (!digestEnabled || digestMode !== 'realtime') {
      console.log('[ModmailDigest] Skipping - disabled or not realtime mode');
      return;
    }

    // Format the single action message
    const message = formatRealtimeMessage(auditLog, settings);
    const subject = `AI Automod - ${auditLog.action} Action`;

    // Send via PM if specific user, modmail if all mods
    if (digestRecipient === 'specific' && digestRecipientUsername) {
      // Send as private message to specific user
      console.log(`[ModmailDigest] Sending PM to specific user: u/${digestRecipientUsername}`);

      await context.reddit.sendPrivateMessage({
        to: digestRecipientUsername,
        subject: subject,
        text: message,
      });

      console.log(`[ModmailDigest] ✓ PM sent to u/${digestRecipientUsername}`);
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

