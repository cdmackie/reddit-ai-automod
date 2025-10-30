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
  updatedAt: Date.now(),
  rules: [],
};

/**
 * Default rules for FriendsOver50 subreddit
 * Empty by default - configure via settings UI
 */
export const FRIENDSOVER50_RULES: RuleSet = {
  subreddit: 'FriendsOver50',
  updatedAt: Date.now(),
  rules: [],
};

/**
 * Default rules for bitcointaxes subreddit
 * Empty by default - configure via settings UI
 */
export const BITCOINTAXES_RULES: RuleSet = {
  subreddit: 'bitcointaxes',
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
