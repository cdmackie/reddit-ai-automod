/**
 * Post Analysis UI Helper
 *
 * Provides functionality to display AI analysis results for individual posts.
 * Used by the "View AI Analysis" menu item on posts.
 *
 * @module ui/postAnalysis
 */

import { Context } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit.js';
import { AuditLog } from '../types/storage.js';

/**
 * Fetch and format analysis for a specific post
 *
 * Retrieves the audit log for a post and formats it into a human-readable
 * summary suitable for display in a toast.
 *
 * @param context - Devvit context with redis access
 * @param postId - The Reddit post ID (e.g., "t3_abc123")
 * @returns Formatted analysis text or error message
 *
 * @example
 * ```typescript
 * const analysis = await getPostAnalysis(context, 't3_abc123');
 * context.ui.showToast({ text: analysis });
 * ```
 */
export async function getPostAnalysis(
  context: Context,
  postId: string
): Promise<string> {
  try {
    const auditLogger = new AuditLogger(context.redis);
    const logs = await auditLogger.getLogsForContent(postId);

    if (!logs || logs.length === 0) {
      return 'No analysis available for this post. Post may not have been processed yet.';
    }

    // Get the most recent log entry (latest action)
    const latestLog = logs[logs.length - 1];

    return formatAnalysis(latestLog);
  } catch (error) {
    console.error('[PostAnalysis] Error fetching analysis:', error);
    return 'Error loading analysis. Check logs for details.';
  }
}

/**
 * Format audit log into ultra-concise single-line analysis text
 *
 * Converts an AuditLog entry into a single-line format optimized
 * for toast notifications (which only show ~2 lines).
 *
 * Format: {ACTION} {trustScore}/100. ${cost} {time}ms. {ruleId}. (DRY-RUN)
 * Example: APPROVE 80/100. $0.0012 125ms. simple-rule.
 *
 * @param log - The audit log entry to format
 * @returns Formatted single-line analysis string
 *
 * @internal
 */
function formatAnalysis(log: AuditLog): string {
  const metadata = log.metadata as any || {};

  // Extract metadata with defaults
  const trustScore = metadata.trustScore ?? 'N/A';
  const aiCost = metadata.aiCost ? `$${metadata.aiCost.toFixed(4)}` : '$0.00';
  const dryRun = metadata.dryRun ? true : false;
  const executionTime = metadata.executionTime ?? 'N/A';
  const ruleId = log.ruleId || 'default';

  // Build single-line format: {ACTION} {trustScore}/100. ${cost} {time}ms. {ruleId}.
  const analysis = `${log.action} ${trustScore}/100. ${aiCost} ${executionTime}ms. ${ruleId}.${dryRun ? ' (DRY-RUN)' : ''}`;

  return analysis;
}
