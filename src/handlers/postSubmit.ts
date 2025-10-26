/**
 * Post submission event handler
 *
 * Handles new post submissions and applies moderation rules
 */

import { TriggerContext, TriggerEvent } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit';
import { UserProfileFetcher } from '../profile/fetcher';
import { PostHistoryAnalyzer } from '../profile/historyAnalyzer';
import { TrustScoreCalculator } from '../profile/trustScore';
import { RateLimiter } from '../profile/rateLimiter';

// Singleton rate limiter shared across all handler invocations
const rateLimiter = new RateLimiter();

/**
 * Handle post submission events
 */
export async function handlePostSubmit(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { reddit, redis } = context;

  // Get post from event
  if (!('post' in event) || !event.post) {
    console.error('[PostSubmit] No post in event');
    return;
  }

  const postId = event.post.id;

  // Fetch full post details
  const post = await reddit.getPostById(postId);

  // Initialize audit logger
  const auditLogger = new AuditLogger(redis);

  const author = post.authorName || '[deleted]';
  const userId = post.authorId;
  const title = post.title || '';
  const subredditName = post.subredditName || 'unknown';

  console.log(`[PostSubmit] Processing post: ${postId} by u/${author}`);
  console.log(`[PostSubmit] Subreddit: r/${subredditName}`);
  console.log(`[PostSubmit] Title: ${title}`);

  // Handle deleted or missing author
  if (!userId || author === '[deleted]') {
    console.log(`[PostSubmit] Post by deleted user, flagging for review`);
    await auditLogger.logFlag(
      postId,
      userId || 'unknown',
      'Post by deleted or unknown user'
    );
    console.log(`[PostSubmit] Post ${postId} flagged successfully`);
    return;
  }

  // Initialize profiling services
  const profileFetcher = new UserProfileFetcher(redis, reddit, rateLimiter);
  const historyAnalyzer = new PostHistoryAnalyzer(redis, reddit, rateLimiter);
  const trustScoreCalc = new TrustScoreCalculator(redis);

  // Fast path: Check if user is already trusted (Redis lookup)
  const isTrusted = await trustScoreCalc.isTrustedUser(userId, subredditName);
  if (isTrusted) {
    console.log(`[PostSubmit] User ${author} is trusted, auto-approving`);
    await auditLogger.logApproval(
      postId,
      author,
      'Trusted user (score >= 70)'
    );
    console.log(`[PostSubmit] Post ${postId} processed successfully`);
    return;
  }

  console.log(`[PostSubmit] User ${author} not in trusted cache, fetching profile...`);

  // Fetch profile and history in parallel (with cache)
  const [profile, history] = await Promise.all([
    profileFetcher.getUserProfile(userId),
    historyAnalyzer.getPostHistory(userId, author)
  ]);

  if (!profile) {
    console.log(`[PostSubmit] Could not fetch profile for ${author}`);
    // Fallback: FLAG for manual review (fail safe)
    await auditLogger.logFlag(
      postId,
      author,
      'Profile fetch failed, flagged for manual review'
    );
    console.log(`[PostSubmit] Post ${postId} flagged for manual review`);
    return;
  }

  console.log(`[PostSubmit] Profile fetched for ${author}: Age=${profile.accountAgeInDays}d, Karma=${profile.totalKarma}`);

  // Calculate trust score
  const trustScore = await trustScoreCalc.calculateTrustScore(
    profile,
    history,
    subredditName
  );

  console.log(`[PostSubmit] Trust score for ${author}: ${trustScore.totalScore}/100`);
  console.log(`[PostSubmit] Score breakdown: AccountAge=${trustScore.breakdown.accountAgeScore}, Karma=${trustScore.breakdown.karmaScore}, Email=${trustScore.breakdown.emailVerifiedScore}, Approved=${trustScore.breakdown.approvedHistoryScore}`);

  // If trusted now, mark as trusted and approve
  if (trustScore.isTrusted) {
    console.log(`[PostSubmit] User ${author} achieved trusted status`);
    await auditLogger.logApproval(
      postId,
      author,
      `Trusted user (score: ${trustScore.totalScore}/100)`
    );
    // Increment approved count for next time
    await trustScoreCalc.incrementApprovedCount(userId, subredditName);
    console.log(`[PostSubmit] Post ${postId} processed successfully`);
    return;
  }

  // Phase 2: Here we will add AI analysis for non-trusted users
  console.log(`[PostSubmit] User ${author} not trusted, will need AI analysis (Phase 2)`);
  await auditLogger.logApproval(
    postId,
    author,
    `Not trusted (score: ${trustScore.totalScore}/100), approved for now (AI analysis in Phase 2)`
  );

  // Increment approved count for future posts
  await trustScoreCalc.incrementApprovedCount(userId, subredditName);

  console.log(`[PostSubmit] Post ${postId} processed successfully`);
}
