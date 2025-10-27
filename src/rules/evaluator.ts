/**
 * Condition Evaluator - Evaluates rule conditions against context
 *
 * This module implements the core condition evaluation logic for the rules engine.
 * It supports:
 * - Nested AND/OR conditions (recursive evaluation)
 * - Dot notation field access (e.g., "profile.commentKarma")
 * - AI analysis field access (e.g., "aiAnalysis.answers.dating_intent.confidence")
 * - All comparison, text, array, and regex operators
 * - Graceful handling of undefined/null values
 *
 * @module rules/evaluator
 */

import { Condition, RuleEvaluationContext, ConditionOperator } from '../types/rules.js';

/**
 * Condition Evaluator class
 * Evaluates rule conditions against a context with support for nested logic
 */
export class ConditionEvaluator {
  // Cache for compiled regex patterns to improve performance
  private regexCache: Map<string, RegExp> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly MAX_PATTERN_LENGTH = 200;

  /**
   * Evaluate a condition (supports nested AND/OR logic)
   *
   * @param condition - The condition to evaluate (can be nested)
   * @param context - The evaluation context with all data
   * @returns true if condition matches, false otherwise
   *
   * @example
   * ```typescript
   * const evaluator = new ConditionEvaluator();
   * const condition = {
   *   logicalOperator: 'AND',
   *   rules: [
   *     { field: 'profile.commentKarma', operator: '>=', value: 100 },
   *     { field: 'profile.accountAgeInDays', operator: '>=', value: 30 }
   *   ]
   * };
   * const result = evaluator.evaluate(condition, context);
   * ```
   */
  evaluate(condition: Condition, context: RuleEvaluationContext): boolean {
    // Handle nested conditions (AND/OR)
    if (condition.logicalOperator && condition.rules) {
      return this.evaluateNested(condition, context);
    }

    // Handle leaf condition
    if (condition.field && condition.operator) {
      return this.evaluateLeaf(condition, context);
    }

    // Invalid condition structure
    console.error('[ConditionEvaluator] Invalid condition structure:', condition);
    return false;
  }

  /**
   * Evaluate nested AND/OR condition
   * Uses short-circuit evaluation for performance
   *
   * @param condition - Nested condition with logicalOperator and rules
   * @param context - The evaluation context
   * @returns true if nested condition matches, false otherwise
   */
  private evaluateNested(condition: Condition, context: RuleEvaluationContext): boolean {
    if (!condition.rules || condition.rules.length === 0) {
      console.error('[ConditionEvaluator] Nested condition has no child rules');
      return false;
    }

    if (condition.logicalOperator === 'AND') {
      // All conditions must be true (short-circuit on first false)
      for (const rule of condition.rules) {
        if (!this.evaluate(rule, context)) {
          return false;
        }
      }
      return true;
    } else if (condition.logicalOperator === 'OR') {
      // At least one condition must be true (short-circuit on first true)
      for (const rule of condition.rules) {
        if (this.evaluate(rule, context)) {
          return true;
        }
      }
      return false;
    }

    console.error('[ConditionEvaluator] Unknown logical operator:', condition.logicalOperator);
    return false;
  }

  /**
   * Evaluate leaf condition (field comparison)
   *
   * @param condition - Leaf condition with field, operator, and value
   * @param context - The evaluation context
   * @returns true if comparison matches, false otherwise
   */
  private evaluateLeaf(condition: Condition, context: RuleEvaluationContext): boolean {
    if (!condition.field || !condition.operator) {
      console.error('[ConditionEvaluator] Leaf condition missing field or operator');
      return false;
    }

    // Resolve field value from context
    const actualValue = this.getFieldValue(condition.field, context);

    // Handle undefined/null values gracefully
    // Conditions fail if field doesn't exist (except for explicit null checks)
    if (actualValue === undefined || actualValue === null) {
      // Only return true if we're explicitly checking for null/undefined
      return false;
    }

    // Evaluate the comparison
    return this.compareValues(actualValue, condition.operator, condition.value);
  }

  /**
   * Check if field path is allowed for rule evaluation
   * Only allows specific prefixes to prevent unauthorized data access
   *
   * @param fieldPath - The field path to validate
   * @returns true if the field path is allowed, false otherwise
   */
  private isAllowedField(fieldPath: string): boolean {
    const allowedPrefixes = [
      'profile.',
      'currentPost.',
      'postHistory.',
      'aiAnalysis.',
      'subreddit'
    ];

    return allowedPrefixes.some(prefix =>
      fieldPath === prefix.slice(0, -1) || fieldPath.startsWith(prefix)
    );
  }

  /**
   * Get field value from context using dot notation (WITH SECURITY CHECKS)
   *
   * Supports:
   * - Simple paths: "profile.commentKarma"
   * - Nested paths: "currentPost.body"
   * - Array lookups for AI answers: "aiAnalysis.answers.dating_intent.confidence"
   *
   * Security features:
   * - Validates field paths against allowed prefixes
   * - Enforces depth limits
   * - Prevents prototype pollution attacks
   *
   * @param fieldPath - Dot-notation field path
   * @param context - The evaluation context
   * @returns The field value, or undefined if not found or unauthorized
   *
   * @example
   * ```typescript
   * getFieldValue('profile.commentKarma', context); // Returns: 1500
   * getFieldValue('aiAnalysis.answers.q_dating.confidence', context); // Returns: 85
   * getFieldValue('__proto__.polluted', context); // Returns: undefined (blocked)
   * ```
   */
  private getFieldValue(fieldPath: string, context: RuleEvaluationContext): any {
    // Validate field is allowed
    if (!this.isAllowedField(fieldPath)) {
      console.error('[ConditionEvaluator] Unauthorized field access attempt:', fieldPath);
      return undefined;
    }

    const parts = fieldPath.split('.');
    const MAX_DEPTH = 10;

    // Check depth limit
    if (parts.length > MAX_DEPTH) {
      console.error('[ConditionEvaluator] Field path too deep:', fieldPath);
      return undefined;
    }

    // Prevent prototype pollution
    const FORBIDDEN = ['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__'];
    if (parts.some(p => FORBIDDEN.includes(p))) {
      console.error('[ConditionEvaluator] Forbidden property access:', fieldPath);
      return undefined;
    }

    let current: any = context;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Additional safety check for each step
      if (typeof current !== 'object') {
        return undefined;
      }

      current = current[part];
    }

    return current;
  }

  /**
   * Compare two values using an operator
   *
   * Implements all supported operators:
   * - Comparison: <, >, <=, >=, ==, !=
   * - Text: contains, not_contains, contains_i, not_contains_i
   * - Array: in, not_in
   * - Regex: regex, regex_i
   *
   * @param actual - The actual value from context
   * @param operator - The comparison operator
   * @param expected - The expected value from condition
   * @returns true if comparison matches, false otherwise
   */
  private compareValues(actual: any, operator: ConditionOperator, expected: any): boolean {
    try {
      switch (operator) {
        // Numeric comparison operators
        case '<':
          return Number(actual) < Number(expected);

        case '>':
          return Number(actual) > Number(expected);

        case '<=':
          return Number(actual) <= Number(expected);

        case '>=':
          return Number(actual) >= Number(expected);

        case '==':
          // Type-safe equality
          return actual === expected;

        case '!=':
          return actual !== expected;

        // Text operators (case-sensitive)
        case 'contains':
          if (Array.isArray(actual)) {
            return actual.includes(expected);
          }
          return String(actual).includes(String(expected));

        case 'not_contains':
          if (Array.isArray(actual)) {
            return !actual.includes(expected);
          }
          return !String(actual).includes(String(expected));

        // Text operators (case-insensitive)
        case 'contains_i':
          return String(actual).toLowerCase().includes(String(expected).toLowerCase());

        case 'not_contains_i':
          return !String(actual).toLowerCase().includes(String(expected).toLowerCase());

        // Array membership operators
        case 'in':
          if (!Array.isArray(expected)) {
            console.error('[ConditionEvaluator] "in" operator requires array as expected value');
            return false;
          }
          return expected.includes(actual);

        case 'not_in':
          if (!Array.isArray(expected)) {
            console.error('[ConditionEvaluator] "not_in" operator requires array as expected value');
            return false;
          }
          return !expected.includes(actual);

        // Regex operators (with caching)
        case 'regex': {
          const regex = this.getCompiledRegex(String(expected), '');
          return regex.test(String(actual));
        }

        case 'regex_i': {
          const regex = this.getCompiledRegex(String(expected), 'i');
          return regex.test(String(actual));
        }

        default:
          console.error('[ConditionEvaluator] Unknown operator:', operator);
          return false;
      }
    } catch (error) {
      console.error('[ConditionEvaluator] Comparison error:', {
        operator,
        actual,
        expected,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get compiled regex from cache or compile and cache it
   * Improves performance by avoiding repeated regex compilation
   *
   * Security features:
   * - Pattern length validation (max 200 chars)
   * - Detection of dangerous nested quantifier patterns (ReDoS prevention)
   * - LRU cache with size limit
   * - Safe error handling
   *
   * @param pattern - The regex pattern string
   * @param flags - Regex flags (e.g., 'i' for case-insensitive)
   * @returns Compiled RegExp object (never-matching regex on error)
   */
  private getCompiledRegex(pattern: string, flags: string): RegExp {
    const key = `${pattern}:${flags}`;

    if (!this.regexCache.has(key)) {
      try {
        // Validate pattern length to prevent excessive memory usage
        if (pattern.length > this.MAX_PATTERN_LENGTH) {
          console.error('[ConditionEvaluator] Regex pattern too long:', {
            length: pattern.length,
            maxLength: this.MAX_PATTERN_LENGTH
          });
          this.regexCache.set(key, new RegExp('(?!)'));  // Never matches
          return this.regexCache.get(key)!;
        }

        // Check for dangerous nested quantifiers that could cause ReDoS
        // These patterns can cause exponential backtracking
        const dangerousPatterns = [
          /(\([\w\s]+[*+]\))+[*+]/,     // Nested quantifiers like (w+)+
          /(\[[\w\s]+[*+]\])+[*+]/,     // Nested quantifiers in character classes
          /(\.\*)+/,                      // Nested .* patterns
          /(\.\+)+/,                      // Nested .+ patterns
          /(\\d\+)+/,                     // Nested \d+ patterns
          /(\\w\+)+/,                     // Nested \w+ patterns
          /(\\s\*)+/,                     // Nested \s* patterns
        ];

        for (const dangerous of dangerousPatterns) {
          if (dangerous.test(pattern)) {
            console.error('[ConditionEvaluator] Potentially dangerous regex pattern detected:', {
              pattern,
              reason: 'Nested quantifiers can cause ReDoS'
            });
            this.regexCache.set(key, new RegExp('(?!)'));
            return this.regexCache.get(key)!;
          }
        }

        // Implement simple LRU by removing oldest entry if cache is full
        if (this.regexCache.size >= this.MAX_CACHE_SIZE) {
          const firstKey = this.regexCache.keys().next().value;
          if (firstKey !== undefined) {
            this.regexCache.delete(firstKey);
          }
        }

        // Compile and cache the regex
        this.regexCache.set(key, new RegExp(pattern, flags));
      } catch (error) {
        console.error('[ConditionEvaluator] Invalid regex pattern:', {
          pattern,
          error: error instanceof Error ? error.message : String(error)
        });
        // Create a regex that never matches
        this.regexCache.set(key, new RegExp('(?!)'));
      }
    }

    return this.regexCache.get(key)!;
  }

  /**
   * Clear the regex cache
   * Useful for testing or memory management
   */
  clearRegexCache(): void {
    this.regexCache.clear();
  }
}
