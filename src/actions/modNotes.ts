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
 * Mod Log Helper
 *
 * Creates Reddit mod log entries for AI Automod actions to provide
 * transparency and audit trail for moderators.
 *
 * Format:
 * AI Automod: [Action]
 * Rule: [Rule Name]
 * Trust: [X]/100 | Age: [X]d | Karma: [X]
 * AI: [X]% ([Provider])
 * [Reasoning...]
 */

import { TriggerContext } from '@devvit/public-api';

/**
 * Options for creating a mod log entry
 */
export interface ModLogOptions {
  userId: string;
  username: string;
  subreddit: string;
  contentId: string; // Post or comment ID (t3_ or t1_ prefix)
  action: 'REMOVE' | 'FLAG' | 'COMMENT';
  ruleName: string;
  trustScore: number;
  accountAge: number; // milliseconds
  totalKarma: number;
  confidence?: number;
  aiProvider?: string; // 'claude' | 'openai' | 'openai-compatible'
  aiModel?: string;
  aiReasoning?: string;
  reason?: string; // For COMMENT actions
}

/**
 * Get display-friendly provider name
 */
function getProviderDisplayName(provider: string, model?: string): string {
  switch (provider) {
    case 'claude':
      return 'Claude 3.5 Haiku';
    case 'openai':
      // Check if it's the mini model or something else
      if (model?.includes('gpt-4o-mini')) {
        return 'OpenAI GPT-4o-mini';
      } else if (model?.includes('gpt-4')) {
        return 'OpenAI GPT-4';
      }
      return 'OpenAI';
    case 'openai-compatible':
      // Use the custom model name if available
      if (model && model !== 'configurable') {
        return model;
      }
      return 'Custom AI';
    default:
      return 'AI';
  }
}

/**
 * Truncate text at word boundary
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find last space before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace);
  }

  // No space found, truncate at maxLength
  return truncated;
}

/**
 * Format mod log description text
 */
function formatModLogDescription(options: ModLogOptions): string {
  // Action name
  const action =
    options.action === 'REMOVE'
      ? 'Removed'
      : options.action === 'FLAG'
        ? 'Flagged'
        : 'Warning issued';

  // Age in days
  const ageInDays = Math.floor(
    options.accountAge / (1000 * 60 * 60 * 24)
  );

  // Build note
  let note = `AI Automod: ${action}\n`;
  note += `Rule: ${options.ruleName.substring(0, 30)}\n`;
  note += `Trust: ${options.trustScore}/100 | Age: ${ageInDays}d | Karma: ${options.totalKarma}\n`;

  // Add AI confidence and provider if available
  if (options.confidence && options.aiProvider) {
    const providerName = getProviderDisplayName(
      options.aiProvider,
      options.aiModel
    );
    note += `AI: ${options.confidence}% (${providerName})\n`;
  }

  // Calculate remaining space for reasoning
  const remainingSpace = 250 - note.length;
  const reasoningMaxLength = remainingSpace - 5; // Reserve 5 chars for "..."

  // Add reasoning if space available
  if (reasoningMaxLength > 20) {
    let reasoningText = options.aiReasoning || options.reason || '';

    if (reasoningText.length > 0) {
      const truncated = truncateAtWordBoundary(
        reasoningText,
        reasoningMaxLength
      );
      note += truncated;

      // Add ellipsis if truncated
      if (reasoningText.length > reasoningMaxLength) {
        note += '...';
      }
    }
  }

  // Hard limit at 250 characters (safety check)
  return note.substring(0, 250);
}

/**
 * Map action type to mod log action string
 */
function getModLogAction(
  action: 'REMOVE' | 'FLAG' | 'COMMENT',
  contentId: string
): string {
  const isPost = contentId.startsWith('t3_');

  if (action === 'REMOVE') {
    return isPost ? 'removelink' : 'removecomment';
  } else if (action === 'FLAG') {
    return isPost ? 'reportlink' : 'reportcomment';
  } else {
    return isPost ? 'commentlink' : 'commentcomment';
  }
}

/**
 * Add mod log entry for AI Automod action
 *
 * @param context - Devvit trigger context
 * @param options - Mod log options
 * @returns Promise that resolves when log entry is created
 */
export async function addAutomodLogEntry(
  context: TriggerContext,
  options: ModLogOptions
): Promise<void> {
  try {
    // Check if mod log entries are enabled
    const enableModLog = await context.settings.get<boolean>('enableModLog');
    if (enableModLog === false) {
      console.log('Mod log entries disabled, skipping');
      return;
    }

    // Format description text
    const description = formatModLogDescription(options);

    // Determine mod log action
    const modLogAction = getModLogAction(options.action, options.contentId);

    console.log('Creating mod log entry:', {
      user: options.username,
      action: options.action,
      modLogAction,
      confidence: options.confidence,
      descriptionLength: description.length,
    });

    // Create mod log entry
    await context.modLog.add({
      action: modLogAction,
      target: options.contentId,
      details: `Rule: ${options.ruleName}`,
      description: description,
    });

    console.log('Mod log entry created successfully');
  } catch (error) {
    // Log error but don't throw - mod log failure shouldn't block action execution
    console.error('Failed to create mod log entry:', {
      error: error instanceof Error ? error.message : String(error),
      user: options.username,
      action: options.action,
    });
  }
}
