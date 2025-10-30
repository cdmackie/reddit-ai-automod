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
 * App Installation Handler
 *
 * Initializes default rules when the app is first installed on a subreddit.
 * Uses atomic Redis locks to prevent race conditions during initialization.
 *
 * This handler is called when:
 * 1. App is installed on a subreddit via the developer console
 * 2. PostSubmit handler detects uninitialized rules (fallback safety)
 *
 * @module handlers/appInstall
 */

import { Context } from '@devvit/public-api';
import { DEFAULT_RULES } from '../rules/defaults.js';
import { RuleStorage } from '../rules/storage.js';
import { RuleSet } from '../types/rules.js';

/**
 * Initialize default rules for a subreddit
 *
 * Strategy:
 * 1. Acquire atomic lock (prevents concurrent initialization)
 * 2. Check if rules already exist (don't overwrite)
 * 3. Detect subreddit and load appropriate defaults
 * 4. Save to Redis via RuleStorage
 * 5. Mark as initialized
 * 6. Release lock (always, even on error)
 *
 * @param context - Devvit context with redis access
 */
export async function initializeDefaultRules(context: Context): Promise<void> {
  const subreddit = await context.reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;
  const lockKey = `automod:init:lock:${subredditName}`;

  console.log(`[AppInstall] Initializing default rules for r/${subredditName}...`);

  // Atomic lock acquisition (60-second expiration, only if not exists)
  // Using NX option: only set if key doesn't exist
  const acquired = await context.redis.set(lockKey, '1', {
    expiration: new Date(Date.now() + 60000), // 60 seconds from now
    nx: true, // Only set if not exists (atomic lock)
  });

  if (!acquired) {
    console.log(
      `[AppInstall] Another process is already initializing rules for r/${subredditName}`
    );
    return;
  }

  try {
    // Initialize RuleStorage
    const ruleStorage = new RuleStorage(context.redis);

    // Check if rules already exist
    const existing = await ruleStorage.getRuleSet(subredditName);
    if (existing && existing.rules && existing.rules.length > 0) {
      console.log(
        `[AppInstall] Rules already exist for r/${subredditName} (${existing.rules.length} rules)`
      );
      return;
    }

    // Detect subreddit and load appropriate defaults
    const defaults = getDefaultRuleSetForSubreddit(subredditName);

    // Save to Redis via RuleStorage
    console.log(
      `[AppInstall] Saving ${defaults.rules.length} default rules for r/${subredditName}...`
    );
    await ruleStorage.saveRuleSet(defaults);

    // Mark as initialized
    await context.redis.set(`automod:initialized:${subredditName}`, 'true');

    console.log(
      `[AppInstall] ✅ Default rules initialized successfully for r/${subredditName}`
    );
  } catch (error) {
    console.error(
      `[AppInstall] ❌ Error initializing default rules for r/${subredditName}:`,
      error
    );
    throw error;
  } finally {
    // Always release lock, even on error
    await context.redis.del(lockKey);
  }
}

/**
 * Get appropriate default rule set for a subreddit
 *
 * Matches subreddit names (case-insensitive) to default rule sets.
 * Falls back to global defaults for unknown subreddits.
 *
 * @param subredditName - Subreddit name (without r/ prefix)
 * @returns Default RuleSet for the subreddit
 */
function getDefaultRuleSetForSubreddit(subredditName: string): RuleSet {
  // Normalize subreddit name (case-insensitive comparison)
  const normalized = subredditName.toLowerCase();

  if (normalized === 'friendsover40') {
    console.log(`[AppInstall] Using FriendsOver40 default rules`);
    return DEFAULT_RULES.FriendsOver40;
  }

  if (normalized === 'friendsover50') {
    console.log(`[AppInstall] Using FriendsOver50 default rules`);
    return DEFAULT_RULES.FriendsOver50;
  }

  if (normalized === 'bitcointaxes') {
    console.log(`[AppInstall] Using bitcointaxes default rules`);
    return DEFAULT_RULES.bitcointaxes;
  }

  // Default to global rules for other subreddits
  console.log(
    `[AppInstall] Using global default rules (no specific ruleset for r/${subredditName})`
  );
  return DEFAULT_RULES.global;
}

/**
 * Check if initialization has been completed
 *
 * Checks the initialization flag in Redis to determine if default rules
 * have already been set up for a subreddit.
 *
 * @param context - Devvit context with redis access
 * @param subredditName - Subreddit name
 * @returns true if initialization flag is set
 */
export async function isInitialized(
  context: Context,
  subredditName: string
): Promise<boolean> {
  const flag = await context.redis.get(`automod:initialized:${subredditName}`);
  return flag === 'true';
}
