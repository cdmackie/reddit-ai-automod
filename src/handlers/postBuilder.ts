/**
 * Post builder helper for creating CurrentPost objects
 *
 * Provides utilities to build CurrentPost objects from Reddit Post instances,
 * extracting URLs, domains, word counts, and other metadata needed for rule evaluation.
 *
 * @module handlers/postBuilder
 */

import { Post } from '@devvit/public-api';
import { CurrentPost } from '../types/profile.js';

/**
 * Helper class for building CurrentPost objects from Reddit posts
 */
export class PostBuilder {
  // URL_REGEX removed - using whitespace splitting to prevent ReDoS

  /**
   * Build a CurrentPost object from a Reddit Post
   *
   * Extracts and analyzes post content to create a rich CurrentPost object
   * suitable for rule evaluation. Handles edge cases like deleted content,
   * malformed URLs, and empty posts gracefully.
   *
   * @param post - Reddit Post object from Devvit API
   * @returns CurrentPost object with extracted metadata
   *
   * @example
   * ```typescript
   * const post = await reddit.getPostById(postId);
   * const currentPost = PostBuilder.buildCurrentPost(post);
   * console.log(`Post has ${currentPost.wordCount} words`);
   * ```
   */
  static buildCurrentPost(post: Post): CurrentPost {
    try {
      // Validate input
      if (!post || !post.id) {
        console.warn('[PostBuilder] Invalid post object');
        return this.getDefaultPost(post);
      }

      // Extract basic fields
      const title = post.title || '';
      const body = this.extractBody(post);
      const subreddit = post.subredditName || 'unknown';

      // Sanity check lengths (Reddit's limits are ~300 chars title, ~40k chars body)
      if (title.length > 500 || body.length > 100000) {
        console.warn('[PostBuilder] Post exceeds reasonable length limits', {
          postId: post.id,
          titleLength: title.length,
          bodyLength: body.length,
        });
        // Continue processing but log warning
      }

      // Determine post type
      const type = this.determinePostType(post);

      // Extract URLs and domains
      const urls = this.extractUrls(title, body);
      const domains = this.extractDomains(urls);

      // Calculate text metrics
      const fullText = `${title} ${body}`;
      const wordCount = this.countWords(fullText);
      const charCount = fullText.length;

      // Build CurrentPost object
      const currentPost: CurrentPost = {
        title,
        body,
        subreddit,
        type,
        urls,
        domains,
        wordCount,
        charCount,
        bodyLength: charCount, // Alias for charCount
        titleLength: title.length,
        hasMedia: this.hasMedia(type),
        linkUrl: type === 'link' ? post.url : undefined,
        isEdited: post.edited || false,
      };

      return currentPost;
    } catch (error) {
      // If parsing fails, return safe defaults
      console.error('[PostBuilder] Error building CurrentPost:', {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
        // Don't log the full error object which might contain post content
      });
      return this.getDefaultPost(post);
    }
  }

  /**
   * Extract post body text
   *
   * Handles different post types (text posts, link posts) and safely extracts
   * the body content.
   *
   * @param post - Reddit Post object
   * @returns Post body text (empty string if none)
   */
  private static extractBody(post: Post): string {
    // Text posts have body
    if (post.body) {
      return post.body;
    }

    // Link posts have URL as content
    if (post.url && post.url !== post.permalink) {
      return post.url;
    }

    return '';
  }

  /**
   * Determine post type from URL and content
   * Uses path-aware pattern matching to avoid false positives
   *
   * @param post - Reddit Post object
   * @returns Post type
   */
  private static determinePostType(
    post: Post
  ): 'text' | 'link' | 'image' | 'video' | 'gallery' | 'poll' {
    if (post.url) {
      const url = post.url.toLowerCase();

      // Video detection - check domain + path
      if (
        url.includes('v.redd.it') ||
        url.includes('youtube.com/watch') ||
        url.includes('youtu.be/') ||
        url.includes('vimeo.com/') ||
        url.includes('dailymotion.com/')
      ) {
        return 'video';
      }

      // Image detection - check extension at end of path (avoid false positives)
      if (
        url.includes('i.redd.it') ||
        url.match(/\.(jpg|jpeg|png|gif|gifv|webp|svg)(\?|#|$)/i)
      ) {
        return 'image';
      }

      // Gallery detection
      if (url.includes('/gallery/')) {
        return 'gallery';
      }
    }

    // Check if it's a link post (has URL but no body)
    if (post.url && post.url !== post.permalink && !post.body) {
      return 'link';
    }

    return 'text';
  }

  /**
   * Extract all URLs from text
   * Uses whitespace splitting to prevent ReDoS attacks
   *
   * @param title - Post title
   * @param body - Post body
   * @returns Array of URLs found (may be empty)
   */
  private static extractUrls(title: string, body: string): string[] {
    const fullText = `${title} ${body}`;
    const urls: string[] = [];

    // Split on whitespace first (prevents ReDoS)
    const words = fullText.split(/\s+/);

    for (const word of words) {
      if (word.startsWith('http://') || word.startsWith('https://')) {
        // Remove trailing punctuation
        const cleaned = word.replace(/[.,;:!?)]+$/, '');
        if (cleaned.length <= 2048) {
          // Reasonable URL length limit
          urls.push(cleaned);
        }
      }
    }

    return [...new Set(urls)]; // Deduplicate
  }

  /**
   * Extract unique domains from URLs
   * Only allows http/https protocols for security
   *
   * @param urls - Array of URLs
   * @returns Array of unique domains (may be empty)
   */
  private static extractDomains(urls: string[]): string[] {
    const domains = new Set<string>();

    for (const url of urls) {
      try {
        const urlObj = new URL(url);

        // Only allow http/https protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          console.warn(
            `[PostBuilder] Non-HTTP URL blocked: ${url.substring(0, 50)}`
          );
          continue;
        }

        // Validate hostname is not empty
        if (!urlObj.hostname || urlObj.hostname.length === 0) {
          console.warn(`[PostBuilder] Empty hostname in URL`);
          continue;
        }

        domains.add(urlObj.hostname);
      } catch (error) {
        // Invalid URL, skip it (don't log the URL itself - might be malicious)
        console.warn('[PostBuilder] Invalid URL format encountered');
      }
    }

    return Array.from(domains);
  }

  /**
   * Count words in text
   *
   * Splits text by whitespace and counts non-empty words.
   *
   * @param text - Text to count words in
   * @returns Number of words
   */
  private static countWords(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    const words = text.split(/\s+/).filter((word) => word.length > 0);
    return words.length;
  }

  /**
   * Check if post type contains media
   *
   * @param type - Post type
   * @returns True if post type is image, video, or gallery
   */
  private static hasMedia(
    type: 'text' | 'link' | 'image' | 'video' | 'gallery' | 'poll'
  ): boolean {
    return type === 'image' || type === 'video' || type === 'gallery';
  }

  /**
   * Get default CurrentPost object for error cases
   *
   * Returns a safe default CurrentPost with minimal information when
   * parsing fails.
   *
   * @param post - Reddit Post object
   * @returns CurrentPost with safe defaults
   */
  private static getDefaultPost(post: Post): CurrentPost {
    return {
      title: post.title || '',
      body: '',
      subreddit: post.subredditName || 'unknown',
      type: 'text',
      urls: [],
      domains: [],
      wordCount: 0,
      charCount: 0,
      bodyLength: 0,
      titleLength: post.title?.length || 0,
      hasMedia: false,
      linkUrl: undefined,
      isEdited: false,
    };
  }
}
