/**
 * Type definitions for application configuration
 */

/**
 * Application configuration settings
 */
export interface AppConfig {
  /** Subreddit name (without r/ prefix) */
  subredditName: string;

  /** Enable audit logging of all actions */
  enableAuditLogging: boolean;

  /** Enable verbose logging for debugging */
  enableDebugLogging: boolean;

  /** Minimum confidence threshold for AI decisions (0-100) */
  aiConfidenceThreshold: number;

  /** Enable AI analysis (if false, only use rule-based moderation) */
  enableAI: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  subredditName: 'AiAutomod',
  enableAuditLogging: true,
  enableDebugLogging: true,
  aiConfidenceThreshold: 70,
  enableAI: false, // Disabled by default until Phase 3
};

/**
 * Environment-specific settings (not stored in Redis)
 */
export interface EnvConfig {
  /** OpenAI API key */
  openaiApiKey?: string;

  /** Google Gemini API key */
  geminiApiKey?: string;
}

/**
 * AI Provider Configuration from Settings
 * Contains API keys and provider selection configured via Devvit Settings UI
 */
export interface AIProviderConfig {
  /** Claude API key (optional - from settings) */
  claudeApiKey?: string;
  /** OpenAI API key (optional - from settings) */
  openaiApiKey?: string;
  /** OpenAI Compatible API key (optional - from settings) */
  openaiCompatibleApiKey?: string;
  /** OpenAI Compatible base URL (optional - from settings) */
  openaiCompatibleBaseURL?: string;
  /** OpenAI Compatible model name (optional - from settings) */
  openaiCompatibleModel?: string;
  /** Primary AI provider to use */
  primaryProvider: 'claude' | 'openai' | 'openai-compatible';
  /** Fallback provider if primary fails */
  fallbackProvider: 'claude' | 'openai' | 'openai-compatible' | 'none';
}

/**
 * Budget Configuration from Settings
 * Controls daily/monthly spending limits and alert thresholds
 */
export interface BudgetConfig {
  /** Daily spending limit in USD */
  dailyLimitUSD: number;
  /** Monthly spending limit in USD */
  monthlyLimitUSD: number;
  /** Alert threshold configuration */
  alertThresholds: {
    /** Alert at 50% of daily budget */
    threshold50: boolean;
    /** Alert at 75% of daily budget */
    threshold75: boolean;
    /** Alert at 90% of daily budget */
    threshold90: boolean;
  };
}

/**
 * Dry Run Configuration from Settings
 * Controls whether the bot actually takes actions or just logs them
 */
export interface DryRunConfig {
  /** Whether dry-run mode is enabled (no actual moderation actions) */
  dryRunMode: boolean;
  /** Whether to log detailed information during dry-run */
  dryRunLogDetails: boolean;
}
