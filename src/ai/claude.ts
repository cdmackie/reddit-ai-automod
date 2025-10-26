/**
 * Claude AI Provider Implementation
 *
 * Anthropic Claude 3.5 Haiku client for user profile analysis.
 * This is the primary AI provider due to its balance of speed, quality, and cost.
 *
 * Key Features:
 * - Model: claude-3-5-haiku-20241022
 * - Structured output via tool calling
 * - Retry logic with exponential backoff (3 attempts)
 * - Token counting and cost tracking
 * - Health check with minimal token usage
 * - Cost: $1/MTok input, $5/MTok output
 *
 * @module ai/claude
 *
 * @example
 * ```typescript
 * import { ClaudeProvider } from './claude.js';
 *
 * const provider = new ClaudeProvider('sk-ant-...');
 * const result = await provider.analyze(request);
 * console.log('Dating intent detected:', result.datingIntent.detected);
 * ```
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Tool definition for Claude structured output
 * Claude uses tool calling to enforce JSON schema compliance
 */
const ANALYSIS_TOOL = {
  name: 'analyze_user_profile',
  description:
    'Analyze Reddit user profile and return structured risk assessment with confidence scores',
  input_schema: {
    type: 'object' as const,
    properties: {
      datingIntent: {
        type: 'object',
        properties: {
          detected: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          reasoning: { type: 'string' },
        },
        required: ['detected', 'confidence', 'reasoning'],
      },
      scammerRisk: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          patterns: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['level', 'confidence', 'patterns', 'reasoning'],
      },
      ageEstimate: {
        type: 'object',
        properties: {
          appearsUnderage: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          reasoning: { type: 'string' },
          estimatedAge: {
            type: 'string',
            enum: ['under-18', '18-25', '25-40', '40+'],
          },
        },
        required: ['appearsUnderage', 'confidence', 'reasoning'],
      },
      spamIndicators: {
        type: 'object',
        properties: {
          detected: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          patterns: { type: 'array', items: { type: 'string' } },
        },
        required: ['detected', 'confidence', 'patterns'],
      },
      overallRisk: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      },
      recommendedAction: {
        type: 'string',
        enum: ['APPROVE', 'FLAG', 'REMOVE'],
      },
    },
    required: [
      'datingIntent',
      'scammerRisk',
      'spamIndicators',
      'overallRisk',
      'recommendedAction',
    ],
  },
};

/**
 * Claude 3.5 Haiku Provider
 *
 * Primary AI provider for user profile analysis. Uses Anthropic's Claude API
 * with tool calling for structured output.
 */
export class ClaudeProvider implements IAIProvider {
  readonly type: AIProviderType = 'claude';
  readonly model = 'claude-3-5-haiku-20241022';

  private client: Anthropic;
  private config = AI_CONFIG.providers.claude;
  private retryConfig = AI_CONFIG.retry;

  /**
   * Create Claude provider instance
   *
   * @param apiKey - Anthropic API key from Devvit Secrets Manager
   */
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze user profile using Claude
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

    // Retry with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log('Claude analysis attempt', {
          correlationId,
          attempt,
          userId: request.userId,
        });

        // Call Claude API with tool use
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1500,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: promptData.prompt,
            },
          ],
          tools: [ANALYSIS_TOOL],
        });

        // Extract tool use result
        const toolUse = response.content.find(
          (block) => block.type === 'tool_use' && block.name === 'analyze_user_profile'
        );

        if (!toolUse || toolUse.type !== 'tool_use') {
          throw new AIError(
            AIErrorType.INVALID_RESPONSE,
            'Claude response did not contain expected tool use',
            this.type,
            correlationId
          );
        }

        // Validate response structure
        const validatedResult = aiResponseValidator.validate(toolUse.input);

        // Calculate actual token usage and cost
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
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

        console.log('Claude analysis success', {
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

        console.error('Claude analysis error', {
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
          console.log('Retrying Claude request', {
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
      `Claude analysis failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`,
      this.type,
      correlationId
    );
  }

  /**
   * Health check for Claude API
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
      const checkPromise = this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }],
      });

      // Race timeout vs API call
      await Promise.race([checkPromise, timeoutPromise]);

      return true;
    } catch (error) {
      console.warn('Claude health check failed', {
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

    const err = error as Error & { status?: number };

    // Rate limit errors
    if (err.status === 429 || err.message?.includes('rate limit')) {
      return AIErrorType.RATE_LIMIT;
    }

    // Timeout errors
    if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
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
