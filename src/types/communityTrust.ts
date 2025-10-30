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
 * Community Trust System Types
 *
 * Tracks user behavior within specific subreddit communities to determine
 * whether they can skip expensive moderation layers.
 */

/**
 * Tracks user's posting/commenting history in a specific subreddit
 */
export interface ContentTypeStats {
  /** Total number of submissions (posts or comments) */
  submitted: number;

  /** Number approved by moderation system */
  approved: number;

  /** Number flagged for review */
  flagged: number;

  /** Number removed (by system or mod) */
  removed: number;

  /** Approval rate: (approved / submitted) * 100 */
  approvalRate: number;
}

/**
 * Community-specific trust score for a user
 * Separate tracking for posts and comments prevents gaming
 */
export interface CommunityTrust {
  /** User ID */
  userId: string;

  /** Subreddit name */
  subreddit: string;

  /** Post-specific stats */
  posts: ContentTypeStats;

  /** Comment-specific stats */
  comments: ContentTypeStats;

  /** Last time user posted/commented in this community */
  lastActivity: Date;

  /** Last time scores were calculated (for decay tracking) */
  lastCalculated: Date;
}

/**
 * Configuration for community trust thresholds
 */
export interface CommunityTrustConfig {
  /** Minimum approval rate to be considered trusted (default: 70%) */
  minApprovalRate: number;

  /** Minimum submissions required before trust applies (default: 10) */
  minSubmissions: number;

  /** Decay rate per month of inactivity (default: 5% per month) */
  decayRatePerMonth: number;
}

/**
 * Result of trust evaluation
 */
export interface TrustEvaluation {
  /** Is user trusted for this content type? */
  isTrusted: boolean;

  /** Current approval rate (0-100) */
  approvalRate: number;

  /** Number of submissions in this community */
  submissions: number;

  /** Reason for trust decision */
  reason: string;

  /** Months since last activity (for decay calculation) */
  monthsInactive: number;

  /** Amount of decay applied (percentage points) */
  decayApplied: number;
}

/**
 * Tracking data for approved content (for retroactive updates)
 */
export interface ApprovedContentRecord {
  /** Content ID (post or comment) */
  contentId: string;

  /** User who posted */
  userId: string;

  /** Subreddit */
  subreddit: string;

  /** Content type */
  contentType: 'post' | 'comment';

  /** When we approved it */
  approvedAt: Date;

  /** TTL: 24 hours (for ModAction audit) */
  expiresAt: Date;
}
