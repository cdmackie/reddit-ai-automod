/**
 * AI Automod - AI Automod for Reddit
 * Copyright (C) 2025 CoinsTax LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
 * Format: {ACTION} {trustScore}/100. ${cost} {time}. {ruleId}.
 * Example: APPROVE 80/100. $0.0012 125ms. simple-rule.
 *
 * @param log - The audit log entry to format
 * @returns Formatted single-line analysis string
 *
 * @internal
 */
function formatAnalysis(log: AuditLog): string {
  const metadata = log.metadata as any || {};

  // Extract and validate metadata with type-safe defaults
  const trustScore = typeof metadata.trustScore === 'number'
    ? metadata.trustScore
    : 'N/A';

  const aiCost = typeof metadata.aiCost === 'number'
    ? `$${metadata.aiCost.toFixed(4)}`
    : '$0.00';

  const dryRun = !!metadata.dryRun;

  const executionTime = metadata.executionTime;
  const timeDisplay = typeof executionTime === 'number'
    ? `${executionTime}ms`
    : 'N/A';

  const ruleId = log.ruleId || 'default';

  // Build single-line format: {ACTION} {trustScore}/100. ${cost} {time}. {ruleId}.
  const analysis = `${log.action} ${trustScore}/100. ${aiCost} ${timeDisplay}. ${ruleId}.${dryRun ? ' (DRY-RUN)' : ''}`;

  return analysis;
}
