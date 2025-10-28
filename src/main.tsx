import { Devvit } from '@devvit/public-api';
import { handlePostSubmit } from './handlers/postSubmit';
import { handleCommentSubmit } from './handlers/commentSubmit';
import { renderCostDashboard } from './dashboard/costDashboardUI';
import { initializeDefaultRules } from './handlers/appInstall';
import { getPostAnalysis } from './ui/postAnalysis';
import { sendDailyDigest } from './notifications/modmailDigest';

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
  // ===== Provider Selection =====
  {
    type: 'select',
    name: 'primaryProvider',
    label: 'Primary AI Provider',
    helpText: 'Which AI provider to use first (configure API key below)',
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

  // ===== AI Provider API Keys =====
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

  // ===== Daily Digest Settings =====
  {
    type: 'boolean',
    name: 'dailyDigestEnabled',
    label: 'Enable Daily Digest',
    helpText: 'Send a daily summary of moderation actions',
    defaultValue: false,
    scope: 'installation',
  },
  {
    type: 'select',
    name: 'dailyDigestRecipient',
    label: 'Send Daily Digest To',
    helpText: 'Where to send the daily digest',
    options: [
      { label: 'Mod Notifications (all moderators)', value: 'all' },
      { label: 'Specific moderator(s)', value: 'specific' },
    ],
    defaultValue: ['all'],
    scope: 'installation',
  },
  {
    type: 'string',
    name: 'dailyDigestRecipientUsernames',
    label: 'Moderator Username(s) for Daily Digest',
    helpText: 'Comma-separated usernames without u/ prefix (e.g., \'user1, user2\'). Only used if \'Specific moderator(s)\' selected above.',
    scope: 'installation',
  },
  {
    type: 'string',
    name: 'dailyDigestTime',
    label: 'Daily Digest Time (UTC)',
    helpText: 'Time to send digest in HH:MM format (24-hour, UTC). Example: 09:00',
    defaultValue: '09:00',
    scope: 'installation',
  },

  // ===== Real-time Notification Settings =====
  {
    type: 'boolean',
    name: 'realtimeNotificationsEnabled',
    label: 'Enable Real-time Notifications',
    helpText: 'Send immediate notification after each moderation action (useful for debugging)',
    defaultValue: false,
    scope: 'installation',
  },
  {
    type: 'select',
    name: 'realtimeRecipient',
    label: 'Send Real-time Notifications To',
    helpText: 'Where to send real-time notifications',
    options: [
      { label: 'Mod Notifications (all moderators)', value: 'all' },
      { label: 'Specific moderator(s)', value: 'specific' },
    ],
    defaultValue: ['all'],
    scope: 'installation',
  },
  {
    type: 'string',
    name: 'realtimeRecipientUsernames',
    label: 'Moderator Username(s) for Real-time',
    helpText: 'Comma-separated usernames without u/ prefix (e.g., \'user1, user2\'). Only used if \'Specific moderator(s)\' selected above.',
    scope: 'installation',
  },
]);

// Register menu items
console.log('[AI Automod] Registering menu items...');

// Add menu action for settings (future Phase 5)
Devvit.addMenuItem({
  label: 'AI Automod Settings',
  location: 'subreddit',
  onPress: async (_event, context) => {
    context.ui.showToast('Phase 4: Settings UI - Configure in Subreddit Settings');
  },
});
console.log('[AI Automod] ✓ Registered: AI Automod Settings (subreddit)');

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
console.log('[AI Automod] ✓ Registered: View AI Costs (subreddit)');

// Post Analysis Menu Item (Phase 5)
// NOTE: Post menu items don't appear during playtest mode (Devvit limitation)
// This will work after production upload with 'devvit upload'
Devvit.addMenuItem({
  label: 'View AI Analysis',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    console.log('[PostAnalysis] Menu item clicked!');
    const postId = event.targetId;
    console.log(`[PostAnalysis] Fetching analysis for post: ${postId}`);

    const analysis = await getPostAnalysis(context, postId);
    console.log(`[PostAnalysis] Analysis retrieved, showing toast`);

    context.ui.showToast({
      text: analysis,
      appearance: 'neutral',
    });
  },
});
console.log('[AI Automod] ✓ Registered: View AI Analysis (post)');

console.log('[AI Automod] Menu items registration complete');

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

// Daily Digest Scheduler (Phase 5)
Devvit.addSchedulerJob({
  name: 'dailyDigest',
  cron: '0 9 * * *', // Run at 9:00 AM UTC daily (can be customized via settings)
  onRun: async (_event, context) => {
    console.log('[DailyDigest] Scheduler triggered');
    try {
      await sendDailyDigest(context);
    } catch (error) {
      console.error('[DailyDigest] Error in scheduled job:', error);
      // Don't throw - we don't want to crash the scheduler
    }
  },
});

console.log('[AI Automod] Event handlers registered successfully');
console.log('[AI Automod] Phase 1: Foundation & Setup');
console.log('[AI Automod] Monitoring: PostSubmit, CommentSubmit, AppInstall, DailyDigest');

// Export the app
export default Devvit;
