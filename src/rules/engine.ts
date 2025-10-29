/**
 * Rules Engine - Evaluates rules and determines moderation action
 *
 * This is the main orchestrator that:
 * - Loads rules from storage
 * - Evaluates conditions against context
 * - Applies dry-run mode
 * - Returns the appropriate moderation action
 *
 * The engine uses a priority-based evaluation strategy, stopping at the first
 * matching rule (highest priority wins).
 *
 * @module rules/engine
 */

import { Devvit, Context } from '@devvit/public-api';
import { Rule, RuleEvaluationContext, RuleEvaluationResult } from '../types/rules.js';
import { ConditionEvaluator } from './evaluator.js';
import { VariableSubstitutor } from './variables.js';
import { loadRulesFromSettings } from './schemaValidator.js';

/**
 * Rules Engine class
 * Main orchestrator for rule evaluation and action determination
 */
export class RulesEngine {
  private evaluator: ConditionEvaluator;
  private substitutor: VariableSubstitutor;
  private context: Context;

  constructor(context: Devvit.Context) {
    this.evaluator = new ConditionEvaluator();
    this.substitutor = new VariableSubstitutor();
    this.context = context;
  }

  /**
   * Evaluate all rules for a context and return the action to take
   *
   * This is the main entry point for rule evaluation. It:
   * 1. Loads rules for the subreddit (including global rules)
   * 2. Filters rules by content type
   * 3. Sorts by priority
   * 4. Evaluates each rule until one matches
   * 5. Applies dry-run mode if enabled
   * 6. Returns the appropriate action
   *
   * @param evalContext - The complete evaluation context
   * @param contentType - Content type being evaluated ('submission' or 'comment')
   * @returns The evaluation result with action, reason, and metadata
   *
   * @example
   * ```typescript
   * const engine = RulesEngine.getInstance(context);
   * const result = await engine.evaluateRules({
   *   profile,
   *   postHistory,
   *   currentPost,
   *   aiAnalysis,
   *   subreddit: 'FriendsOver40'
   * }, 'submission');
   * // Returns: { action: 'FLAG', reason: '...', ... }
   * ```
   */
  async evaluateRules(
    evalContext: RuleEvaluationContext,
    contentType: 'submission' | 'comment' = 'submission'
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      // 1. Load rules from settings (validated and typed)
      const ruleSet = await loadRulesFromSettings(this.context, evalContext.subreddit);
      const rules = ruleSet.rules;

      // 2. Add global rules from settings
      const globalRuleSet = await loadRulesFromSettings(this.context, 'global');
      const allRules = [...rules, ...globalRuleSet.rules];

      // 3. Filter rules by content type
      const applicableRules = allRules.filter((rule) => {
        const ruleContentType = rule.contentType || 'submission';
        // Normalize 'post' to 'submission'
        const normalizedRuleType = ruleContentType === 'post' ? 'submission' : ruleContentType;
        return normalizedRuleType === 'any' || normalizedRuleType === contentType;
      });

      // 4. Sort by priority (highest first)
      applicableRules.sort((a, b) => b.priority - a.priority);

      // 5. Get global dry-run mode from Settings UI
      const settings = await this.context.settings.getAll();
      const dryRunMode = (settings.dryRunMode as boolean) ?? true; // Default to safe mode

      // 6. Evaluate each rule
      let rulesEvaluated = 0;

      for (const rule of applicableRules) {
        // Skip disabled rules
        if (!rule.enabled) {
          continue;
        }

        rulesEvaluated++;

        // Skip AI rules if no AI analysis available
        if (rule.type === 'AI' && !evalContext.aiAnalysis) {
          console.log('[RulesEngine] Skipping AI rule (no analysis):', {
            ruleId: rule.id,
            ruleName: rule.name,
          });
          continue;
        }

        try {
          // Set current rule for ai.* field access in both evaluator and substitutor
          this.evaluator.setCurrentRule(rule);
          this.substitutor.setCurrentRule(rule);

          // Evaluate condition
          const matched = this.evaluator.evaluate(rule.conditions, evalContext);

          if (matched) {
            // Rule matched! Prepare result
            const reason = this.substitutor.substitute(rule.actionConfig.reason, evalContext);
            const comment = rule.actionConfig.comment
              ? this.substitutor.substitute(rule.actionConfig.comment, evalContext)
              : null;

            // Get confidence
            const confidence = this.getConfidence(rule, evalContext);

            // Apply dry-run mode
            // In dry-run, all actions except APPROVE become FLAG
            const action = dryRunMode && rule.action !== 'APPROVE' ? 'FLAG' : rule.action;

            const executionTimeMs = Date.now() - startTime;

            console.log('[RulesEngine] Rule matched:', {
              ruleId: rule.id,
              ruleName: rule.name,
              originalAction: rule.action,
              actualAction: action,
              dryRunMode,
              confidence,
              executionTimeMs,
              rulesEvaluated,
            });

            return {
              action,
              reason: dryRunMode && rule.action !== 'APPROVE' ? `[DRY RUN] ${reason}` : reason,
              comment: dryRunMode ? null : comment,
              matchedRule: rule.id,
              confidence,
              dryRun: dryRunMode,
            };
          }
        } catch (error) {
          // Log error but continue evaluating other rules
          console.error('[RulesEngine] Rule evaluation failed:', {
            ruleId: rule.id,
            ruleName: rule.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // No rules matched - default to APPROVE
      const executionTimeMs = Date.now() - startTime;

      console.log('[RulesEngine] No rules matched - default approve:', {
        subreddit: evalContext.subreddit,
        rulesEvaluated,
        executionTimeMs,
      });

      return {
        action: 'APPROVE',
        reason: 'No rules matched',
        matchedRule: 'none',
        confidence: 100,
        dryRun: false,
      };
    } catch (error) {
      // Catastrophic failure - default to FLAG for manual review (safer than auto-approve)
      console.error('[RulesEngine] Critical error during rule evaluation', {
        subreddit: evalContext.subreddit,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        action: 'FLAG',
        reason: 'Rule evaluation error - requires manual review',
        matchedRule: 'error',
        confidence: 0,
        dryRun: false,
      };
    }
  }

  /**
   * Get confidence score for a rule match
   *
   * - For hard rules: Always returns 100
   * - For AI rules: Extracts confidence from AI answer
   *
   * @param rule - The matched rule
   * @param context - The evaluation context
   * @returns Confidence score (0-100)
   */
  private getConfidence(rule: Rule, context: RuleEvaluationContext): number {
    // For AI rules, extract confidence from AI answer
    if (rule.type === 'AI' && context.aiAnalysis) {
      // Find the AI question this rule depends on (check both ai and aiQuestion)
      const questionId = rule.ai?.id || rule.aiQuestion?.id;

      if (questionId && context.aiAnalysis.answers) {
        // Find the answer for this question
        const answer = context.aiAnalysis.answers.find((a) => a.questionId === questionId);

        if (answer) {
          return answer.confidence ?? 50;
        }
      }

      // Fallback if answer not found
      return 50;
    }

    // For hard rules, return 100
    return 100;
  }

  /**
   * Check if AI analysis is needed for this subreddit and content type
   *
   * Returns true if any enabled AI rules exist for the subreddit and content type.
   * This can be used to skip expensive AI analysis when not needed.
   *
   * @param subreddit - The subreddit name
   * @param contentType - Content type being evaluated ('submission' or 'comment')
   * @returns true if AI analysis is needed
   */
  async needsAIAnalysis(
    subreddit: string,
    contentType: 'submission' | 'comment' = 'submission'
  ): Promise<boolean> {
    try {
      const ruleSet = await loadRulesFromSettings(this.context, subreddit);
      const globalRuleSet = await loadRulesFromSettings(this.context, 'global');
      const allRules = [...ruleSet.rules, ...globalRuleSet.rules];

      // Filter by content type
      const applicableRules = allRules.filter((rule) => {
        const ruleContentType = rule.contentType || 'submission';
        const normalizedRuleType = ruleContentType === 'post' ? 'submission' : ruleContentType;
        return normalizedRuleType === 'any' || normalizedRuleType === contentType;
      });

      return applicableRules.some((rule) => rule.type === 'AI' && rule.enabled);
    } catch (error) {
      console.error('[RulesEngine] Error checking AI analysis need:', {
        subreddit,
        contentType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Assume we need it if we can't determine
      return true;
    }
  }

  /**
   * Get AI questions needed for this subreddit and content type
   *
   * Returns all unique AI question IDs from enabled AI rules.
   * This can be used to batch AI analysis requests efficiently.
   *
   * @param subreddit - The subreddit name
   * @param contentType - Content type being evaluated ('submission' or 'comment')
   * @returns Array of AI question objects
   */
  async getRequiredAIQuestions(
    subreddit: string,
    contentType: 'submission' | 'comment' = 'submission'
  ): Promise<Array<{ id: string; question: string; context?: string }>> {
    try {
      const ruleSet = await loadRulesFromSettings(this.context, subreddit);
      const globalRuleSet = await loadRulesFromSettings(this.context, 'global');
      const allRules = [...ruleSet.rules, ...globalRuleSet.rules];

      // Filter by content type
      const applicableRules = allRules.filter((rule) => {
        const ruleContentType = rule.contentType || 'submission';
        const normalizedRuleType = ruleContentType === 'post' ? 'submission' : ruleContentType;
        return normalizedRuleType === 'any' || normalizedRuleType === contentType;
      });

      // Filter to enabled AI rules
      const aiRules = applicableRules.filter((rule) => rule.type === 'AI' && rule.enabled);

      // Extract unique questions
      const questionsMap = new Map<
        string,
        { id: string; question: string; context?: string }
      >();

      for (const rule of aiRules) {
        if (rule.type === 'AI') {
          // Use ai field if present, otherwise fall back to aiQuestion
          const aiData = rule.ai || rule.aiQuestion;
          if (aiData && aiData.id) {
            const { id, question, context } = aiData;
            if (!questionsMap.has(id)) {
              questionsMap.set(id, { id, question, context });
            }
          }
        }
      }

      return Array.from(questionsMap.values());
    } catch (error) {
      console.error('[RulesEngine] Error getting required AI questions:', {
        subreddit,
        contentType,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Singleton pattern
   * Each Devvit context gets its own engine instance
   */
  private static instances = new Map<any, RulesEngine>();

  static getInstance(context: Devvit.Context): RulesEngine {
    if (!this.instances.has(context)) {
      this.instances.set(context, new RulesEngine(context));
    }
    return this.instances.get(context)!;
  }
}
