/**
 * Default rule sets for target subreddits
 *
 * Starting with empty rule sets. Users can configure custom rules via
 * the settings UI (JSON configuration) if needed.
 *
 * @module rules/defaults
 */

import { RuleSet } from '../types/rules.js';

/**
 * Default rules for FriendsOver40 subreddit
 * Empty by default - configure via settings UI
 */
export const FRIENDSOVER40_RULES: RuleSet = {
  subreddit: 'FriendsOver40',
  dryRunMode: true,
  updatedAt: Date.now(),
  rules: [],
};

/**
 * Default rules for FriendsOver50 subreddit
 * Empty by default - configure via settings UI
 */
export const FRIENDSOVER50_RULES: RuleSet = {
  subreddit: 'FriendsOver50',
  dryRunMode: true,
  updatedAt: Date.now(),
  rules: [],
};

/**
 * Default rules for bitcointaxes subreddit
 * Empty by default - configure via settings UI
 */
export const BITCOINTAXES_RULES: RuleSet = {
  subreddit: 'bitcointaxes',
  dryRunMode: true,
  updatedAt: Date.now(),
  rules: [],
};

/**
 * Default rules map for easy lookup
 */
export const DEFAULT_RULES: Record<string, RuleSet> = {
  FriendsOver40: FRIENDSOVER40_RULES,
  FriendsOver50: FRIENDSOVER50_RULES,
  bitcointaxes: BITCOINTAXES_RULES,
};
