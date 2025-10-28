/**
 * Type definitions for the three-layer moderation pipeline
 *
 * This module defines all interfaces and types for the multi-layer moderation system:
 * - Layer 1: Built-in rules (fast, deterministic checks)
 * - Layer 2: OpenAI Moderation API (free, fast content moderation)
 * - Layer 3: Custom rules + AI analysis (existing system)
 *
 * The pipeline processes content through each layer in sequence, short-circuiting
 * on the first match to optimize performance and minimize AI API costs.
 *
 * @module types/moderation
 */

/**
 * OpenAI Moderation category names
 *
 * These categories are provided by OpenAI's Moderation API and detect
 * various types of harmful content.
 */
export type ModerationCategory =
  | 'hate'
  | 'hate/threatening'
  | 'harassment'
  | 'harassment/threatening'
  | 'self-harm'
  | 'self-harm/intent'
  | 'self-harm/instructions'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic';

/**
 * Moderation category result
 *
 * Represents the result for a single category from OpenAI Moderation API.
 */
export interface ModerationCategoryResult {
  /** Whether this category was flagged */
  flagged: boolean;
  /** Confidence score (0.0-1.0) for this category */
  score: number;
}

/**
 * OpenAI Moderation API response
 *
 * Structured response from OpenAI's Moderation API after analyzing content.
 * Includes detailed breakdown by category and overall flagged status.
 */
export interface ModerationResult {
  /** True if any category flagged */
  flagged: boolean;
  /** Boolean flags for each category */
  categories: Record<ModerationCategory, boolean>;
  /** Confidence scores (0.0-1.0) for each category */
  categoryScores: Record<ModerationCategory, number>;
  /** Convenience array of only the flagged categories */
  flaggedCategories: ModerationCategory[];
}

/**
 * Moderation configuration from settings
 *
 * Configuration for Layer 2 (OpenAI Moderation API) provided by
 * subreddit moderators via Devvit settings.
 */
export interface ModerationConfig {
  /** Whether OpenAI Moderation is enabled */
  enabled: boolean;
  /** Global threshold for flagging (0.0-1.0) */
  threshold: number;
  /** Which categories to enforce (others ignored) */
  categoriesToCheck: ModerationCategory[];
  /** Action to take when content is flagged */
  action: 'FLAG' | 'REMOVE' | 'COMMENT';
  /** Custom message for REMOVE/COMMENT actions */
  customMessage?: string;
  /** Always REMOVE for sexual/minors regardless of threshold */
  alwaysRemoveMinorSexual: boolean;
}

/**
 * Built-in rules configuration from settings
 *
 * Configuration for Layer 1 (Built-in Rules) provided by
 * subreddit moderators via Devvit settings.
 */
export interface BuiltInRulesConfig {
  /** Whether built-in rules are enabled */
  enabled: boolean;
  /** Array of configured rules */
  rules: BuiltInRule[];
}

/**
 * A single built-in rule
 *
 * Represents a fast, deterministic check that can be performed without
 * external API calls. Examples: account age + karma + external links.
 */
export interface BuiltInRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Conditions that must all be met for rule to match */
  conditions: {
    /** Account age condition (e.g., < 7 days) */
    accountAgeDays?: { operator: '<' | '>' | '<=' | '>='; value: number };
    /** Total karma condition (e.g., < 50) */
    totalKarma?: { operator: '<' | '>' | '<=' | '>='; value: number };
    /** Whether post must have external links */
    hasExternalLinks?: boolean;
    /** Whether email must be verified */
    isEmailVerified?: boolean;
  };
  /** Action to take if rule matches */
  action: 'FLAG' | 'REMOVE' | 'COMMENT';
  /** Custom message for the action */
  message?: string;
}

/**
 * Pipeline execution result
 *
 * Result of running content through the three-layer moderation pipeline.
 * Indicates which layer triggered (if any) and what action to take.
 */
export interface PipelineResult {
  /** Which layer triggered the action (or 'none' if all passed) */
  layerTriggered: 'none' | 'builtin' | 'moderation' | 'custom';
  /** Action to take on the content */
  action: 'APPROVE' | 'FLAG' | 'REMOVE' | 'COMMENT';
  /** Human-readable reason for the action */
  reason: string;
  /** Additional metadata about the decision */
  metadata?: {
    /** ID of the built-in rule that matched (Layer 1) */
    builtInRuleId?: string;
    /** OpenAI Moderation categories that were flagged (Layer 2) */
    moderationCategories?: ModerationCategory[];
    /** Confidence scores for flagged categories (Layer 2) */
    moderationScores?: Record<ModerationCategory, number>;
    /** ID of the custom rule that matched (Layer 3) */
    customRuleId?: string;
  };
}
