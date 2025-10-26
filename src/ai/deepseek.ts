/**
 * DeepSeek AI Provider Implementation
 *
 * DeepSeek V3 client for user profile analysis.
 * This is the low-cost AI provider option with very competitive pricing.
 *
 * Key Features:
 * - Model: deepseek-chat
 * - OpenAI-compatible API (uses OpenAI SDK with custom baseURL)
 * - Structured output via JSON mode
 * - Retry logic with exponential backoff (3 attempts)
 * - Token counting and cost tracking
 * - Health check with minimal token usage
 * - Cost: $0.27/MTok input, $1.10/MTok output
 *
 * @module ai/deepseek
 *
 * @example
 * ```typescript
 * import { DeepSeekProvider } from './deepseek.js';
 *
 * const provider = new DeepSeekProvider('sk-...');
 * const result = await provider.analyze(request);
 * console.log('Overall risk:', result.overallRisk);
 * ```
 */

import OpenAI from 'openai';
import { IAIProvider } from './provider.js';
import {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIErrorType,
  AIError,
  AIProviderType,
} from '../types/ai.js';
import { aiResponseValidator } from './validator.js';
import { AI_CONFIG } from '../config/ai.js';
import { promptManager } from './prompts.js';
import { getCacheTTLForTrustScore } from '../config/ai.js';

/**
 * DeepSeek V3 Provider
 *
 * Low-cost AI provider for user profile analysis. Uses OpenAI-compatible API
 * with custom baseURL pointing to DeepSeek's endpoints.
 */
export class DeepSeekProvider implements IAIProvider {
  readonly type: AIProviderType = 'deepseek';
  readonly model = 'deepseek-chat';

  private client: OpenAI;
  private config = AI_CONFIG.providers.deepseek;
  private retryConfig = AI_CONFIG.retry;

  /**
   * Create DeepSeek provider instance
   *
   * Uses OpenAI SDK with custom baseURL for DeepSeek API compatibility.
   *
   * @param apiKey - DeepSeek API key from Devvit Secrets Manager
   */
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  /**
   * Analyze user profile using DeepSeek
   *
   * Implements retry logic with exponential backoff. Validates response
   * using aiResponseValidator. Tracks token usage and cost.
   *
   * @param request - User profile and context for analysis
   * @returns Structured analysis result
   * @throws {AIError} On provider errors, validation failures, or timeouts
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    const correlationId = request.context.correlationId;

    // Build prompt using prompt manager
    const promptData = await promptManager.buildPrompt({
      profile: request.profile,
      postHistory: request.postHistory,
      currentPost: request.currentPost,
      subredditType: request.context.subredditType,
    });

    // Add JSON format instruction to prompt
    const systemPrompt = `You are a content moderation AI. Respond ONLY with valid JSON matching the specified schema. Do not include any text outside the JSON object.`;

    // Retry with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log('DeepSeek analysis attempt', {
          correlationId,
          attempt,
          userId: request.userId,
        });

        // Call DeepSeek API (via OpenAI-compatible interface)
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptData.prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 1500,
        });

        // Extract JSON response
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new AIError(
            AIErrorType.INVALID_RESPONSE,
            'DeepSeek response is empty',
            this.type,
            correlationId
          );
        }

        // Parse JSON
        let parsedResponse: unknown;
        try {
          parsedResponse = JSON.parse(content);
        } catch (parseError) {
          throw new AIError(
            AIErrorType.INVALID_RESPONSE,
            `Failed to parse DeepSeek JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            this.type,
            correlationId
          );
        }

        // Validate response structure
        const validatedResult = aiResponseValidator.validate(parsedResponse);

        // Calculate actual token usage and cost
        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;
        const costUSD = this.calculateCost(inputTokens, outputTokens);
        const latencyMs = Date.now() - startTime;

        // Determine cache TTL based on trust score
        // TODO: Get trust score from ProfileAnalysisResult when integrated
        const trustScore = 50; // Default medium trust
        const cacheTTL = getCacheTTLForTrustScore(
          trustScore,
          validatedResult.overallRisk === 'CRITICAL'
        );

        // Return complete result
        const result: AIAnalysisResult = {
          ...validatedResult,
          userId: request.userId,
          timestamp: Date.now(),
          provider: this.type,
          correlationId,
          promptVersion: request.context.promptVersion,
          cacheTTL,
          tokensUsed: inputTokens + outputTokens,
          costUSD,
          latencyMs,
        };

        console.log('DeepSeek analysis success', {
          correlationId,
          attempt,
          tokensUsed: result.tokensUsed,
          costUSD: result.costUSD,
          latencyMs,
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        // Classify error type
        const errorType = this.classifyError(error);

        console.error('DeepSeek analysis error', {
          correlationId,
          attempt,
          errorType,
          message: lastError.message,
        });

        // Don't retry on validation errors or non-retryable errors
        if (errorType === AIErrorType.VALIDATION_ERROR) {
          throw error;
        }

        // If not last attempt, wait and retry
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.calculateBackoff(attempt);
          console.log('Retrying DeepSeek request', {
            correlationId,
            attempt: attempt + 1,
            delayMs: delay,
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new AIError(
      AIErrorType.PROVIDER_ERROR,
      `DeepSeek analysis failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`,
      this.type,
      correlationId
    );
  }

  /**
   * Health check for DeepSeek API
   *
   * Sends minimal request to verify API is responding.
   * Timeout after 5 seconds.
   *
   * @returns true if healthy, false if unhealthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Create timeout promise (5 seconds)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      );

      // Minimal API call
      const checkPromise = this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10,
      });

      // Race timeout vs API call
      await Promise.race([checkPromise, timeoutPromise]);

      return true;
    } catch (error) {
      console.warn('DeepSeek health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Calculate cost for token usage
   *
   * @param inputTokens - Input tokens used
   * @param outputTokens - Output tokens used
   * @returns Cost in USD
   */
  calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * this.config.costPerMTokenInput;
    const outputCost = (outputTokens / 1_000_000) * this.config.costPerMTokenOutput;
    return inputCost + outputCost;
  }

  /**
   * Classify error type for retry logic
   *
   * @param error - Error from API call
   * @returns Classified error type
   * @private
   */
  private classifyError(error: unknown): AIErrorType {
    if (error instanceof AIError) {
      return error.type;
    }

    const err = error as Error & { status?: number; code?: string };

    // Rate limit errors
    if (
      err.status === 429 ||
      err.code === 'rate_limit_exceeded' ||
      err.message?.includes('rate limit')
    ) {
      return AIErrorType.RATE_LIMIT;
    }

    // Timeout errors
    if (
      err.code === 'ETIMEDOUT' ||
      err.message?.includes('timeout') ||
      err.message?.includes('ETIMEDOUT')
    ) {
      return AIErrorType.TIMEOUT;
    }

    // Default to provider error
    return AIErrorType.PROVIDER_ERROR;
  }

  /**
   * Calculate exponential backoff delay
   *
   * @param attempt - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   * @private
   */
  private calculateBackoff(attempt: number): number {
    const delay =
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
