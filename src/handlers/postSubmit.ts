/**
 * Post submission event handler
 *
 * Handles new post submissions and applies moderation rules
 */

import { TriggerContext, TriggerEvent, Devvit } from '@devvit/public-api';
import { AuditLogger } from '../storage/audit';
import { UserProfileFetcher } from '../profile/fetcher';
import { PostHistoryAnalyzer } from '../profile/historyAnalyzer';
import { TrustScoreCalculator } from '../profile/trustScore';
import { RateLimiter } from '../profile/rateLimiter';
import { RulesEngine } from '../rules/engine.js';
import { RuleEvaluationContext } from '../types/rules.js';
import { AIAnalyzer } from '../ai/analyzer.js';
import { AIQuestionBatchResult } from '../types/ai.js';
import { ModAction } from '../types/storage.js';
import { PostBuilder } from './postBuilder.js';

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

  // Phase 3.3: Rules engine integration with optional AI analysis
  console.log(`[PostSubmit] User ${author} not trusted, evaluating rules...`);

  // 1. Build CurrentPost object
  const currentPost = PostBuilder.buildCurrentPost(post);

  // 2. Initialize rules engine
  const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

  // 3. Check if AI analysis is needed for this subreddit
  const needsAI = await rulesEngine.needsAIAnalysis(subredditName);
  let aiAnalysis: AIQuestionBatchResult | undefined;
  let aiCost = 0;

  if (needsAI) {
    console.log(`[PostSubmit] AI analysis required for ${subredditName}`);

    // Get required AI questions from rules
    const aiQuestions = await rulesEngine.getRequiredAIQuestions(subredditName);

    if (aiQuestions.length > 0) {
      console.log(`[PostSubmit] Running AI analysis with ${aiQuestions.length} questions`);

      // Initialize AI analyzer
      const aiAnalyzer = AIAnalyzer.getInstance(context as Devvit.Context);

      // Build current post data for AI
      const aiCurrentPost = {
        title: currentPost.title,
        body: currentPost.body,
        subreddit: currentPost.subreddit,
      };

      // Run AI analysis
      const aiResult = await aiAnalyzer.analyzeUserWithQuestions(
        userId,
        profile,
        history,
        aiCurrentPost,
        aiQuestions,
        subredditName,
        trustScore.totalScore
      );

      if (aiResult !== null) {
        aiAnalysis = aiResult;
        aiCost = aiResult.costUSD;
        console.log(`[PostSubmit] AI analysis complete: cost=$${aiCost.toFixed(4)}`);
      } else {
        console.warn(
          `[PostSubmit] AI analysis failed or budget exceeded - rules will evaluate without AI data`,
          {
            subreddit: subredditName,
            questionsRequested: aiQuestions.length,
          }
        );
        // AI rules will be skipped by rules engine
      }
    }
  } else {
    console.log(`[PostSubmit] No AI rules for ${subredditName}, skipping AI analysis`);
  }

  // 4. Build evaluation context
  const evalContext: RuleEvaluationContext = {
    profile,
    postHistory: history,
    currentPost,
    aiAnalysis,
    subreddit: subredditName,
  };

  // 5. Evaluate rules
  const startTime = Date.now();
  const ruleResult = await rulesEngine.evaluateRules(evalContext);
  const executionTime = Date.now() - startTime;

  console.log(`[PostSubmit] Rule evaluation complete:`, {
    action: ruleResult.action,
    matchedRule: ruleResult.matchedRule,
    confidence: ruleResult.confidence,
    dryRun: ruleResult.dryRun,
    executionTime,
  });

  // 6. Handle result and audit log
  const metadata = {
    dryRun: ruleResult.dryRun,
    aiCost,
    executionTime,
    trustScore: trustScore.totalScore,
  };

  switch (ruleResult.action) {
    case 'APPROVE':
      await auditLogger.log({
        action: ModAction.APPROVE,
        userId: author,
        contentId: postId,
        reason: ruleResult.reason,
        ruleId: ruleResult.matchedRule,
        confidence: ruleResult.confidence,
        metadata,
      });
      // Increment approved count
      await trustScoreCalc.incrementApprovedCount(userId, subredditName);
      break;

    case 'FLAG':
      await auditLogger.log({
        action: ModAction.FLAG,
        userId: author,
        contentId: postId,
        reason: ruleResult.reason,
        ruleId: ruleResult.matchedRule,
        confidence: ruleResult.confidence,
        metadata,
      });
      break;

    case 'REMOVE':
      // Phase 3.4: Action executors will handle actual removal
      // For now, FLAG for manual review
      await auditLogger.log({
        action: ModAction.FLAG,
        userId: author,
        contentId: postId,
        reason: `[REMOVE ACTION - Pending Phase 3.4] ${ruleResult.reason}`,
        ruleId: ruleResult.matchedRule,
        confidence: ruleResult.confidence,
        metadata,
      });
      console.log(`[PostSubmit] REMOVE action pending Phase 3.4 implementation`);
      break;

    case 'COMMENT':
      // Phase 3.4: Action executors will handle comments
      // For now, FLAG for manual review
      await auditLogger.log({
        action: ModAction.FLAG,
        userId: author,
        contentId: postId,
        reason: `[COMMENT ACTION - Pending Phase 3.4] ${ruleResult.reason}`,
        ruleId: ruleResult.matchedRule,
        confidence: ruleResult.confidence,
        metadata,
      });
      console.log(`[PostSubmit] COMMENT action pending Phase 3.4 implementation`);
      break;
  }

  console.log(`[PostSubmit] Post ${postId} processed successfully`);
}
