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
 * AI Provider Interface
 *
 * Abstract interface that all AI providers must implement to enable
 * interchangeable use of Claude, OpenAI, and DeepSeek for user profile analysis.
 *
 * This interface defines the contract that all provider clients must follow,
 * enabling the provider selector to treat all providers uniformly and implement
 * automatic failover between providers.
 *
 * @module ai/provider
 *
 * @example
 * ```typescript
 * import { IAIProvider } from './provider.js';
 * import { ClaudeProvider } from './claude.js';
 *
 * const provider: IAIProvider = new ClaudeProvider(apiKey);
 *
 * // Analyze user
 * const result = await provider.analyze(request);
 * console.log('Analysis:', result);
 *
 * // Check health
 * const healthy = await provider.healthCheck();
 * if (!healthy) {
 *   console.warn('Provider is unhealthy, trying fallback');
 * }
 *
 * // Calculate cost
 * const cost = provider.calculateCost(2000, 500);
 * console.log('Estimated cost:', cost);
 * ```
 */

import { AIAnalysisRequest, AIAnalysisResult, AIProviderType, AIQuestionRequest, AIQuestionBatchResult } from '../types/ai.js';

/**
 * Interface that all AI providers must implement
 *
 * Enables interchangeable use of different AI providers (Claude, OpenAI, DeepSeek)
 * for user profile analysis. All providers must support:
 * - analyze(): Analyze user profile and return structured risk assessment
 * - healthCheck(): Verify provider is responding
 * - calculateCost(): Estimate cost for token usage
 *
 * Implementation requirements:
 * - All methods must use async/await for consistency
 * - Errors must be thrown as AIError with appropriate AIErrorType
 * - Health checks should timeout after 5 seconds
 * - Cost calculation must match provider's actual pricing
 */
export interface IAIProvider {
  /**
   * Provider type identifier
   * @readonly
   */
  readonly type: AIProviderType;

  /**
   * Model name/ID being used by this provider
   * @readonly
   */
  readonly model: string;

  /**
   * Analyze user profile and determine risk
   *
   * Sends user profile data to the AI provider and returns a structured
   * analysis containing:
   * - Dating intent detection
   * - Scammer risk assessment
   * - Age estimation (for age-restricted subreddits)
   * - Spam indicators
   * - Overall risk level
   * - Recommended moderation action
   *
   * The implementation must:
   * - Use retry logic with exponential backoff (3 attempts max)
   * - Validate response using aiResponseValidator
   * - Track token usage and cost
   * - Include correlation ID in all errors
   * - Classify errors by AIErrorType for proper handling
   *
   * @param request - User profile and context data for analysis
   * @returns Structured analysis result with confidence scores
   * @throws {AIError} On provider errors, validation failures, or timeouts
   *
   * @example
   * ```typescript
   * const result = await provider.analyze({
   *   userId: 't2_abc123',
   *   username: 'testuser',
   *   profile: userProfile,
   *   postHistory: userHistory,
   *   currentPost: {
   *     title: 'Looking for friends',
   *     body: 'Hey everyone!',
   *     subreddit: 'FriendsOver40'
   *   },
   *   context: {
   *     subredditName: 'FriendsOver40',
   *     subredditType: 'FriendsOver40',
   *     correlationId: 'req-12345',
   *     promptVersion: 'v1.0'
   *   }
   * });
   * ```
   */
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;

  /**
   * Health check - can the provider respond?
   *
   * Performs a lightweight ping to the AI provider to verify it's operational.
   * Should use minimal tokens (e.g., "Say 'OK'") to avoid unnecessary costs.
   *
   * Implementation requirements:
   * - Timeout after 5 seconds
   * - Return boolean (true = healthy, false = unhealthy)
   * - DO NOT throw errors - catch and return false
   * - Use minimal token request to reduce cost
   *
   * @returns Promise resolving to true if healthy, false if unhealthy
   *
   * @example
   * ```typescript
   * const healthy = await provider.healthCheck();
   * if (!healthy) {
   *   console.warn('Provider unhealthy, trying fallback');
   * }
   * ```
   */
  healthCheck(): Promise<boolean>;

  /**
   * Calculate cost for given token counts
   *
   * Estimates the cost in USD for a given number of input and output tokens
   * based on the provider's pricing. Must use actual provider pricing rates.
   *
   * Formula:
   * ```
   * inputCost = (inputTokens / 1,000,000) * costPerMTokenInput
   * outputCost = (outputTokens / 1,000,000) * costPerMTokenOutput
   * totalCost = inputCost + outputCost
   * ```
   *
   * @param inputTokens - Number of input tokens (prompt + context)
   * @param outputTokens - Number of output tokens (response)
   * @returns Estimated cost in USD
   *
   * @example
   * ```typescript
   * // Claude: $1/MTok input, $5/MTok output
   * const cost = provider.calculateCost(2000, 500);
   * // = (2000/1M * $1) + (500/1M * $5)
   * // = $0.002 + $0.0025
   * // = $0.0045
   * console.log('Cost:', cost); // 0.0045
   * ```
   */
  calculateCost(inputTokens: number, outputTokens: number): number;

  /**
   * Analyze user with custom questions (optional)
   *
   * New flexible analysis method that allows moderators to define custom
   * questions in natural language. The AI answers each question with YES/NO,
   * confidence score, and reasoning.
   *
   * This method enables:
   * - Dynamic question addition without code changes
   * - Batching multiple questions in one API call (cost efficient)
   * - Flexible detection criteria defined by moderators
   *
   * Implementation is optional - providers that don't implement this will
   * fall back to the standard analyze() method.
   *
   * @param request - User profile data and array of custom questions
   * @returns Batch result with answers to all questions
   * @throws {AIError} On provider errors, validation failures, or timeouts
   *
   * @example
   * ```typescript
   * const result = await provider.analyzeWithQuestions({
   *   userId: 't2_abc123',
   *   username: 'testuser',
   *   profile: userProfile,
   *   postHistory: userHistory,
   *   currentPost: {
   *     title: 'Looking for friends',
   *     body: 'Hey everyone!',
   *     subreddit: 'FriendsOver40'
   *   },
   *   questions: [
   *     {
   *       id: 'dating_intent',
   *       question: 'Is this user seeking romantic relationships?'
   *     },
   *     {
   *       id: 'age_appropriate',
   *       question: 'Does this user appear to be over 40 years old?'
   *     }
   *   ],
   *   context: {
   *     subredditName: 'FriendsOver40',
   *     subredditType: 'FriendsOver40',
   *     correlationId: 'req-12345'
   *   }
   * });
   * ```
   */
  analyzeWithQuestions?(request: AIQuestionRequest): Promise<AIQuestionBatchResult>;
}
