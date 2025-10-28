/**
 * Type definitions for the configurable rules engine
 *
 * This module defines all interfaces and types for the rules-based moderation system
 * that evaluates both hard rules (karma checks, regex, etc.) and AI-powered rules
 * to determine moderation actions.
 *
 * @module types/rules
 */

import { UserProfile, UserPostHistory, CurrentPost } from './profile.js';
import { AIQuestionBatchResult } from './ai.js';

/**
 * Comparison operators for numeric fields
 */
export type ComparisonOperator = '<' | '>' | '<=' | '>=' | '==' | '!=';

/**
 * Text matching operators
 * - contains/not_contains: Case-sensitive substring matching
 * - contains_i/not_contains_i: Case-insensitive substring matching
 */
export type TextOperator =
  | 'contains'
  | 'not_contains'
  | 'contains_i'
  | 'not_contains_i';

/**
 * Array membership operators
 * - in: Value is in array
 * - not_in: Value is not in array
 */
export type ArrayOperator = 'in' | 'not_in';

/**
 * Regular expression operators
 * - regex: Case-sensitive pattern matching
 * - regex_i: Case-insensitive pattern matching
 */
export type RegexOperator = 'regex' | 'regex_i';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * All supported condition operators
 */
export type ConditionOperator =
  | ComparisonOperator
  | TextOperator
  | ArrayOperator
  | RegexOperator;

/**
 * Moderation actions that can be taken
 * - APPROVE: Explicitly approve the post
 * - FLAG: Flag post for manual moderator review
 * - REMOVE: Automatically remove the post
 * - COMMENT: Post an automated comment (can be combined with other actions)
 */
export type ModerationAction = 'APPROVE' | 'FLAG' | 'REMOVE' | 'COMMENT';

/**
 * Condition structure supporting both leaf and nested conditions
 *
 * A condition can be either:
 * 1. A leaf condition: field operator value (e.g., profile.karma > 100)
 * 2. A nested condition: logical operator combining multiple conditions
 */
export interface Condition {
  // Leaf condition fields
  /** Field path in dot notation (e.g., "profile.commentKarma") */
  field?: string;
  /** Comparison operator */
  operator?: ConditionOperator;
  /** Expected value to compare against */
  value?: any;

  // Nested condition fields
  /** Child conditions (for AND/OR logic) */
  rules?: Condition[];
  /** Logical operator combining child conditions */
  logicalOperator?: LogicalOperator;
}

/**
 * Action configuration
 * Defines what happens when a rule matches
 */
export interface ActionConfig {
  /** Reason for the action (supports variable substitution with {field.path}) */
  reason: string;
  /** Comment text to post (for COMMENT action or REMOVE with explanation) */
  comment?: string | null;
  /** Custom variables for substitution in reason/comment text */
  variables?: Record<string, string>;
}

/**
 * Base rule interface
 * Common fields for all rule types
 */
export interface BaseRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule type discriminator */
  type: 'HARD' | 'AI';
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Rule priority (higher values evaluated first, range: 1-1000) */
  priority: number;
  /** Content type this rule applies to (defaults to 'submission' if missing) */
  contentType?: 'submission' | 'post' | 'comment' | 'any';
  /** Subreddit this rule applies to (null = global rule) */
  subreddit?: string | null;
  /** Root condition tree */
  conditions: Condition;
  /** Action to take if rule matches */
  action: ModerationAction;
  /** Action configuration */
  actionConfig: ActionConfig;
  /** Creation timestamp (milliseconds since epoch) */
  createdAt: number;
  /** Last update timestamp (milliseconds since epoch) */
  updatedAt: number;
}

/**
 * Hard rule - evaluates without AI analysis
 * Examples: karma checks, regex patterns, domain filtering
 */
export interface HardRule extends BaseRule {
  type: 'HARD';
}

/**
 * AI rule - requires AI analysis to evaluate
 * Must reference AI analysis results in conditions
 */
export interface AIRule extends BaseRule {
  type: 'AI';
  /** AI question this rule depends on */
  aiQuestion: {
    /** Question identifier */
    id: string;
    /** Natural language question */
    question: string;
    /** Optional additional context for the question */
    context?: string;
  };
}

/**
 * Union type for type-safe rule handling
 */
export type Rule = HardRule | AIRule;

/**
 * Rule set for a subreddit
 * Contains all rules applicable to a specific subreddit
 */
export interface RuleSet {
  /** Subreddit name ('global' for global rules) */
  subreddit: string;
  /** Whether dry-run mode is enabled (log actions but don't execute) */
  dryRunMode: boolean;
  /** Array of rules sorted by priority */
  rules: Rule[];
  /** Last update timestamp (milliseconds since epoch) */
  updatedAt: number;
}

/**
 * Rule evaluation context
 * Contains all data needed to evaluate a rule
 */
export interface RuleEvaluationContext {
  /** User profile data */
  profile: UserProfile;
  /** User post history */
  postHistory: UserPostHistory;
  /** Current post being evaluated */
  currentPost: CurrentPost;
  /** AI analysis results (optional, only present for AI rules) */
  aiAnalysis?: AIQuestionBatchResult;
  /** Subreddit name */
  subreddit: string;
}

/**
 * Rule evaluation result
 * Returned after evaluating all rules for a post
 */
export interface RuleEvaluationResult {
  /** Action to take */
  action: ModerationAction;
  /** Reason for the action (with variables substituted) */
  reason: string;
  /** Comment text (with variables substituted) */
  comment?: string | null;
  /** ID of the rule that matched */
  matchedRule: string;
  /** Confidence score (0-100, always 100 for hard rules) */
  confidence: number;
  /** Whether this is a dry-run (no action taken) */
  dryRun: boolean;
}

/**
 * Result of executing a moderation action
 */
export interface ActionExecutionResult {
  /** Whether action was executed successfully */
  success: boolean;
  /** Action that was executed */
  action: ModerationAction;
  /** Error message if execution failed */
  error?: string;
  /** Whether this was a dry-run (logged only, not executed) */
  dryRun: boolean;
  /** Details about what was done */
  details?: {
    /** For FLAG: report reason used */
    reportReason?: string;
    /** For REMOVE: whether comment was added */
    commentAdded?: boolean;
    /** For COMMENT: comment text posted */
    commentText?: string;
  };
}

/**
 * Field type information for validation
 * Describes the type and purpose of a field that can be referenced in rules
 */
export interface FieldTypeInfo {
  /** Field data type */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Full field path in dot notation */
  path: string;
  /** Human-readable description */
  description: string;
}

/**
 * Available fields for rule conditions
 * Maps field paths to their type information for validation and documentation
 */
export const AVAILABLE_FIELDS: Record<string, FieldTypeInfo> = {
  // Profile fields
  'profile.username': {
    type: 'string',
    path: 'profile.username',
    description: 'Reddit username',
  },
  'profile.accountAgeInDays': {
    type: 'number',
    path: 'profile.accountAgeInDays',
    description: 'Account age in days',
  },
  'profile.commentKarma': {
    type: 'number',
    path: 'profile.commentKarma',
    description: 'Comment karma points',
  },
  'profile.postKarma': {
    type: 'number',
    path: 'profile.postKarma',
    description: 'Post karma points',
  },
  'profile.totalKarma': {
    type: 'number',
    path: 'profile.totalKarma',
    description: 'Total karma (comment + post)',
  },
  'profile.emailVerified': {
    type: 'boolean',
    path: 'profile.emailVerified',
    description: 'Whether email is verified',
  },
  'profile.isModerator': {
    type: 'boolean',
    path: 'profile.isModerator',
    description: 'Whether user is a moderator',
  },
  'profile.hasUserFlair': {
    type: 'boolean',
    path: 'profile.hasUserFlair',
    description: 'Whether user has flair',
  },
  'profile.userFlairText': {
    type: 'string',
    path: 'profile.userFlairText',
    description: 'User flair text',
  },
  'profile.hasPremium': {
    type: 'boolean',
    path: 'profile.hasPremium',
    description: 'Whether user has Reddit Premium',
  },
  'profile.isVerified': {
    type: 'boolean',
    path: 'profile.isVerified',
    description: 'Whether account is verified',
  },

  // Current post fields
  'currentPost.title': {
    type: 'string',
    path: 'currentPost.title',
    description: 'Post title',
  },
  'currentPost.body': {
    type: 'string',
    path: 'currentPost.body',
    description: 'Post body text',
  },
  'currentPost.type': {
    type: 'string',
    path: 'currentPost.type',
    description: 'Post type (text, link, image, etc.)',
  },
  'currentPost.urls': {
    type: 'array',
    path: 'currentPost.urls',
    description: 'URLs found in post',
  },
  'currentPost.domains': {
    type: 'array',
    path: 'currentPost.domains',
    description: 'Domains from URLs',
  },
  'currentPost.wordCount': {
    type: 'number',
    path: 'currentPost.wordCount',
    description: 'Word count (title + body)',
  },
  'currentPost.charCount': {
    type: 'number',
    path: 'currentPost.charCount',
    description: 'Character count (title + body)',
  },
  'currentPost.bodyLength': {
    type: 'number',
    path: 'currentPost.bodyLength',
    description: 'Body length in characters',
  },
  'currentPost.titleLength': {
    type: 'number',
    path: 'currentPost.titleLength',
    description: 'Title length in characters',
  },
  'currentPost.hasMedia': {
    type: 'boolean',
    path: 'currentPost.hasMedia',
    description: 'Whether post has media',
  },
  'currentPost.linkUrl': {
    type: 'string',
    path: 'currentPost.linkUrl',
    description: 'Link URL for link posts',
  },
  'currentPost.isEdited': {
    type: 'boolean',
    path: 'currentPost.isEdited',
    description: 'Whether post has been edited',
  },

  // Post history fields
  'postHistory.totalPosts': {
    type: 'number',
    path: 'postHistory.totalPosts',
    description: 'Total number of posts',
  },
  'postHistory.totalComments': {
    type: 'number',
    path: 'postHistory.totalComments',
    description: 'Total number of comments',
  },
  'postHistory.subreddits': {
    type: 'array',
    path: 'postHistory.subreddits',
    description: 'Subreddits user has posted in',
  },

  // AI analysis fields are dynamically validated
  // Format: aiAnalysis.answers.{questionId}.{field}
  // where field can be: answer, confidence, reasoning
};

/**
 * Result of schema validation with typed data
 *
 * Generic interface for validation operations that may succeed or fail.
 * Used by RuleSchemaValidator to return validated and typed data along
 * with any errors or warnings encountered during validation.
 *
 * @template T - The type of data being validated
 *
 * @example
 * ```typescript
 * const result: ValidationResult<RuleSet> = await validateRules(json);
 * if (result.success) {
 *   console.log('Valid rules:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated and typed data (only present if success = true) */
  data?: T;
  /** Error message (only present if success = false) */
  error?: string;
  /** Non-fatal warnings that don't prevent validation success */
  warnings?: string[];
  /** Additional validation details for debugging */
  details?: string;
}
