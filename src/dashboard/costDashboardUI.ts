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
 * Cost Dashboard UI
 *
 * Renders cost information for moderator view via toast messages.
 * Future Phase 5: Migrate to custom post UI with charts/graphs.
 *
 * Display Format:
 * - Daily costs with provider breakdown
 * - Monthly costs with provider breakdown
 * - Budget limits and usage percentages
 * - Status indicators (within budget, warning, critical)
 * - Current settings summary
 *
 * @module dashboard/costDashboardUI
 */

import { Context } from '@devvit/public-api';
import { CostDashboardCache } from './costDashboardCache.js';

/**
 * Format cost dashboard data as text for toast display
 *
 * Generates a formatted text dashboard showing:
 * - Today's costs (per-provider + total)
 * - Monthly costs (per-provider + total)
 * - Budget status with percentage indicators
 * - Current settings (limits, dry-run mode, providers)
 * - Last updated timestamp
 *
 * @param context - Devvit context with redis and settings access
 * @returns Formatted dashboard text
 *
 * @example
 * ```typescript
 * const dashboard = await renderCostDashboard(context);
 * context.ui.showToast({
 *   text: dashboard,
 *   appearance: 'neutral'
 * });
 * ```
 */
export async function renderCostDashboard(context: Context): Promise<string> {
  const data = await CostDashboardCache.getDashboardData(context);

  // Calculate usage percentages
  const dailyPercent = data.settings.dailyLimit > 0
    ? ((data.daily.total / data.settings.dailyLimit) * 100).toFixed(1)
    : '0.0';

  const monthlyPercent = data.settings.monthlyLimit > 0
    ? ((data.monthly.total / data.settings.monthlyLimit) * 100).toFixed(1)
    : '0.0';

  // Budget status indicators
  const dailyStatus = getBudgetStatus(parseFloat(dailyPercent));
  const monthlyStatus = getBudgetStatus(parseFloat(monthlyPercent));

  // Format last updated timestamp
  const lastUpdated = new Date(data.lastUpdated).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });

  // Get current month name
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  // Ultra-condensed version for toast display (strict character limit)
  // Format: Day: $X/$Y (Z%) | Mo: $A/$B (C%) | Status
  const dryRunText = data.settings.dryRunMode ? 'DRY-RUN' : 'LIVE';
  return `Day: $${data.daily.total.toFixed(2)}/$${data.settings.dailyLimit.toFixed(2)} | Mo: $${data.monthly.total.toFixed(2)}/$${data.settings.monthlyLimit.toFixed(2)} | ${dryRunText}`.trim();
}

/**
 * Get budget status indicator based on percentage used
 *
 * Returns a status message with appropriate emoji/indicator
 * based on how much of the budget has been consumed.
 *
 * Status Levels:
 * - < 50%: Within budget (green)
 * - 50-74%: Approaching limit (yellow warning)
 * - 75-89%: Near limit (orange warning)
 * - 90%+: Critical (red)
 *
 * @param percent - Budget usage percentage (0-100+)
 * @returns Status indicator string
 *
 * @example
 * ```typescript
 * getBudgetStatus(45.2) // '✅ Within budget'
 * getBudgetStatus(78.5) // '⚠️ Near limit (75%+)'
 * getBudgetStatus(92.1) // '🔴 CRITICAL - Near or at limit (90%+)'
 * ```
 */
function getBudgetStatus(percent: number): string {
  if (percent < 50) {
    return '✅ Within budget';
  } else if (percent < 75) {
    return '⚠️ Approaching limit (50%+)';
  } else if (percent < 90) {
    return '⚠️ Near limit (75%+)';
  } else {
    return '🔴 CRITICAL - Near or at limit (90%+)';
  }
}

/**
 * Get human-readable provider name
 *
 * Converts internal provider IDs to display-friendly names
 * with model versions included.
 *
 * @param provider - Internal provider ID
 * @returns Human-readable provider name
 *
 * @example
 * ```typescript
 * getProviderName('claude')   // 'Claude 3.5 Haiku'
 * getProviderName('openai')   // 'GPT-4o Mini'
 * getProviderName('deepseek') // 'DeepSeek V3'
 * getProviderName('none')     // 'None (no fallback)'
 * ```
 */
function getProviderName(provider: string): string {
  switch (provider) {
    case 'claude':
      return 'Claude 3.5 Haiku';
    case 'openai':
      return 'GPT-4o Mini';
    case 'deepseek':
      return 'DeepSeek V3';
    case 'none':
      return 'None (no fallback)';
    default:
      return provider;
  }
}
