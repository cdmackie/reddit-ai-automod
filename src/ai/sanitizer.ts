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
 * Content Sanitizer - PII and Sensitive Data Removal
 *
 * This module provides functionality to sanitize user content before sending
 * to AI providers. It removes personally identifiable information (PII) and
 * sensitive data to protect user privacy and comply with data protection regulations.
 *
 * Removed content includes:
 * - Email addresses
 * - URLs (to prevent data leakage)
 * - Phone numbers (US format)
 * - Credit card numbers
 * - Social Security Numbers
 *
 * @module ai/sanitizer
 *
 * @example
 * ```typescript
 * import { contentSanitizer } from './sanitizer.js';
 *
 * // Sanitize a single post
 * const result = contentSanitizer.sanitize('Contact me at john@example.com');
 * console.log(result.sanitizedContent); // 'Contact me at [EMAIL]'
 * console.log(result.piiRemoved); // 1
 *
 * // Sanitize post history
 * const { sanitized, result } = contentSanitizer.sanitizePostHistory([
 *   'Post 1 with email@test.com',
 *   'Post 2 with 555-123-4567'
 * ]);
 * console.log(sanitized); // ['Post 1 with [EMAIL]', 'Post 2 with [PHONE]']
 * ```
 */

import { SanitizationResult } from '../types/ai.js';

/**
 * ContentSanitizer class for removing PII and sensitive data from user content
 *
 * Uses regex patterns to identify and replace sensitive information with
 * standardized placeholders. Tracks metrics about what was removed for
 * auditing and monitoring purposes.
 *
 * Implementation uses pre-compiled regex patterns for performance and
 * handles edge cases like empty strings and very long content.
 */
export class ContentSanitizer {
  /** Maximum allowed content length before truncation */
  private readonly MAX_CONTENT_LENGTH = 5000;

  /** Truncation suffix appended to long content */
  private readonly TRUNCATION_SUFFIX = '... [truncated]';

  /** Pre-compiled regex patterns for performance */
  private readonly patterns = {
    /** Email addresses: matches standard email format */
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    /** URLs: matches http/https URLs */
    url: /https?:\/\/[^\s]+/g,

    /** Phone numbers: US format with optional separators (555-123-4567, 555.123.4567, 5551234567) */
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

    /** Credit card numbers: 16 digits with optional spaces or hyphens */
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

    /** Social Security Numbers: XXX-XX-XXXX format */
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  };

  /**
   * Sanitize content by removing PII and sensitive data
   *
   * This is the primary sanitization method. It processes content through
   * multiple regex patterns to remove different types of sensitive information,
   * tracks what was removed, and truncates if necessary.
   *
   * @param content - The content to sanitize
   * @returns SanitizationResult with metrics and sanitized content
   *
   * @example
   * ```typescript
   * // Basic email and phone sanitization
   * const result = contentSanitizer.sanitize('Call me at 555-123-4567 or email john@example.com');
   * // result.sanitizedContent: 'Call me at [PHONE] or email [EMAIL]'
   * // result.piiRemoved: 2
   * // result.urlsRemoved: 0
   *
   * // Multiple PII types
   * const result2 = contentSanitizer.sanitize(
   *   'SSN: 123-45-6789, Card: 1234 5678 9012 3456, Visit https://scam.com'
   * );
   * // result2.sanitizedContent: 'SSN: [SSN], Card: [CC], Visit [URL]'
   * // result2.piiRemoved: 2 (SSN and CC, URLs counted separately)
   * // result2.urlsRemoved: 1
   *
   * // Empty string handling
   * const result3 = contentSanitizer.sanitize('');
   * // result3.piiRemoved: 0, result3.sanitizedContent: ''
   *
   * // Long content truncation
   * const longContent = 'a'.repeat(6000);
   * const result4 = contentSanitizer.sanitize(longContent);
   * // result4.sanitizedLength: 5000 + '... [truncated]'.length
   * ```
   */
  sanitize(content: string): SanitizationResult {
    // Handle empty content gracefully
    if (!content || content.length === 0) {
      return {
        originalLength: 0,
        sanitizedLength: 0,
        piiRemoved: 0,
        urlsRemoved: 0,
        sanitizedContent: '',
      };
    }

    const originalLength = content.length;
    let sanitized = content;

    // Count matches BEFORE replacing (for accurate metrics)
    const emailCount = (content.match(this.patterns.email) || []).length;
    const urlCount = (content.match(this.patterns.url) || []).length;
    const phoneCount = (content.match(this.patterns.phone) || []).length;
    const creditCardCount = (content.match(this.patterns.creditCard) || []).length;
    const ssnCount = (content.match(this.patterns.ssn) || []).length;

    // Perform replacements in order of specificity
    // (most specific patterns first to avoid conflicts)

    // 1. Remove Social Security Numbers (most specific format)
    sanitized = sanitized.replace(this.patterns.ssn, '[SSN]');

    // 2. Remove Credit Card Numbers (before phone to avoid conflicts)
    sanitized = sanitized.replace(this.patterns.creditCard, '[CC]');

    // 3. Remove Phone Numbers
    sanitized = sanitized.replace(this.patterns.phone, '[PHONE]');

    // 4. Remove Email Addresses
    sanitized = sanitized.replace(this.patterns.email, '[EMAIL]');

    // 5. Remove URLs (least specific, do last)
    sanitized = sanitized.replace(this.patterns.url, '[URL]');

    // Truncate if content is too long
    if (sanitized.length > this.MAX_CONTENT_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_CONTENT_LENGTH) + this.TRUNCATION_SUFFIX;
    }

    // Calculate total PII removed (excluding URLs which are tracked separately)
    const piiRemoved = emailCount + phoneCount + creditCardCount + ssnCount;

    return {
      originalLength,
      sanitizedLength: sanitized.length,
      piiRemoved,
      urlsRemoved: urlCount,
      sanitizedContent: sanitized,
    };
  }

  /**
   * Sanitize an array of posts (e.g., user post history)
   *
   * This method handles batch sanitization of multiple posts efficiently.
   * It joins posts, sanitizes the combined content, then splits back into
   * individual sanitized posts. This approach provides aggregated metrics
   * across all posts.
   *
   * @param posts - Array of post content strings to sanitize
   * @returns Object containing sanitized posts array and aggregated metrics
   *
   * @example
   * ```typescript
   * // Sanitize post history
   * const { sanitized, result } = contentSanitizer.sanitizePostHistory([
   *   'Post 1 with email@test.com and phone 555-1234',
   *   'Post 2 with https://example.com',
   *   'Post 3 with SSN 123-45-6789'
   * ]);
   *
   * // sanitized: [
   * //   'Post 1 with [EMAIL] and phone [PHONE]',
   * //   'Post 2 with [URL]',
   * //   'Post 3 with SSN [SSN]'
   * // ]
   *
   * // result.piiRemoved: 3 (email, phone, SSN)
   * // result.urlsRemoved: 1
   *
   * // Empty array handling
   * const { sanitized: empty, result: emptyResult } =
   *   contentSanitizer.sanitizePostHistory([]);
   * // sanitized: [], result.piiRemoved: 0
   * ```
   */
  sanitizePostHistory(posts: string[]): {
    sanitized: string[];
    result: SanitizationResult;
  } {
    // Handle empty array gracefully
    if (!posts || posts.length === 0) {
      return {
        sanitized: [],
        result: {
          originalLength: 0,
          sanitizedLength: 0,
          piiRemoved: 0,
          urlsRemoved: 0,
          sanitizedContent: '',
        },
      };
    }

    // Join all posts with newlines for batch processing
    const joinedPosts = posts.join('\n');

    // Sanitize the combined content
    const result = this.sanitize(joinedPosts);

    // Split back into individual sanitized posts
    const sanitized = result.sanitizedContent.split('\n');

    // Return sanitized array and aggregated metrics
    return {
      sanitized,
      result,
    };
  }
}

/**
 * Singleton instance for easy reuse throughout the application
 *
 * @example
 * ```typescript
 * import { contentSanitizer } from './sanitizer.js';
 *
 * const result = contentSanitizer.sanitize(userContent);
 * ```
 */
export const contentSanitizer = new ContentSanitizer();
