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
 * Comment Templates for Moderation Actions
 *
 * Provides default templates for REMOVE and COMMENT actions.
 * Moderators can override these via settings.
 */

/**
 * Default template for REMOVE action comments
 * Posted when content is removed by AI moderation
 */
export const DEFAULT_REMOVE_TEMPLATE = `Your {contentType} has been automatically removed by our AI moderation system.

**Reason:** {reason}

This action was taken based on an AI analysis of your post history and content.

---
*This is an automated action. To appeal [message the mods](https://www.reddit.com/message/compose?to=r/{subreddit}). Replies are not monitored.*`;

/**
 * Default template for COMMENT action (informational notice)
 * Posted as an informational comment without any moderation action
 */
export const DEFAULT_COMMENT_TEMPLATE = `{reason}

---
*This is an automated comment. For any questions [message the mods](https://www.reddit.com/message/compose?to=r/{subreddit}). Replies are not monitored.*`;

/**
 * Variables that can be used in templates
 */
export interface TemplateVariables {
  /** The reason from the rule configuration */
  reason: string;
  /** The subreddit name (without r/ prefix) */
  subreddit: string;
  /** Type of content being moderated */
  contentType: 'post' | 'comment';
  /** AI confidence score (optional) */
  confidence?: number;
}

/**
 * Format a template by replacing variables
 *
 * Supported variables:
 * - {reason} - The reason from the rule
 * - {subreddit} - The subreddit name
 * - {contentType} - "post" or "comment"
 * - {confidence} - AI confidence score (if provided)
 *
 * @param template - The template string with variables
 * @param variables - Values to substitute
 * @returns Formatted template with variables replaced
 */
export function formatTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let formatted = template;

  // Replace all variables
  formatted = formatted.replace(/{reason}/g, variables.reason);
  formatted = formatted.replace(/{subreddit}/g, variables.subreddit);
  formatted = formatted.replace(/{contentType}/g, variables.contentType);

  // Replace confidence if provided, otherwise remove the placeholder
  if (variables.confidence !== undefined) {
    formatted = formatted.replace(/{confidence}/g, variables.confidence.toString());
  } else {
    // Remove any {confidence} placeholders if confidence not provided
    formatted = formatted.replace(/{confidence}/g, '[N/A]');
  }

  return formatted;
}
