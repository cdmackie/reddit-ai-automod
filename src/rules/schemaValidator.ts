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
 * Rule Schema Validator - Validates and migrates rule JSON configurations
 *
 * This module provides schema validation for rule configurations loaded from
 * Devvit settings. It ensures data integrity, validates required fields, and
 * provides a migration framework for future schema versions.
 *
 * Features:
 * - JSON syntax validation with error position extraction
 * - Required field validation with helpful warnings
 * - Rule structure validation (type, action, priority checks)
 * - AI question ID uniqueness validation
 * - Versioned schema support with migration framework
 * - Graceful error handling with fallback to defaults
 *
 * @module rules/schemaValidator
 */

import { Context } from '@devvit/public-api';
import { RuleSet, ValidationResult, ModerationAction } from '../types/rules.js';
import {
  FRIENDSOVER40_RULES,
  FRIENDSOVER50_RULES,
  BITCOINTAXES_RULES,
} from './defaults.js';
import { randomUUID } from 'crypto';

/**
 * Rule Schema Validator
 *
 * Provides static methods for validating and migrating rule JSON from settings.
 * All methods are static as validation is stateless.
 */
export class RuleSchemaValidator {
  /** Current schema version */
  private static readonly CURRENT_VERSION = '1.0';

  /** Valid rule types */
  private static readonly VALID_TYPES = ['HARD', 'AI'];

  /** Valid moderation actions */
  private static readonly VALID_ACTIONS: ModerationAction[] = [
    'APPROVE',
    'FLAG',
    'REMOVE',
    'COMMENT',
  ];

  /**
   * Validate and migrate rule JSON from settings
   *
   * Main entry point for rule validation. Parses JSON, validates schema,
   * and migrates to current version if needed.
   *
   * @param json - Raw JSON string from settings
   * @returns ValidationResult with typed RuleSet or error
   *
   * @example
   * ```typescript
   * const result = await RuleSchemaValidator.validateAndMigrate(rulesJson);
   * if (result.success) {
   *   console.log('Valid rules:', result.data);
   * } else {
   *   console.error('Validation error:', result.error);
   * }
   * ```
   */
  static async validateAndMigrate(json: string): Promise<ValidationResult<RuleSet>> {
    try {
      // Step 1: Parse JSON with error position extraction
      let data: any;
      try {
        data = JSON.parse(json);
      } catch (error) {
        return {
          success: false,
          error: this.formatValidationError(error),
          details: 'JSON parsing failed',
        };
      }

      // Step 2: Validate schema structure
      const validationResult = this.validateSchema(data);
      if (!validationResult.success) {
        return validationResult;
      }

      // Step 3: Migrate if needed
      const version = data.version || '1.0';
      const migratedData = await this.migrate(data, version);

      // Step 4: Return success with data and any warnings
      return {
        success: true,
        data: migratedData,
        warnings: validationResult.warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
        details: 'Validation process failed',
      };
    }
  }

  /**
   * Migrate old schema versions to current version
   *
   * Framework for handling schema migrations across versions.
   * Currently only supports v1.0, but designed to handle future versions.
   *
   * @param data - Parsed rule data
   * @param fromVersion - Source schema version
   * @returns Migrated RuleSet
   *
   * @example
   * ```typescript
   * // Future migration example:
   * // if (fromVersion === "1.0" && this.CURRENT_VERSION === "1.1") {
   * //   data.newField = defaultValue;
   * //   data.version = "1.1";
   * // }
   * ```
   */
  private static async migrate(data: any, fromVersion: string): Promise<RuleSet> {
    // No migration needed for current version
    if (fromVersion === this.CURRENT_VERSION) {
      return data as RuleSet;
    }

    // Future: Add migration logic for schema changes
    // Example: v1.0 → v1.1 migration
    // if (fromVersion === "1.0" && this.CURRENT_VERSION === "1.1") {
    //   // Add new required field with default value
    //   data.newField = defaultValue;
    //   // Update version
    //   data.version = "1.1";
    // }

    // For now, just return data as-is (assuming backward compatibility)
    console.warn('[RuleSchemaValidator] Schema migration not implemented for version:', {
      fromVersion,
      currentVersion: this.CURRENT_VERSION,
    });

    return data as RuleSet;
  }

  /**
   * Deduce rule type from presence of aiQuestion or ai field
   *
   * @param rule - Rule object to analyze
   * @returns 'AI' if rule has aiQuestion or ai, 'HARD' otherwise
   */
  private static deduceRuleType(rule: any): 'HARD' | 'AI' {
    return (rule.aiQuestion || rule.ai) ? 'AI' : 'HARD';
  }

  /**
   * Generate a sanitized ID from a question string
   *
   * @param question - The question string
   * @returns A sanitized ID string
   */
  private static generateIdFromQuestion(question: string): string {
    const sanitized = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    return sanitized || `ai_${Date.now()}`;
  }

  /**
   * Normalize ai/aiQuestion fields - convert old format to new format internally
   *
   * @param rule - Rule object to normalize
   */
  private static normalizeAIFields(rule: any): void {
    // If both ai and aiQuestion exist, ai takes precedence
    if (rule.ai && rule.aiQuestion) {
      console.warn('[RuleSchemaValidator] Rule has both "ai" and "aiQuestion" fields, using "ai"');
      delete rule.aiQuestion;
    }

    // Convert old aiQuestion to new ai format
    if (rule.aiQuestion && !rule.ai) {
      rule.ai = rule.aiQuestion;
      delete rule.aiQuestion;
    }

    // Auto-generate id if missing
    if (rule.ai && !rule.ai.id) {
      rule.ai.id = this.generateIdFromQuestion(rule.ai.question);
    }

    // For backward compatibility, also populate aiQuestion from ai
    // This ensures existing code that reads aiQuestion still works
    if (rule.ai && !rule.aiQuestion) {
      rule.aiQuestion = rule.ai;
    }
  }

  /**
   * Normalize contentType value for backward compatibility
   *
   * Maps old values to new schema:
   * - 'submission' → 'post'
   * - 'any' → 'all'
   *
   * @param contentType - Original contentType value
   * @returns Normalized contentType value
   */
  private static normalizeContentType(contentType: string): 'post' | 'comment' | 'all' {
    if (contentType === 'submission') {
      return 'post';
    }
    if (contentType === 'any') {
      return 'all';
    }
    return contentType as 'post' | 'comment' | 'all';
  }

  /**
   * Validate against RuleSet schema
   *
   * Performs comprehensive validation of rule structure including:
   * - Required fields (rules array)
   * - Rule structure (conditions, action)
   * - Type and action validation
   * - AI question ID uniqueness
   * - Condition structure basic checks
   * - Auto-generates missing optional fields (id, type, priority, enabled, contentType, etc.)
   *
   * The validator accepts a simplified JSON schema but outputs a fully-populated
   * RuleSet with all internal fields for backward compatibility.
   *
   * @param data - Parsed JSON data
   * @returns ValidationResult with RuleSet or errors/warnings
   */
  private static validateSchema(data: any): ValidationResult<RuleSet> {
    const warnings: string[] = [];

    // Validate top-level structure
    if (typeof data !== 'object' || data === null) {
      return {
        success: false,
        error: 'Invalid rule set: must be an object',
      };
    }

    // Version defaults to 1.0 if missing (no warning)
    if (!data.version) {
      data.version = '1.0';
    }

    // Add internal fields if missing
    if (!data.subreddit) {
      data.subreddit = 'unknown';
    }
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }

    // Rules array is required
    if (!Array.isArray(data.rules)) {
      return {
        success: false,
        error: "'rules' must be an array",
      };
    }

    // Validate each rule
    const aiQuestionIds = new Set<string>();

    for (let i = 0; i < data.rules.length; i++) {
      const rule = data.rules[i];

      // Auto-generate id if missing
      if (!rule.id) {
        rule.id = randomUUID();
      }

      const rulePrefix = `Rule ${i} (${rule.id})`;

      // Auto-generate name if missing
      if (!rule.name) {
        rule.name = `Rule ${i + 1}`;
      }

      // Normalize ai/aiQuestion fields
      this.normalizeAIFields(rule);

      // Auto-deduce type if missing
      if (!rule.type) {
        rule.type = this.deduceRuleType(rule);
      } else if (!this.VALID_TYPES.includes(rule.type)) {
        warnings.push(
          `${rulePrefix}: invalid 'type' (must be 'HARD' or 'AI', got '${rule.type}')`
        );
      }

      // Auto-default enabled to true if missing
      if (rule.enabled === undefined || rule.enabled === null) {
        rule.enabled = true;
      }

      // Auto-assign priority based on array index if missing
      if (rule.priority === undefined || rule.priority === null) {
        rule.priority = i * 10;
      } else if (typeof rule.priority !== 'number') {
        warnings.push(`${rulePrefix}: 'priority' must be a number (got ${typeof rule.priority})`);
      }

      // Normalize and default contentType
      // Accept: 'post' | 'comment' | 'all' from JSON
      // Output: 'submission' | 'comment' | 'any' for internal use
      if (rule.contentType !== undefined) {
        const normalized = this.normalizeContentType(rule.contentType);
        // Map to internal values
        if (normalized === 'post') {
          rule.contentType = 'submission';
        } else if (normalized === 'all') {
          rule.contentType = 'any';
        } else {
          rule.contentType = normalized;
        }
      } else {
        // Default to 'any'
        rule.contentType = 'any';
      }

      // Add timestamps if missing
      if (!rule.createdAt) {
        rule.createdAt = Date.now();
      }
      if (!rule.updatedAt) {
        rule.updatedAt = Date.now();
      }

      // Subreddit field (optional, for rule-level overrides)
      if (rule.subreddit === undefined) {
        rule.subreddit = null;
      }

      // Validate action (required)
      if (!rule.action) {
        warnings.push(`${rulePrefix}: missing 'action' field`);
      } else if (!this.VALID_ACTIONS.includes(rule.action)) {
        warnings.push(
          `${rulePrefix}: invalid 'action' (must be one of ${this.VALID_ACTIONS.join(', ')}, got '${rule.action}')`
        );
      }

      // Conditions check (basic structure)
      if (!rule.conditions) {
        warnings.push(`${rulePrefix}: missing 'conditions' field`);
      } else if (typeof rule.conditions !== 'object') {
        warnings.push(`${rulePrefix}: 'conditions' must be an object`);
      } else {
        // Basic condition structure validation
        const hasField = 'field' in rule.conditions;
        const hasOperator = 'operator' in rule.conditions;
        const hasLogical = 'logicalOperator' in rule.conditions;
        const hasRules = 'rules' in rule.conditions;

        // Either leaf condition (field + operator) or nested (logicalOperator + rules)
        if (!hasField && !hasLogical) {
          warnings.push(
            `${rulePrefix}: 'conditions' must have either 'field' or 'logicalOperator'`
          );
        }

        if (hasField && !hasOperator) {
          warnings.push(`${rulePrefix}: 'conditions' with 'field' must have 'operator'`);
        }

        if (hasLogical && !hasRules) {
          warnings.push(`${rulePrefix}: 'conditions' with 'logicalOperator' must have 'rules'`);
        }
      }

      // AI-specific validation
      if (rule.type === 'AI') {
        // After normalization, we always have rule.ai populated
        if (!rule.ai) {
          warnings.push(`${rulePrefix}: AI rule missing 'ai' field`);
        } else {
          if (!rule.ai.id) {
            warnings.push(`${rulePrefix}: AI rule missing 'ai.id' (should have been auto-generated)`);
          } else {
            // Check for duplicate AI question IDs
            if (aiQuestionIds.has(rule.ai.id)) {
              warnings.push(
                `${rulePrefix}: duplicate AI question ID '${rule.ai.id}' (each AI question must have a unique ID)`
              );
            }
            aiQuestionIds.add(rule.ai.id);
          }

          if (!rule.ai.question) {
            warnings.push(`${rulePrefix}: AI rule missing 'ai.question'`);
          }
        }
      }

      // ActionConfig validation and defaults
      if (!rule.actionConfig) {
        rule.actionConfig = { reason: 'Rule matched' };
      } else if (!rule.actionConfig.reason) {
        rule.actionConfig.reason = 'Rule matched';
      }
    }

    // If we have warnings but no critical errors, still succeed
    return {
      success: true,
      data: data as RuleSet,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Format validation error with helpful context
   *
   * Extracts line numbers and position information from JSON parse errors
   * to help moderators identify and fix syntax errors.
   *
   * @param error - Error object from JSON.parse or validation
   * @returns Formatted error message
   */
  private static formatValidationError(error: any): string {
    if (error instanceof SyntaxError) {
      // Try to extract position from error message
      // JSON.parse errors typically include position information
      const positionMatch = error.message.match(/position (\d+)/);
      if (positionMatch) {
        return `JSON syntax error at position ${positionMatch[1]}: ${error.message}`;
      }

      // Try to extract line/column if available (some JavaScript engines provide this)
      const lineMatch = error.message.match(/line (\d+)/i);
      const columnMatch = error.message.match(/column (\d+)/i);

      if (lineMatch && columnMatch) {
        return `JSON syntax error at line ${lineMatch[1]}, column ${columnMatch[1]}: ${error.message}`;
      }

      return `JSON syntax error: ${error.message}`;
    }

    // For other errors, return message or string representation
    return error.message || String(error);
  }
}

/**
 * Get default rule set for a subreddit
 *
 * Returns the appropriate default rule set based on subreddit name.
 * Falls back to empty rule set if subreddit not recognized.
 *
 * @param subredditName - Subreddit name (case-sensitive)
 * @returns Default RuleSet for the subreddit
 */
function getDefaultRuleSet(subredditName: string): RuleSet {
  switch (subredditName) {
    case 'FriendsOver40':
      return FRIENDSOVER40_RULES;
    case 'FriendsOver50':
      return FRIENDSOVER50_RULES;
    case 'bitcointaxes':
      return BITCOINTAXES_RULES;
    default:
      return {
        subreddit: subredditName,
        updatedAt: Date.now(),
        rules: [],
      };
  }
}

/**
 * Load and validate rules from settings
 *
 * Main helper function for loading rules from Devvit settings. Handles:
 * - Empty settings (returns defaults)
 * - Invalid JSON (logs error, returns defaults)
 * - Valid JSON (validates and returns)
 * - Warnings (logs but still uses rules)
 *
 * This function never throws - it always returns valid rules by falling
 * back to defaults on any error.
 *
 * @param context - Devvit context for accessing settings
 * @param subredditName - Subreddit name for default rule selection
 * @returns Validated RuleSet (either from settings or defaults)
 *
 * @example
 * ```typescript
 * // In a trigger handler:
 * const rules = await loadRulesFromSettings(context, 'FriendsOver40');
 * const result = await rulesEngine.evaluate(rules, context);
 * ```
 */
export async function loadRulesFromSettings(
  context: Context,
  subredditName: string
): Promise<RuleSet> {
  try {
    // Get rules JSON from settings
    const settings = await context.settings.getAll();
    const rulesJson = settings.rulesJson as string | undefined;

    // If no rules configured, use defaults
    if (!rulesJson || rulesJson.trim() === '') {
      console.log('[RuleSchemaValidator] No rules configured, using defaults for:', subredditName);
      return getDefaultRuleSet(subredditName);
    }

    // Validate and migrate
    const result = await RuleSchemaValidator.validateAndMigrate(rulesJson);

    if (!result.success) {
      console.error('[RuleSchemaValidator] Invalid rules JSON:', {
        error: result.error,
        details: result.details,
        subreddit: subredditName,
      });
      console.error('[RuleSchemaValidator] Falling back to default rules');
      return getDefaultRuleSet(subredditName);
    }

    // Log warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.warn('[RuleSchemaValidator] Rules loaded with warnings:', {
        subreddit: subredditName,
        warningCount: result.warnings.length,
      });
      result.warnings.forEach((warning) => {
        console.warn('[RuleSchemaValidator]', warning);
      });
    } else {
      console.log('[RuleSchemaValidator] Rules loaded successfully:', {
        subreddit: subredditName,
        ruleCount: result.data!.rules.length,
      });
    }

    return result.data!;
  } catch (error) {
    console.error('[RuleSchemaValidator] Unexpected error loading rules:', {
      error: error instanceof Error ? error.message : String(error),
      subreddit: subredditName,
    });
    console.error('[RuleSchemaValidator] Falling back to default rules');
    return getDefaultRuleSet(subredditName);
  }
}
