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
 * Mod Notes Helper
 *
 * Creates Reddit mod notes for AI Automod actions to provide
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
import { UserNoteLabel } from '@devvit/public-api';

/**
 * Options for creating a mod note
 */
export interface ModNoteOptions {
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
 * Format mod note text (max 250 characters)
 */
function formatModNote(options: ModNoteOptions): string {
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
 * Determine appropriate label based on action and confidence
 */
function getModNoteLabel(
  action: 'REMOVE' | 'FLAG' | 'COMMENT',
  confidence?: number
): UserNoteLabel | undefined {
  // Only apply labels to REMOVE actions
  if (action !== 'REMOVE' || !confidence) {
    return undefined;
  }

  // High confidence removal - likely spam
  if (confidence >= 90) {
    return 'SPAM_WATCH';
  }

  // Medium-high confidence - spam warning
  if (confidence >= 70) {
    return 'SPAM_WARNING';
  }

  // Lower confidence - no specific label
  return undefined;
}

/**
 * Add mod note for AI Automod action
 *
 * @param context - Devvit trigger context
 * @param options - Mod note options
 * @returns Promise that resolves when note is created
 */
export async function addAutomodNote(
  context: TriggerContext,
  options: ModNoteOptions
): Promise<void> {
  try {
    // Check if mod notes are enabled
    const enableModNotes = await context.settings.get<boolean>('enableModNotes');
    if (enableModNotes === false) {
      console.log('Mod notes disabled, skipping');
      return;
    }

    // Format note text
    const noteText = formatModNote(options);

    // Determine label
    const label = getModNoteLabel(options.action, options.confidence);

    console.log('Creating mod note:', {
      user: options.username,
      action: options.action,
      confidence: options.confidence,
      noteLength: noteText.length,
      label,
    });

    // Create mod note
    await context.reddit.addModNote({
      subreddit: options.subreddit,
      user: options.username,
      note: noteText,
      redditId: options.contentId as `t3_${string}` | `t1_${string}`,
      label,
    });

    console.log('Mod note created successfully');
  } catch (error) {
    // Log error but don't throw - mod note failure shouldn't block action execution
    console.error('Failed to create mod note:', {
      error: error instanceof Error ? error.message : String(error),
      user: options.username,
      action: options.action,
    });
  }
}
