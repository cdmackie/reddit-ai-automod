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
  GLOBAL_RULES,
} from './defaults.js';

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
   * Validate against RuleSet schema
   *
   * Performs comprehensive validation of rule structure including:
   * - Required fields (version, subreddit, rules array)
   * - Rule structure (id, type, priority, conditions, action)
   * - Type and action validation
   * - AI question ID uniqueness
   * - Condition structure basic checks
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

    // Version check (optional, defaults to 1.0)
    if (!data.version) {
      warnings.push("Missing 'version' field (assuming 1.0)");
      data.version = '1.0';
    }

    // Subreddit check (optional but recommended)
    if (!data.subreddit) {
      warnings.push("Missing 'subreddit' field");
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
      const rulePrefix = `Rule ${i} (${rule.id || 'no id'})`;

      // Required fields
      if (!rule.id) {
        warnings.push(`${rulePrefix}: missing 'id' field`);
      }

      if (!rule.type) {
        warnings.push(`${rulePrefix}: missing 'type' field`);
      } else if (!this.VALID_TYPES.includes(rule.type)) {
        warnings.push(
          `${rulePrefix}: invalid 'type' (must be 'HARD' or 'AI', got '${rule.type}')`
        );
      }

      if (!rule.action) {
        warnings.push(`${rulePrefix}: missing 'action' field`);
      } else if (!this.VALID_ACTIONS.includes(rule.action)) {
        warnings.push(
          `${rulePrefix}: invalid 'action' (must be one of ${this.VALID_ACTIONS.join(', ')}, got '${rule.action}')`
        );
      }

      if (rule.priority === undefined || rule.priority === null) {
        warnings.push(`${rulePrefix}: missing 'priority' field`);
      } else if (typeof rule.priority !== 'number') {
        warnings.push(`${rulePrefix}: 'priority' must be a number (got ${typeof rule.priority})`);
      }

      // Validate contentType (optional, defaults to 'submission')
      if (rule.contentType !== undefined) {
        if (!['submission', 'post', 'comment', 'any'].includes(rule.contentType)) {
          warnings.push(
            `${rulePrefix}: contentType must be one of: submission, post, comment, any (got '${rule.contentType}')`
          );
        }
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
        if (!rule.aiQuestion) {
          warnings.push(`${rulePrefix}: AI rule missing 'aiQuestion' field`);
        } else {
          if (!rule.aiQuestion.id) {
            warnings.push(`${rulePrefix}: AI rule missing 'aiQuestion.id'`);
          } else {
            // Check for duplicate AI question IDs
            if (aiQuestionIds.has(rule.aiQuestion.id)) {
              warnings.push(
                `${rulePrefix}: duplicate AI question ID '${rule.aiQuestion.id}' (each AI question must have a unique ID)`
              );
            }
            aiQuestionIds.add(rule.aiQuestion.id);
          }

          if (!rule.aiQuestion.question) {
            warnings.push(`${rulePrefix}: AI rule missing 'aiQuestion.question'`);
          }
        }
      }

      // ActionConfig validation
      if (!rule.actionConfig) {
        warnings.push(`${rulePrefix}: missing 'actionConfig' field`);
      } else if (!rule.actionConfig.reason) {
        warnings.push(`${rulePrefix}: 'actionConfig' missing 'reason' field`);
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
 * Falls back to global rules if subreddit not recognized.
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
      return GLOBAL_RULES;
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
