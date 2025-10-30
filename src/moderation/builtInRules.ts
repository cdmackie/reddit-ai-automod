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
 * New Account Checks Module (Layer 1)
 *
 * This module provides fast, deterministic moderation checks that don't require
 * external API calls. These checks execute first in the pipeline to catch common
 * spam patterns from new accounts quickly and reduce AI API usage.
 *
 * Supported Conditions:
 * - Account age (days since account creation)
 * - Total karma (comment karma + post karma)
 * - External links presence (URLs in post) - available for custom JSON rules
 * - Email verification status - available for custom JSON rules
 *
 * Common Use Cases:
 * - New account with low karma = FLAG/REMOVE
 * - Account age < 7 days and karma < 50 = FLAG
 *
 * Note: The simple settings UI (Layer 1) only exposes account age and karma checks.
 * External links and email verification are available for custom JSON rules.
 *
 * Performance: <1ms per evaluation (no I/O operations)
 *
 * @module moderation/builtInRules
 *
 * @example
 * ```typescript
 * import { evaluateBuiltInRules } from './builtInRules.js';
 *
 * const matchedRule = evaluateBuiltInRules(
 *   profile,
 *   post,
 *   config,
 *   correlationId
 * );
 *
 * if (matchedRule) {
 *   console.log('Rule matched:', matchedRule.name);
 * }
 * ```
 */

import { UserProfile, CurrentPost } from '../types/profile.js';
import { BuiltInRulesConfig, BuiltInRule } from '../types/moderation.js';

/**
 * Evaluate new account checks against user profile and post
 *
 * Iterates through enabled checks in priority order (first to last).
 * Returns the first matching check, or null if no checks match.
 *
 * All conditions in a check must be met (AND logic) for the check to match.
 * Undefined conditions are treated as "don't care" (always match).
 *
 * Performance: O(n) where n = number of enabled checks
 * Typical execution time: <1ms
 *
 * @param profile - User profile data
 * @param post - Current post being evaluated
 * @param config - New account checks configuration from settings
 * @param correlationId - Correlation ID for logging
 * @returns First matching check, or null if no match
 */
export function evaluateBuiltInRules(
  profile: UserProfile,
  post: CurrentPost,
  config: BuiltInRulesConfig,
  correlationId: string
): BuiltInRule | null {
  const startTime = Date.now();

  console.log('[BuiltInRules] Evaluating rules', {
    correlationId,
    username: profile.username,
    ruleCount: config.rules.length,
  });

  // Filter to enabled rules only
  const enabledRules = config.rules.filter((rule) => rule.enabled);

  if (enabledRules.length === 0) {
    console.log('[BuiltInRules] No enabled rules', { correlationId });
    return null;
  }

  // Evaluate each rule in order
  for (const rule of enabledRules) {
    const matches = evaluateRule(rule, profile, post, correlationId);

    if (matches) {
      const latencyMs = Date.now() - startTime;
      console.log('[BuiltInRules] Rule matched', {
        correlationId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.action,
        latencyMs,
      });
      return rule;
    }
  }

  const latencyMs = Date.now() - startTime;
  console.log('[BuiltInRules] No rules matched', {
    correlationId,
    evaluatedRules: enabledRules.length,
    latencyMs,
  });

  return null;
}

/**
 * Evaluate a single rule against profile and post
 *
 * All conditions in the rule must be met (AND logic) for a match.
 * Undefined conditions are ignored (treated as always matching).
 *
 * @param rule - Rule to evaluate
 * @param profile - User profile data
 * @param post - Current post being evaluated
 * @param correlationId - Correlation ID for logging
 * @returns true if rule matches, false otherwise
 * @private
 */
function evaluateRule(
  rule: BuiltInRule,
  profile: UserProfile,
  post: CurrentPost,
  correlationId: string
): boolean {
  const { conditions } = rule;

  console.log('[BuiltInRules] Evaluating rule', {
    correlationId,
    ruleId: rule.id,
    ruleName: rule.name,
  });

  // Check account age condition
  if (conditions.accountAgeDays !== undefined) {
    const { operator, value } = conditions.accountAgeDays;
    const accountAge = profile.accountAgeInDays;

    if (!compareNumber(accountAge, operator, value)) {
      console.log('[BuiltInRules] Account age condition failed', {
        correlationId,
        ruleId: rule.id,
        accountAge,
        operator,
        expectedValue: value,
      });
      return false;
    }
  }

  // Check total karma condition
  if (conditions.totalKarma !== undefined) {
    const { operator, value } = conditions.totalKarma;
    const karma = profile.totalKarma;

    if (!compareNumber(karma, operator, value)) {
      console.log('[BuiltInRules] Total karma condition failed', {
        correlationId,
        ruleId: rule.id,
        karma,
        operator,
        expectedValue: value,
      });
      return false;
    }
  }

  // Check external links condition
  if (conditions.hasExternalLinks !== undefined) {
    const hasLinks = post.urls.length > 0;
    const expectedHasLinks = conditions.hasExternalLinks;

    if (hasLinks !== expectedHasLinks) {
      console.log('[BuiltInRules] External links condition failed', {
        correlationId,
        ruleId: rule.id,
        hasLinks,
        expectedHasLinks,
        linkCount: post.urls.length,
      });
      return false;
    }
  }

  // Check email verified condition
  if (conditions.isEmailVerified !== undefined) {
    const isVerified = profile.emailVerified;
    const expectedVerified = conditions.isEmailVerified;

    if (isVerified !== expectedVerified) {
      console.log('[BuiltInRules] Email verified condition failed', {
        correlationId,
        ruleId: rule.id,
        isVerified,
        expectedVerified,
      });
      return false;
    }
  }

  // All conditions passed
  console.log('[BuiltInRules] All conditions passed', {
    correlationId,
    ruleId: rule.id,
  });
  return true;
}

/**
 * Compare two numbers using an operator
 *
 * @param actual - Actual value to compare
 * @param operator - Comparison operator
 * @param expected - Expected value
 * @returns true if comparison passes, false otherwise
 * @private
 */
function compareNumber(
  actual: number,
  operator: '<' | '>' | '<=' | '>=',
  expected: number
): boolean {
  switch (operator) {
    case '<':
      return actual < expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '>=':
      return actual >= expected;
    default:
      console.warn('[BuiltInRules] Unknown operator', { operator });
      return false;
  }
}
