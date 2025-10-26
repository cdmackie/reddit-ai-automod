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
