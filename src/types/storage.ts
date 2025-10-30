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
 * Type definitions for Redis storage operations
 */

/**
 * Moderation action types
 */
export enum ModAction {
  APPROVE = 'APPROVE',
  REMOVE = 'REMOVE',
  SPAM = 'SPAM',
  FLAG = 'FLAG',
  COMMENT = 'COMMENT',
  BAN = 'BAN',
  IGNORE = 'IGNORE',
}

/**
 * Audit log entry for tracking all moderation actions
 */
export interface AuditLog {
  /** Unique ID for this audit entry */
  id: string;
  /** Action taken */
  action: ModAction;
  /** Timestamp of the action */
  timestamp: Date;
  /** User ID who was affected */
  userId: string;
  /** Content ID (post/comment) that was moderated */
  contentId: string;
  /** Reason for the action */
  reason: string;
  /** Rule that triggered the action (if applicable) */
  ruleId?: string;
  /** AI confidence score (0-100) if AI was involved */
  confidence?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Redis key patterns used throughout the app
 */
export enum StorageKey {
  /** Audit logs: audit:{contentId} */
  AUDIT_LOG = 'audit',
  /** Statistics: stats:{date} */
  STATS = 'stats',
  /** Configuration: config:{key} */
  CONFIG = 'config',
  /** Cache: cache:{hash} */
  CACHE = 'cache',
  /** Rules: rule:{ruleId} */
  RULE = 'rule',
  /** User profile cache: user:{userId}:profile */
  USER_PROFILE = 'user',
  /** User post history cache: user:{userId}:history */
  USER_HISTORY = 'user',
  /** User trust score: user:{userId}:trustScore */
  USER_TRUST_SCORE = 'user',
  /** Trusted user flag: user:{subreddit}:trusted:{userId} */
  TRUSTED_USER = 'user',
  /** User approved post count: user:{userId}:{subreddit}:approved */
  USER_APPROVED_COUNT = 'user',
}

/**
 * Helper to build Redis keys
 */
export const buildKey = (type: StorageKey, ...parts: string[]): string => {
  return [type, ...parts].join(':');
};

/**
 * Statistics data structure
 */
export interface Stats {
  /** Total posts processed */
  postsProcessed: number;
  /** Total comments processed */
  commentsProcessed: number;
  /** Total items removed */
  itemsRemoved: number;
  /** Total items approved */
  itemsApproved: number;
  /** Total items flagged for review */
  itemsFlagged: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}
