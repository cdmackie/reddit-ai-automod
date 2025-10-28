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

  return `
AI Automod - Cost Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Today's Costs
  Claude:     $${data.daily.claude.toFixed(2)}
  OpenAI:     $${data.daily.openai.toFixed(2)}
  DeepSeek:   $${data.daily.deepseek.toFixed(2)}
  ─────────────────────────
  Total:      $${data.daily.total.toFixed(2)} / $${data.settings.dailyLimit.toFixed(2)} (${dailyPercent}%)
  ${dailyStatus}

📈 Monthly Costs (${monthName})
  Claude:     $${data.monthly.claude.toFixed(2)}
  OpenAI:     $${data.monthly.openai.toFixed(2)}
  DeepSeek:   $${data.monthly.deepseek.toFixed(2)}
  ─────────────────────────
  Total:      $${data.monthly.total.toFixed(2)} / $${data.settings.monthlyLimit.toFixed(2)} (${monthlyPercent}%)
  ${monthlyStatus}

⚙️ Settings
  Daily Limit:    $${data.settings.dailyLimit.toFixed(2)}
  Monthly Limit:  $${data.settings.monthlyLimit.toFixed(2)}
  Dry-Run Mode:   ${data.settings.dryRunMode ? 'Enabled ⚠️' : 'Disabled'}
  Primary AI:     ${getProviderName(data.settings.primaryProvider)}
  Fallback AI:    ${getProviderName(data.settings.fallbackProvider)}

Last updated: ${lastUpdated}

💡 To refresh, reopen this dashboard
⚙️ To adjust settings, visit Subreddit Settings > Apps > AI Automod
`.trim();
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
