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
