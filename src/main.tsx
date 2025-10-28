import { Devvit } from '@devvit/public-api';
import { handlePostSubmit } from './handlers/postSubmit';
import { handleCommentSubmit } from './handlers/commentSubmit';
import { renderCostDashboard } from './dashboard/costDashboardUI';
import { initializeDefaultRules } from './handlers/appInstall';

// Configure Devvit with required permissions
Devvit.configure({
  redditAPI: true, // Access Reddit API
  redis: true,     // Use Redis storage
  http: true,      // HTTP enabled for AI API calls (Phase 2+)
});

/**
 * Settings UI Configuration
 *
 * Moderators configure these settings at:
 * reddit.com/r/SUBREDDIT/about/apps/APP_NAME
 *
 * All settings are per-subreddit (installation-scoped).
 * Each subreddit moderator configures their own API keys and pays for their own AI usage.
 *
 * Note: API keys are NOT encrypted (Devvit limitation - only app-scoped settings can be secrets).
 * However, they're only visible to moderators with Settings access.
 *
 * Settings accessed via: const settings = await context.settings.getAll();
 * See SettingsService for type-safe access to these settings.
 */
Devvit.addSettings([
  // ===== AI Provider Configuration =====
  {
    type: 'string',
    name: 'claudeApiKey',
    label: 'Claude API Key (Anthropic)',
    helpText: 'Your Anthropic API key for Claude 3.5 Haiku. Get one at console.anthropic.com. Each subreddit uses their own key.',
    scope: 'installation',
  },
  {
    type: 'string',
    name: 'openaiApiKey',
    label: 'OpenAI API Key',
    helpText: 'Your OpenAI API key for GPT-4o Mini. Get one at platform.openai.com. Each subreddit uses their own key.',
    scope: 'installation',
  },
  {
    type: 'string',
    name: 'deepseekApiKey',
    label: 'DeepSeek API Key',
    helpText: 'Your DeepSeek API key for DeepSeek V3 (optional). Get one at platform.deepseek.com. Each subreddit uses their own key.',
    scope: 'installation',
  },

  // ===== Provider Selection =====
  {
    type: 'select',
    name: 'primaryProvider',
    label: 'Primary AI Provider',
    helpText: 'Which AI provider to use first (requires API key configured above)',
    options: [
      { label: 'Claude 3.5 Haiku (Anthropic)', value: 'claude' },
      { label: 'GPT-4o Mini (OpenAI)', value: 'openai' },
      { label: 'DeepSeek V3', value: 'deepseek' },
    ],
    defaultValue: ['claude'],
    scope: 'installation',
  },
  {
    type: 'select',
    name: 'fallbackProvider',
    label: 'Fallback AI Provider',
    helpText: 'Which provider to use if primary fails (or "None" to disable fallback)',
    options: [
      { label: 'GPT-4o Mini (OpenAI)', value: 'openai' },
      { label: 'Claude 3.5 Haiku (Anthropic)', value: 'claude' },
      { label: 'DeepSeek V3', value: 'deepseek' },
      { label: 'None (no fallback)', value: 'none' },
    ],
    defaultValue: ['openai'],
    scope: 'installation',
  },

  // ===== Budget & Cost Controls =====
  {
    type: 'number',
    name: 'dailyBudgetLimit',
    label: 'Daily Budget Limit (USD)',
    helpText: 'Maximum AI spend per day in USD. System will stop AI analysis when exceeded.',
    defaultValue: 5,
    scope: 'installation',
  },
  {
    type: 'number',
    name: 'monthlyBudgetLimit',
    label: 'Monthly Budget Limit (USD)',
    helpText: 'Maximum AI spend per month in USD. System will stop AI analysis when exceeded.',
    defaultValue: 150,
    scope: 'installation',
  },
  {
    type: 'boolean',
    name: 'budgetAlertThreshold50',
    label: 'Alert at 50% Budget',
    helpText: 'Log warning when 50% of daily/monthly budget is used',
    defaultValue: true,
    scope: 'installation',
  },
  {
    type: 'boolean',
    name: 'budgetAlertThreshold75',
    label: 'Alert at 75% Budget',
    helpText: 'Log warning when 75% of daily/monthly budget is used',
    defaultValue: true,
    scope: 'installation',
  },
  {
    type: 'boolean',
    name: 'budgetAlertThreshold90',
    label: 'Alert at 90% Budget',
    helpText: 'Log warning when 90% of daily/monthly budget is used',
    defaultValue: true,
    scope: 'installation',
  },

  // ===== Dry-Run Mode =====
  {
    type: 'boolean',
    name: 'dryRunMode',
    label: 'Enable Dry-Run Mode (Global)',
    helpText: 'When enabled, all actions are logged but NOT executed. Recommended for initial testing.',
    defaultValue: true,
    scope: 'installation',
  },
  {
    type: 'boolean',
    name: 'dryRunLogDetails',
    label: 'Log Detailed Dry-Run Actions',
    helpText: 'Log detailed information about what WOULD happen in dry-run mode',
    defaultValue: true,
    scope: 'installation',
  },

  // ===== Rule Management =====
  {
    type: 'paragraph',
    name: 'rulesJson',
    label: 'Rules Configuration (JSON)',
    helpText: 'Configure moderation rules in JSON format. See documentation for examples. Leave empty to use default rules.',
    defaultValue: '',
    scope: 'installation',
  },
]);

// Add menu action for settings (future Phase 5)
Devvit.addMenuItem({
  label: 'AI Automod Settings',
  location: 'subreddit',
  onPress: async (_event, context) => {
    context.ui.showToast('Phase 4: Settings UI - Configure in Subreddit Settings');
  },
});

// Cost Dashboard Menu Item (Phase 4.4)
Devvit.addMenuItem({
  label: 'View AI Costs',
  location: 'subreddit',
  onPress: async (_event, context) => {
    try {
      const dashboard = await renderCostDashboard(context);
      context.ui.showToast({
        text: dashboard,
        appearance: 'neutral',
      });
    } catch (error) {
      console.error('[CostDashboard] Error rendering dashboard:', error);
      context.ui.showToast('Error loading cost dashboard. Check logs for details.');
    }
  },
});

// Register event handlers
console.log('[AI Automod] Registering event handlers...');

// Handle new post submissions
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: handlePostSubmit,
});

// Handle new comment submissions
Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: handleCommentSubmit,
});

// Handle app installation (initialize default rules)
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    console.log('[AppInstall] App installed, initializing default rules...');
    try {
      await initializeDefaultRules(context);
    } catch (error) {
      console.error('[AppInstall] Failed to initialize default rules:', error);
      // Don't throw - let the app continue even if initialization fails
      // PostSubmit handler has fallback initialization as safety net
    }
  },
});

console.log('[AI Automod] Event handlers registered successfully');
console.log('[AI Automod] Phase 1: Foundation & Setup');
console.log('[AI Automod] Monitoring: PostSubmit, CommentSubmit, AppInstall');

// Export the app
export default Devvit;
