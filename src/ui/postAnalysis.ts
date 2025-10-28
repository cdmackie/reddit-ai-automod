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
 * Format audit log into human-readable analysis text
 *
 * Converts an AuditLog entry into a concise, readable format suitable
 * for display in a toast notification.
 *
 * @param log - The audit log entry to format
 * @returns Formatted analysis string
 *
 * @internal
 */
function formatAnalysis(log: AuditLog): string {
  const metadata = log.metadata as any || {};

  // Extract metadata
  const trustScore = metadata.trustScore ?? 'N/A';
  const aiCost = metadata.aiCost ? `$${metadata.aiCost.toFixed(4)}` : '$0.00';
  const dryRun = metadata.dryRun ? 'YES' : 'NO';
  const executionTime = metadata.executionTime ? `${metadata.executionTime}ms` : 'N/A';

  // Format timestamp
  const timestamp = new Date(log.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build analysis text
  let analysis = `
AI Automod Analysis
──────────────────────
Action: ${log.action}${dryRun === 'YES' ? ' (DRY-RUN)' : ''}
User: u/${metadata.username || log.userId}
Trust Score: ${trustScore}/100
${log.ruleId ? `Rule: ${log.ruleId}` : 'Rule: Default (no match)'}
${log.confidence ? `Confidence: ${log.confidence}%` : ''}
AI Cost: ${aiCost}
Time: ${executionTime}
Reason: ${log.reason}
Processed: ${timestamp}
  `.trim();

  return analysis;
}
