/**
 * Type definitions for user profiling system
 *
 * This module defines all interfaces and types used in the user profiling system
 * for analyzing Reddit users and calculating trust scores.
 */

/**
 * User profile data fetched from Reddit API
 * Contains basic account information used for trust score calculation
 */
export interface UserProfile {
  /** Reddit user ID (format: t2_xxxxx) */
  userId: string;
  /** Reddit username */
  username: string;
  /** Account age calculated in days from creation date */
  accountAgeInDays: number;
  /** Comment karma (from comments only) */
  commentKarma: number;
  /** Post karma (from posts/links only) */
  postKarma: number;
  /** Total karma (commentKarma + postKarma) */
  totalKarma: number;
  /** Whether the user has verified their email with Reddit */
  emailVerified: boolean;
  /** Whether the user is a moderator of any subreddit */
  isModerator: boolean;
  /** Whether the user has user flair */
  hasUserFlair: boolean;
  /** User flair text (if any) */
  userFlairText?: string;
  /** Whether the user has Reddit Premium */
  hasPremium: boolean;
  /** Whether the account is verified */
  isVerified: boolean;
  /** Timestamp when this profile data was fetched */
  fetchedAt: Date;
}

/**
 * A single post or comment from a user's history
 * Represents one item in the user's recent activity
 */
export interface PostHistoryItem {
  /** Reddit ID of the post or comment */
  id: string;
  /** Type of content */
  type: 'post' | 'comment';
  /** Name of the subreddit where this was posted */
  subreddit: string;
  /** Text content (post body or comment body) */
  content: string;
  /** Score (upvotes - downvotes) */
  score: number;
  /** Timestamp when this was created */
  createdAt: Date;
}

/**
 * Complete post and comment history for a user
 * Includes both raw items and calculated metrics
 */
export interface UserPostHistory {
  /** Reddit user ID (format: t2_xxxxx) */
  userId: string;
  /** Reddit username */
  username: string;
  /** Array of recent posts and comments (newest first) */
  items: PostHistoryItem[];
  /** Total number of posts in history */
  totalPosts: number;
  /** Total number of comments in history */
  totalComments: number;
  /** Unique list of subreddits user has posted/commented in */
  subreddits: string[];
  /** Calculated metrics from the post history */
  metrics: {
    /** Total number of items fetched */
    totalItems: number;
    /** Number of posts in target subreddits (FriendsOver40/50, bitcointaxes) */
    postsInTargetSubs: number;
    /** Number of posts in dating/relationship subreddits */
    postsInDatingSubs: number;
    /** Average score across all posts and comments */
    averageScore: number;
    /** Creation date of the oldest item in history */
    oldestItemDate: Date;
    /** Creation date of the newest item in history */
    newestItemDate: Date;
  };
  /** Timestamp when this history was fetched */
  fetchedAt: Date;
}

/**
 * Current post being evaluated by moderation system
 * Contains rich metadata for rule evaluation
 */
export interface CurrentPost {
  /** Post title */
  title: string;
  /** Post body text */
  body: string;
  /** Subreddit where post was submitted */
  subreddit: string;
  /** Post type */
  type: 'text' | 'link' | 'image' | 'video' | 'gallery' | 'poll';
  /** All URLs found in the post */
  urls: string[];
  /** Unique domains extracted from URLs */
  domains: string[];
  /** Word count (title + body) */
  wordCount: number;
  /** Character count (title + body) */
  charCount: number;
  /** Body length in characters (alias for charCount) */
  bodyLength: number;
  /** Title length in characters */
  titleLength: number;
  /** Whether post contains media (images, videos, etc.) */
  hasMedia: boolean;
  /** Primary link URL for link posts */
  linkUrl?: string;
  /** Whether post has been edited */
  isEdited: boolean;
}

/**
 * Detailed breakdown of trust score components
 * Shows how each factor contributed to the total trust score
 */
export interface TrustScoreBreakdown {
  /** Points from account age (0-40) */
  accountAgeScore: number;
  /** Points from total karma (0-30) */
  karmaScore: number;
  /** Points from email verification (0-15) */
  emailVerifiedScore: number;
  /** Points from approved post history in subreddit (0-15) */
  approvedHistoryScore: number;
}

/**
 * Trust score calculation result
 * Used to determine if a user should bypass AI analysis
 */
export interface TrustScore {
  /** Reddit user ID (format: t2_xxxxx) */
  userId: string;
  /** Subreddit where trust score was calculated */
  subreddit: string;
  /** Total trust score (0-100) */
  totalScore: number;
  /** Breakdown of score components */
  breakdown: TrustScoreBreakdown;
  /** Whether user is trusted (totalScore >= threshold) */
  isTrusted: boolean;
  /** Trust score threshold (typically 70) */
  threshold: number;
  /** Timestamp when this score was calculated */
  calculatedAt: Date;
  /** Timestamp when this score expires */
  expiresAt: Date;
}

/**
 * Complete result of profile analysis
 * Combines all profiling data for a user
 */
export interface ProfileAnalysisResult {
  /** User profile data */
  profile: UserProfile;
  /** User post history data */
  history: UserPostHistory;
  /** Calculated trust score */
  trustScore: TrustScore;
  /** Whether this user should bypass AI analysis (same as trustScore.isTrusted) */
  shouldBypassAI: boolean;
}

/**
 * Configuration for the profiling system
 * Controls cache TTLs, thresholds, and target subreddits
 */
export interface ProfileConfig {
  /** Number of posts/comments to fetch for history analysis (fetches up to 100 posts + 100 comments) */
  historyLimit: number;
  /** Cache TTL for user profiles in milliseconds */
  profileCacheTTL: number;
  /** Cache TTL for post history in milliseconds */
  historyCacheTTL: number;
  /** Cache TTL for trust scores in milliseconds */
  trustScoreCacheTTL: number;
  /** Trust threshold (0-100) for bypassing AI analysis */
  trustThreshold: number;
  /** Target subreddits for detecting relevant activity */
  targetSubreddits: string[];
  /** Dating-related subreddits for pattern detection */
  datingSubreddits: string[];
}

/**
 * Default configuration for the profiling system
 * Can be overridden via Redis config storage
 */
export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  historyLimit: 200, // Fetch 200 items to ensure we get ~100 posts + ~100 comments (sanitized and compacted)
  profileCacheTTL: 86400000, // 24 hours
  historyCacheTTL: 86400000, // 24 hours
  trustScoreCacheTTL: 604800000, // 7 days
  trustThreshold: 70,
  targetSubreddits: ['FriendsOver40', 'FriendsOver50', 'bitcointaxes'],
  datingSubreddits: [
    'r4r',
    'ForeverAloneDating',
    'Dating',
    'dating_advice',
    'seduction',
    'r4r30plus',
    'r4r40plus',
  ],
};
