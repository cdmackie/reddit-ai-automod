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
 * Variable Substitutor - Replaces {variables} in strings
 *
 * This module provides variable substitution for action messages.
 * It supports:
 * - Dot notation field paths: {profile.commentKarma}
 * - AI analysis fields: {aiAnalysis.answers.dating_intent.confidence}
 * - Safe handling of undefined/null values
 * - JSON formatting for complex objects
 *
 * @module rules/variables
 */

import { RuleEvaluationContext, Rule } from '../types/rules.js';

/**
 * Variable Substitutor class
 * Replaces {variable} placeholders in strings with actual values from context
 */
export class VariableSubstitutor {
  // Current rule being evaluated (for {ai.answer} shorthand access)
  private currentRule?: Rule;

  /**
   * Set the current rule being evaluated (for {ai.answer} shorthand access)
   *
   * @param rule - The rule being evaluated
   */
  setCurrentRule(rule: Rule): void {
    this.currentRule = rule;
  }
  /**
   * Substitute variables in a string
   *
   * Finds all {variable} patterns and replaces them with values from context.
   * Supports dot notation for nested field access.
   *
   * @param template - String with {variable} placeholders
   * @param context - The evaluation context containing data
   * @returns String with all variables substituted
   *
   * @example
   * ```typescript
   * const substitutor = new VariableSubstitutor();
   * const result = substitutor.substitute(
   *   "User {profile.username} has {profile.commentKarma} karma",
   *   context
   * );
   * // Returns: "User john_doe has 1500 karma"
   * ```
   */
  substitute(template: string, context: RuleEvaluationContext): string {
    if (!template) {
      return '';
    }

    // Find all {variable} patterns
    const variablePattern = /\{([^}]+)\}/g;

    return template.replace(variablePattern, (_match, path) => {
      // Trim whitespace from variable path
      const cleanPath = path.trim();

      // Resolve the path in context
      const value = this.getFieldValue(cleanPath, context);

      // Format the value for display
      return this.formatValue(value);
    });
  }

  /**
   * Check if field path is allowed for variable substitution
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
      'ai.',  // New shorthand for AI fields
      'subreddit'
    ];

    return allowedPrefixes.some(prefix =>
      fieldPath === prefix.slice(0, -1) || fieldPath.startsWith(prefix)
    );
  }

  /**
   * Get field value from context using dot notation (WITH SECURITY CHECKS)
   *
   * Supports the same paths as ConditionEvaluator:
   * - Profile fields: profile.commentKarma
   * - Post fields: currentPost.title
   * - History fields: postHistory.totalPosts
   * - Legacy AI fields: aiAnalysis.answers.{id}.confidence
   * - New AI shorthand (current rule): ai.answer, ai.confidence, ai.reasoning
   * - New AI shorthand (other rules): ai.dating_intent.answer, ai.dating_intent.confidence
   *
   * Security features:
   * - Validates field paths against allowed prefixes
   * - Enforces depth limits
   * - Prevents prototype pollution attacks
   *
   * @param fieldPath - Dot-notation field path
   * @param context - The evaluation context
   * @returns The field value, or undefined if not found or unauthorized
   */
  private getFieldValue(fieldPath: string, context: RuleEvaluationContext): any {
    // Validate field is allowed
    if (!this.isAllowedField(fieldPath)) {
      console.error('[VariableSubstitutor] Unauthorized field access attempt:', fieldPath);
      return undefined;
    }

    // Handle new ai.* field access patterns
    if (fieldPath.startsWith('ai.') && !fieldPath.startsWith('aiAnalysis.')) {
      return this.getAIFieldValue(fieldPath, context);
    }

    const parts = fieldPath.split('.');
    const MAX_DEPTH = 10;

    // Check depth limit
    if (parts.length > MAX_DEPTH) {
      console.error('[VariableSubstitutor] Field path too deep:', fieldPath);
      return undefined;
    }

    // Prevent prototype pollution
    const FORBIDDEN = ['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__'];
    if (parts.some(p => FORBIDDEN.includes(p))) {
      console.error('[VariableSubstitutor] Forbidden property access:', fieldPath);
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
   * Get AI field value using new shorthand syntax
   *
   * Supports:
   * - ai.answer - Current rule's answer
   * - ai.confidence - Current rule's confidence
   * - ai.reasoning - Current rule's reasoning
   * - ai.[questionId].answer - Other rule's answer
   * - ai.[questionId].confidence - Other rule's confidence
   * - ai.[questionId].reasoning - Other rule's reasoning
   *
   * @param fieldPath - AI field path (e.g., "ai.answer" or "ai.dating_intent.confidence")
   * @param context - The evaluation context
   * @returns The field value, or undefined if not found
   */
  private getAIFieldValue(fieldPath: string, context: RuleEvaluationContext): any {
    if (!context.aiAnalysis?.answers) {
      return undefined;
    }

    // Pattern 1: ai.answer, ai.confidence, ai.reasoning (current rule)
    const currentRuleMatch = fieldPath.match(/^ai\.(answer|confidence|reasoning)$/);
    if (currentRuleMatch) {
      const [, subfield] = currentRuleMatch;

      // Get current rule's AI question ID
      const currentAIId = this.currentRule?.type === 'AI'
        ? (this.currentRule.ai?.id || this.currentRule.aiQuestion?.id)
        : undefined;

      if (!currentAIId) {
        console.error('[VariableSubstitutor] {ai.*} shorthand used but no current rule AI ID found');
        return undefined;
      }

      // Find answer for this question ID
      const answer = context.aiAnalysis.answers.find((a) => a.questionId === currentAIId);
      return answer?.[subfield as 'answer' | 'confidence' | 'reasoning'];
    }

    // Pattern 2: ai.[questionId].answer, ai.[questionId].confidence, ai.[questionId].reasoning
    const otherRuleMatch = fieldPath.match(/^ai\.([^.]+)\.(answer|confidence|reasoning)$/);
    if (otherRuleMatch) {
      const [, questionId, subfield] = otherRuleMatch;

      // Find answer for this question ID
      const answer = context.aiAnalysis.answers.find((a) => a.questionId === questionId);
      return answer?.[subfield as 'answer' | 'confidence' | 'reasoning'];
    }

    console.error('[VariableSubstitutor] Invalid {ai.*} field path:', fieldPath);
    return undefined;
  }

  /**
   * Format a value for display in substituted text
   *
   * Handles:
   * - undefined/null: Returns placeholder text
   * - Objects/arrays: Returns JSON string
   * - Primitives: Returns string representation
   *
   * @param value - The value to format
   * @returns Formatted string representation
   */
  private formatValue(value: any): string {
    // Handle undefined/null
    if (value === undefined) {
      return '[undefined]';
    }

    if (value === null) {
      return '[null]';
    }

    // Handle objects and arrays
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return '[object]';
      }
    }

    // Handle primitives (string, number, boolean)
    return String(value);
  }

  /**
   * Test if a string contains any variables
   *
   * @param text - The text to check
   * @returns true if text contains {variable} patterns
   */
  hasVariables(text: string): boolean {
    if (!text) {
      return false;
    }

    const variablePattern = /\{[^}]+\}/;
    return variablePattern.test(text);
  }

  /**
   * Extract all variable paths from a string
   *
   * @param text - The text to extract variables from
   * @returns Array of variable paths found
   *
   * @example
   * ```typescript
   * const vars = substitutor.extractVariables("User {profile.username} has {profile.karma} karma");
   * // Returns: ['profile.username', 'profile.karma']
   * ```
   */
  extractVariables(text: string): string[] {
    if (!text) {
      return [];
    }

    const variablePattern = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      variables.push(match[1].trim());
    }

    return variables;
  }
}
