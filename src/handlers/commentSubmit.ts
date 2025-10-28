/**
 * Comment submission event handler
 *
 * Handles new comment submissions and applies moderation rules
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
import { executeAction } from '../actions/executor.js';
import { SettingsService } from '../config/settingsService.js';
import { sendRealtimeDigest } from '../notifications/modmailDigest.js';
import { CurrentPost } from '../types/profile.js';
import { executeModerationPipeline } from '../moderation/pipeline.js';

// Singleton rate limiter shared across all handler invocations
const rateLimiter = new RateLimiter();

/**
 * Handle comment submission events
 */
export async function handleCommentSubmit(
  event: TriggerEvent,
  context: TriggerContext
): Promise<void> {
  const { reddit, redis } = context;

  // Get comment from event (type guard for TriggerEvent union)
  if (!('comment' in event) || !event.comment) {
    console.error('[CommentSubmit] No comment in event');
    return;
  }

  const commentId = event.comment.id;

  // Fetch full comment details
  const comment = await reddit.getCommentById(commentId);

  // Initialize audit logger
  const auditLogger = new AuditLogger(redis);

  const author = comment.authorName || '[deleted]';
  const userId = comment.authorId;
  const body = comment.body || '';
  const subredditName = comment.subredditName || 'unknown';

  console.log(`[CommentSubmit] Processing comment: ${commentId} by u/${author}`);
  console.log(`[CommentSubmit] Subreddit: r/${subredditName}`);
  console.log(`[CommentSubmit] Body preview: ${body.substring(0, 100)}...`);

  // Handle deleted or missing author
  if (!userId || author === '[deleted]') {
    console.log(`[CommentSubmit] Comment by deleted user, flagging for review`);
    const auditLog = await auditLogger.log({
      action: ModAction.FLAG,
      userId: userId || 'unknown',
      contentId: commentId,
      reason: 'Comment by deleted or unknown user',
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    console.log(`[CommentSubmit] Comment ${commentId} flagged successfully`);
    return;
  }

  // Skip the bot's own comments to prevent infinite loops
  const currentUser = await reddit.getCurrentUser();
  if (currentUser && author === currentUser.username) {
    console.log(`[CommentSubmit] Skipping bot's own comment by u/${author}`);
    return;
  }

  // Initialize profiling services
  const profileFetcher = new UserProfileFetcher(redis, reddit, rateLimiter);
  const historyAnalyzer = new PostHistoryAnalyzer(redis, reddit, rateLimiter);
  const trustScoreCalc = new TrustScoreCalculator(redis);

  // Fast path: Check if user is already trusted (Redis lookup)
  const isTrusted = await trustScoreCalc.isTrustedUser(userId, subredditName);
  if (isTrusted) {
    console.log(`[CommentSubmit] User ${author} is trusted, auto-approving`);
    const auditLog = await auditLogger.log({
      action: ModAction.APPROVE,
      userId: author,
      contentId: commentId,
      reason: 'Trusted user (score >= 70)',
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    console.log(`[CommentSubmit] Comment ${commentId} processed successfully`);
    return;
  }

  console.log(`[CommentSubmit] User ${author} not in trusted cache, fetching profile...`);

  // Fetch profile and history in parallel (with cache)
  const [profile, history] = await Promise.all([
    profileFetcher.getUserProfile(userId),
    historyAnalyzer.getPostHistory(userId, author),
  ]);

  if (!profile) {
    console.log(`[CommentSubmit] Could not fetch profile for ${author}`);
    // Fallback: FLAG for manual review (fail safe)
    const auditLog = await auditLogger.log({
      action: ModAction.FLAG,
      userId: author,
      contentId: commentId,
      reason: 'Profile fetch failed, flagged for manual review',
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    console.log(`[CommentSubmit] Comment ${commentId} flagged for manual review`);
    return;
  }

  console.log(
    `[CommentSubmit] Profile fetched for ${author}: Age=${profile.accountAgeInDays}d, Karma=${profile.totalKarma}`
  );

  // Calculate trust score
  const trustScore = await trustScoreCalc.calculateTrustScore(
    profile,
    history,
    subredditName
  );

  console.log(`[CommentSubmit] Trust score for ${author}: ${trustScore.totalScore}/100`);

  // If trusted now, mark as trusted and approve
  if (trustScore.isTrusted) {
    console.log(`[CommentSubmit] User ${author} achieved trusted status`);
    const auditLog = await auditLogger.log({
      action: ModAction.APPROVE,
      userId: author,
      contentId: commentId,
      reason: `Trusted user (score: ${trustScore.totalScore}/100)`,
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    // Increment approved count for next time
    await trustScoreCalc.incrementApprovedCount(userId, subredditName);
    console.log(`[CommentSubmit] Comment ${commentId} processed successfully`);
    return;
  }

  // 1. Build CurrentPost-compatible object for comments (needed for both pipeline and rules)
  // Note: Comments don't have all fields posts have, provide safe defaults
  const currentPost: CurrentPost = {
    title: '', // Comments don't have titles
    body: body,
    subreddit: subredditName,
    type: 'text', // Comments are always text
    urls: [], // Could extract URLs from body if needed
    domains: [],
    wordCount: body.split(/\s+/).filter(Boolean).length,
    charCount: body.length,
    bodyLength: body.length,
    titleLength: 0,
    hasMedia: false,
    linkUrl: undefined,
    isEdited: false, // Comment API doesn't easily expose edit status
  };

  // ===== Execute Moderation Pipeline (Layers 1-2) =====
  const correlationId = `comment-${commentId}-${Date.now()}`;
  console.log('[CommentSubmit] Executing moderation pipeline', { correlationId });

  const pipelineResult = await executeModerationPipeline(
    context as Devvit.Context,
    profile,
    currentPost,
    'comment'
  );

  // If pipeline triggered an action, execute and return
  if (pipelineResult.action !== 'APPROVE') {
    console.log('[CommentSubmit] Pipeline triggered action', {
      correlationId,
      layer: pipelineResult.layerTriggered,
      action: pipelineResult.action,
      reason: pipelineResult.reason,
    });

    // Get dry-run config
    const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
    const dryRunEnabled = dryRunConfig.dryRunMode;

    // Execute the action using the existing executeAction API (comment API is compatible with Post API)
    // Map pipeline reason to the correct field based on action type
    const executionResult = await executeAction({
      post: comment as any, // Comment API is compatible with Post API for basic fields
      ruleResult: {
        action: pipelineResult.action,
        reason: pipelineResult.reason, // For FLAG actions
        comment: pipelineResult.action === 'COMMENT' ? pipelineResult.reason : undefined,
        removalReason: pipelineResult.action === 'REMOVE' ? pipelineResult.reason : undefined,
        matchedRule: pipelineResult.metadata?.builtInRuleId ||
                     (pipelineResult.metadata?.moderationCategories?.join(',')) ||
                     'pipeline',
        confidence: 100, // Pipeline decisions are deterministic/binary
        dryRun: dryRunEnabled,
      },
      profile,
      context,
      dryRun: dryRunEnabled,
    });

    // Enhanced audit log with pipeline metadata
    const auditAction = executionResult.success
      ? (pipelineResult.action === 'FLAG' ? ModAction.FLAG :
         pipelineResult.action === 'REMOVE' ? ModAction.REMOVE :
         pipelineResult.action === 'COMMENT' ? ModAction.COMMENT :
         ModAction.FLAG) // Unknown actions become FLAG in audit
      : ModAction.FLAG; // Failed actions become FLAG for manual review

    const auditLog = await auditLogger.log({
      action: auditAction,
      userId: author,
      contentId: commentId,
      reason: executionResult.success
        ? pipelineResult.reason
        : `Action execution failed: ${executionResult.error || 'Unknown error'}`,
      ruleId: pipelineResult.metadata?.builtInRuleId ||
              (pipelineResult.metadata?.moderationCategories?.join(',')) ||
              'pipeline',
      confidence: 100, // Pipeline decisions are deterministic/binary
      metadata: {
        layer: pipelineResult.layerTriggered,
        executionTimeMs: Date.now() - Date.now(), // Will be negligible
        trustScore: trustScore.totalScore,
        actionSuccess: executionResult.success,
        aiCost: 0, // Layers 1-2 are free
        dryRun: dryRunEnabled,
        executionError: executionResult.error,
        executionDetails: executionResult.details,
        bodyPreview: body.substring(0, 200),
        ...pipelineResult.metadata,
      },
    });

    // Send real-time digest if enabled
    if (auditLog) {
      await sendRealtimeDigest(context as Devvit.Context, auditLog);
    }

    // Log execution result
    if (!executionResult.success) {
      console.error(`[CommentSubmit] Pipeline action execution failed:`, {
        commentId,
        layer: pipelineResult.layerTriggered,
        action: pipelineResult.action,
        error: executionResult.error,
      });
    }

    console.log(`[CommentSubmit] Comment ${commentId} processed by pipeline`);
    return; // Short-circuit, don't continue to custom rules
  }

  // Continue to Layer 3 (custom rules + AI) if pipeline didn't trigger
  console.log('[CommentSubmit] Pipeline approved, continuing to custom rules', { correlationId });

  // Rules engine integration with optional AI analysis
  console.log(`[CommentSubmit] User ${author} not trusted, evaluating rules...`);

  // 2. Initialize rules engine
  const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

  // 3. Check if AI analysis is needed for comments in this subreddit
  const needsAI = await rulesEngine.needsAIAnalysis(subredditName, 'comment');
  let aiAnalysis: AIQuestionBatchResult | undefined;
  let aiCost = 0;

  if (needsAI) {
    console.log(`[CommentSubmit] AI analysis required for ${subredditName} comments`);

    // Get required AI questions from rules
    const aiQuestions = await rulesEngine.getRequiredAIQuestions(subredditName, 'comment');

    if (aiQuestions.length > 0) {
      console.log(`[CommentSubmit] Running AI analysis with ${aiQuestions.length} questions`);

      // Initialize AI analyzer
      const aiAnalyzer = AIAnalyzer.getInstance(context as Devvit.Context);

      // Build current post data for AI
      const aiCurrentPost = {
        title: '', // No title for comments
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
        console.log(`[CommentSubmit] AI analysis complete: cost=$${aiCost.toFixed(4)}`);
      } else {
        console.warn(
          `[CommentSubmit] AI analysis failed or budget exceeded - rules will evaluate without AI data`,
          {
            subreddit: subredditName,
            questionsRequested: aiQuestions.length,
          }
        );
        // AI rules will be skipped by rules engine
      }
    }
  } else {
    console.log(`[CommentSubmit] No AI rules for ${subredditName} comments, skipping AI analysis`);
  }

  // 4. Build evaluation context
  const evalContext: RuleEvaluationContext = {
    profile,
    postHistory: history,
    currentPost,
    aiAnalysis,
    subreddit: subredditName,
  };

  // 5. Evaluate rules with contentType='comment'
  const startTime = Date.now();
  const ruleResult = await rulesEngine.evaluateRules(evalContext, 'comment');
  const executionTime = Date.now() - startTime;

  // Apply dry-run precedence: Settings OR RuleSet (safety first)
  const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
  const effectiveDryRun = dryRunConfig.dryRunMode || ruleResult.dryRun;

  console.log(`[CommentSubmit] Rule evaluation complete:`, {
    action: ruleResult.action,
    matchedRule: ruleResult.matchedRule,
    confidence: ruleResult.confidence,
    dryRun: effectiveDryRun,
    executionTime,
  });

  // 6. Handle result and audit log
  const metadata = {
    dryRun: effectiveDryRun,
    ruleSetDryRun: ruleResult.dryRun,
    settingsDryRun: dryRunConfig.dryRunMode,
    aiCost,
    executionTime,
    trustScore: trustScore.totalScore,
  };

  // Execute the action (pass comment as if it's a post - executeAction handles both)
  const executionResult = await executeAction({
    post: comment as any, // Comment API is compatible with Post API for basic fields
    ruleResult,
    profile,
    context,
    dryRun: effectiveDryRun,
  });

  // Log to audit trail
  const auditAction = executionResult.success
    ? (ruleResult.action === 'APPROVE'
        ? ModAction.APPROVE
        : ruleResult.action === 'FLAG'
          ? ModAction.FLAG
          : ruleResult.action === 'REMOVE'
            ? ModAction.REMOVE
            : ruleResult.action === 'COMMENT'
              ? ModAction.COMMENT
              : ModAction.FLAG) // Unknown actions become FLAG in audit
    : ModAction.FLAG; // Failed actions become FLAG for manual review

  const auditLog = await auditLogger.log({
    action: auditAction,
    userId: author,
    contentId: commentId,
    reason: executionResult.success
      ? ruleResult.reason
      : `Action execution failed: ${executionResult.error || 'Unknown error'}`,
    ruleId: ruleResult.matchedRule,
    confidence: ruleResult.confidence,
    metadata: {
      ...metadata,
      executionSuccess: executionResult.success,
      executionError: executionResult.error,
      executionDetails: executionResult.details,
      bodyPreview: body.substring(0, 200),
    },
  });

  // Send realtime digest if enabled
  await sendRealtimeDigest(context as Devvit.Context, auditLog);

  // Increment approved count for successful approvals
  if (executionResult.success && ruleResult.action === 'APPROVE') {
    await trustScoreCalc.incrementApprovedCount(userId, subredditName);
  }

  console.log(`[CommentSubmit] Comment ${commentId} processed successfully`);
}
