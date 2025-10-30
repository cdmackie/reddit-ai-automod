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
import { getAnalysisHistory, AnalysisHistoryEntry } from '../storage/analysisHistory.js';

/**
 * Fetch and format analysis for a specific post
 *
 * Retrieves the AI analysis history for a post and formats it into a detailed
 * summary suitable for display in a toast or form.
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
    const entry = await getAnalysisHistory(context.redis, postId);

    if (!entry) {
      return 'No AI analysis available for this post.\n\nPossible reasons:\n• Post was not processed by AI Automod\n• Post was approved without AI analysis\n• Analysis data has expired (90 day retention)';
    }

    return formatAnalysisDetailed(entry);
  } catch (error) {
    console.error('[PostAnalysis] Error fetching analysis:', error);
    return 'Error loading AI analysis. Check logs for details.';
  }
}

/**
 * Format analysis history entry into detailed multi-line text
 *
 * Converts an AnalysisHistoryEntry into a detailed, readable format
 * showing all relevant information about the AI decision.
 *
 * @param entry - The analysis history entry to format
 * @returns Formatted detailed analysis string
 *
 * @internal
 */
function formatAnalysisDetailed(entry: AnalysisHistoryEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`🤖 AI Automod Analysis`);
  lines.push('─'.repeat(30));
  lines.push('');

  // Action and Rule
  const actionEmoji = {
    'REMOVE': '🚫',
    'FLAG': '🚩',
    'COMMENT': '💬',
    'APPROVE': '✅',
  }[entry.action] || '❓';

  lines.push(`${actionEmoji} Action: ${entry.action}`);
  lines.push(`📋 Rule: ${entry.ruleName}`);
  lines.push('');

  // User Information
  lines.push(`👤 User: u/${entry.authorName}`);
  lines.push(`🎯 Trust Score: ${entry.trustScore}/100`);
  lines.push(`📅 Account Age: ${entry.accountAgeInDays} days`);
  lines.push(`⭐ Total Karma: ${entry.totalKarma.toLocaleString()}`);
  lines.push('');

  // AI Analysis
  if (entry.aiProvider && entry.aiModel) {
    const providerName = getProviderDisplayName(entry.aiProvider, entry.aiModel);
    lines.push(`🤖 AI: ${providerName}`);

    if (entry.confidence) {
      lines.push(`📊 Confidence: ${entry.confidence}%`);
    }
    lines.push('');
  }

  // Reasoning
  if (entry.aiReasoning) {
    lines.push(`💭 AI Reasoning:`);
    lines.push(entry.aiReasoning);
    lines.push('');
  } else if (entry.ruleReason) {
    lines.push(`💭 Reason:`);
    lines.push(entry.ruleReason);
    lines.push('');
  }

  // Timestamp
  const date = new Date(entry.timestamp);
  lines.push(`🕐 Processed: ${date.toLocaleString()}`);

  return lines.join('\n');
}

/**
 * Get display-friendly AI provider name
 */
function getProviderDisplayName(provider: string, model?: string): string {
  switch (provider) {
    case 'claude':
      return 'Claude 3.5 Haiku';
    case 'openai':
      if (model?.includes('gpt-4o-mini')) {
        return 'OpenAI GPT-4o-mini';
      } else if (model?.includes('gpt-4')) {
        return 'OpenAI GPT-4';
      }
      return 'OpenAI';
    case 'openai-compatible':
      if (model && model !== 'configurable') {
        return model;
      }
      return 'Custom AI';
    default:
      return 'AI';
  }
}
