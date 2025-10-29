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
import { executeAction } from '../actions/executor.js';
import { initializeDefaultRules, isInitialized } from './appInstall.js';
import { SettingsService } from '../config/settingsService.js';
import { sendRealtimeDigest } from '../notifications/modmailDigest.js';
import { executeModerationPipeline } from '../moderation/pipeline.js';
import { CommunityTrustManager } from '../trust/communityTrustManager';

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

  // Two-flag reset system for better UX
  // Flag A: resetCommunityTrust (UI toggle) - user-facing, doesn't persist
  // Flag B: pending-trust-reset (Redis) - internal flag that triggers actual reset
  try {
    const settings = await context.settings.getAll();
    const uiToggle = settings.resetCommunityTrust === true || settings.resetCommunityTrust === 'true';

    // If UI toggle is ON, transfer to internal flag and turn UI toggle OFF
    if (uiToggle) {
      console.log('[ResetTrust] UI toggle ON, setting internal reset flag...');
      await redis.set('pending-trust-reset', 'true', { expiration: new Date(Date.now() + 3600000) }); // 1 hour TTL
      await context.settings.set('resetCommunityTrust', false);
      console.log('[ResetTrust] UI toggle reset to OFF, internal flag set');
    }

    // Check internal flag and perform reset if needed
    const pendingReset = await redis.get('pending-trust-reset');
    if (pendingReset === 'true') {
      console.log('[ResetTrust] Internal flag detected, performing reset...');
      const trustKeys = await redis.keys('trust:community:*');
      const trackingKeys = await redis.keys('approved:tracking:*');

      for (const key of [...trustKeys, ...trackingKeys]) {
        await redis.del(key);
      }

      const totalDeleted = trustKeys.length + trackingKeys.length;
      console.log(`[ResetTrust] Deleted ${totalDeleted} records (${trustKeys.length} trust, ${trackingKeys.length} tracking)`);

      await redis.del('pending-trust-reset');
      console.log('[ResetTrust] Internal flag cleared, reset complete');
    }
  } catch (error) {
    console.error('[ResetTrust] Error during reset:', error);
  }

  // Get post from event (type guard for TriggerEvent union)
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
    const auditLog = await auditLogger.log({
      action: ModAction.FLAG,
      userId: userId || 'unknown',
      contentId: postId,
      reason: 'Post by deleted or unknown user',
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    console.log(`[PostSubmit] Post ${postId} flagged successfully`);
    return;
  }

  // Skip the bot's own posts to prevent infinite loops
  const currentUser = await reddit.getCurrentUser();
  if (currentUser && author === currentUser.username) {
    console.log(`[PostSubmit] Skipping bot's own post by u/${author}`);
    return;
  }

  // Check whitelist - skip all moderation for whitelisted users
  const settings = await context.settings.getAll();
  const whitelistedUsernames = settings.whitelistedUsernames as string;
  if (whitelistedUsernames) {
    const whitelist = whitelistedUsernames.split(',').map(u => u.trim().toLowerCase()).filter(u => u.length > 0);
    if (whitelist.includes(author.toLowerCase())) {
      console.log(`[PostSubmit] User ${author} is whitelisted, skipping all moderation`);
      return;
    }
  }

  // Safety: Initialize default rules if not already done
  // This handles cases where AppInstall event was missed
  const initialized = await isInitialized(context as Devvit.Context, subredditName);
  if (!initialized) {
    console.log('[PostSubmit] Rules not initialized, initializing now...');
    try {
      await initializeDefaultRules(context as Devvit.Context);
    } catch (error) {
      console.error('[PostSubmit] Failed to initialize default rules:', error);
      // Continue processing even if initialization fails
      // Rules engine will handle missing rules gracefully
    }
  }

  // Initialize profiling services
  const profileFetcher = new UserProfileFetcher(redis, reddit, rateLimiter);
  const historyAnalyzer = new PostHistoryAnalyzer(redis, reddit, rateLimiter);
  const trustScoreCalc = new TrustScoreCalculator(redis);

  // Fetch profile and history for pipeline (Layer 1/2)
  console.log(`[PostSubmit] Fetching profile for ${author}...`);
  const [profile, history] = await Promise.all([
    profileFetcher.getUserProfile(userId),
    historyAnalyzer.getPostHistory(userId, author)
  ]);

  if (!profile) {
    console.log(`[PostSubmit] Could not fetch profile for ${author}`);
    const auditLog = await auditLogger.log({
      action: ModAction.FLAG,
      userId: author,
      contentId: postId,
      reason: 'Profile fetch failed, flagged for manual review',
    });
    await sendRealtimeDigest(context as Devvit.Context, auditLog);
    console.log(`[PostSubmit] Post ${postId} flagged for manual review`);
    return;
  }

  // Calculate trust score for metadata (used in audit logs)
  const trustScore = await trustScoreCalc.calculateTrustScore(
    profile,
    history,
    subredditName
  );

  console.log(`[PostSubmit] Profile fetched for ${author}: Age=${profile.accountAgeInDays}d, Karma=${profile.totalKarma}`);

  // 1. Build CurrentPost object (needed for both pipeline and rules)
  const currentPost = PostBuilder.buildCurrentPost(post);

  // ===== Execute Moderation Pipeline (Layers 1-2) =====
  const correlationId = `post-${postId}-${Date.now()}`;
  console.log('[PostSubmit] Executing moderation pipeline', { correlationId });

  const pipelineResult = await executeModerationPipeline(
    context as Devvit.Context,
    profile,
    currentPost,
    'submission'
  );

  // If pipeline triggered an action, execute and return
  if (pipelineResult.action !== 'APPROVE') {
    console.log('[PostSubmit] Pipeline triggered action', {
      correlationId,
      layer: pipelineResult.layerTriggered,
      action: pipelineResult.action,
      reason: pipelineResult.reason,
    });

    // Get dry-run config
    const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
    const dryRunEnabled = dryRunConfig.dryRunMode;

    // Execute the action using the existing executeAction API
    // Map pipeline reason to the correct field based on action type
    const executionResult = await executeAction({
      post,
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
      contentId: postId,
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
        postTitle: title,
        bodyPreview: post.body?.substring(0, 200),
        ...pipelineResult.metadata,
      },
    });

    // Send real-time digest if enabled
    if (auditLog) {
      await sendRealtimeDigest(context as Devvit.Context, auditLog);
    }

    // Log execution result
    if (!executionResult.success) {
      console.error(`[PostSubmit] Pipeline action execution failed:`, {
        postId,
        layer: pipelineResult.layerTriggered,
        action: pipelineResult.action,
        error: executionResult.error,
      });
    }

    // Update community trust for pipeline actions
    if (executionResult.success) {
      const trustManager = new CommunityTrustManager(context as Devvit.Context);

      // Map action to trust action
      let trustAction: 'APPROVE' | 'FLAG' | 'REMOVE';
      if (pipelineResult.action === 'APPROVE') {
        trustAction = 'APPROVE';
      } else if (pipelineResult.action === 'FLAG') {
        trustAction = 'FLAG';
      } else {
        trustAction = 'REMOVE';
      }

      await trustManager.updateTrust(userId, subredditName, trustAction, 'post');
      console.log(`[PostSubmit] Updated community trust (pipeline): ${trustAction}`);

      // If approved, track for ModAction
      if (pipelineResult.action === 'APPROVE') {
        await trustManager.trackApproved(postId, userId, subredditName, 'post');
      }
    }

    console.log(`[PostSubmit] Post ${postId} processed by pipeline`);
    return; // Short-circuit, don't continue to custom rules
  }

  // === Community Trust Check ===
  if (pipelineResult.action === 'APPROVE') {
    // Layer 1 passed, check community trust
    const trustManager = new CommunityTrustManager(context as Devvit.Context);
    const trustEval = await trustManager.getTrust(userId, subredditName, 'post');

    if (trustEval.isTrusted) {
      console.log(`[PostSubmit] User ${author} trusted in r/${subredditName} (${trustEval.approvalRate.toFixed(1)}% approval, ${trustEval.submissions} posts), skipping Layers 2 & 3`);

      // Update trust (APPROVE)
      await trustManager.updateTrust(userId, subredditName, 'APPROVE', 'post');

      // Track for ModAction audit
      await trustManager.trackApproved(postId, userId, subredditName, 'post');

      // Log audit
      const auditLog = await auditLogger.log({
        action: ModAction.APPROVE,
        userId: author,
        contentId: postId,
        reason: `Community trusted (${trustEval.approvalRate.toFixed(1)}% approval)`,
      });
      await sendRealtimeDigest(context as Devvit.Context, auditLog);

      console.log(`[PostSubmit] Post ${postId} approved (community trusted)`);
      return; // Skip Layer 3
    }

    console.log(`[PostSubmit] User ${author} not trusted in r/${subredditName} (${trustEval.reason}), continuing to Layer 3`);
  }

  // Continue to Layer 3 (custom rules + AI) if pipeline didn't trigger
  console.log('[PostSubmit] Pipeline approved, continuing to custom rules', { correlationId });

  // Phase 3.3: Rules engine integration with optional AI analysis
  console.log(`[PostSubmit] User ${author} not trusted, evaluating rules...`);

  // 2. Initialize rules engine
  const rulesEngine = RulesEngine.getInstance(context as Devvit.Context);

  // 3. Check if AI analysis is needed for this subreddit
  const needsAI = await rulesEngine.needsAIAnalysis(subredditName, 'submission');
  let aiAnalysis: AIQuestionBatchResult | undefined;
  let aiCost = 0;

  if (needsAI) {
    console.log(`[PostSubmit] AI analysis required for ${subredditName}`);

    // Get required AI questions from rules
    const aiQuestions = await rulesEngine.getRequiredAIQuestions(subredditName, 'submission');

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

  // 5. Evaluate rules with contentType='submission'
  const startTime = Date.now();
  const ruleResult = await rulesEngine.evaluateRules(evalContext, 'submission');
  const executionTime = Date.now() - startTime;

  // Apply dry-run precedence: Settings OR RuleSet (safety first)
  const dryRunConfig = await SettingsService.getDryRunConfig(context as Devvit.Context);
  const effectiveDryRun = dryRunConfig.dryRunMode || ruleResult.dryRun;

  console.log(`[PostSubmit] Rule evaluation complete:`, {
    action: ruleResult.action,
    matchedRule: ruleResult.matchedRule,
    confidence: ruleResult.confidence,
    dryRun: effectiveDryRun,
    ruleSetDryRun: ruleResult.dryRun,
    settingsDryRun: dryRunConfig.dryRunMode,
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

  // Execute the action
  const executionResult = await executeAction({
    post,
    ruleResult,
    profile,
    context,
    dryRun: effectiveDryRun,
  });

  // Log to audit trail
  const auditAction = executionResult.success
    ? (ruleResult.action === 'APPROVE' ? ModAction.APPROVE :
       ruleResult.action === 'FLAG' ? ModAction.FLAG :
       ruleResult.action === 'REMOVE' ? ModAction.REMOVE :
       ruleResult.action === 'COMMENT' ? ModAction.COMMENT :
       ModAction.FLAG) // Unknown actions become FLAG in audit
    : ModAction.FLAG; // Failed actions become FLAG for manual review

  const auditLog = await auditLogger.log({
    action: auditAction,
    userId: author,
    contentId: postId,
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
      postTitle: title,
      bodyPreview: post.body?.substring(0, 200),
    },
  });

  // Send realtime digest if enabled
  await sendRealtimeDigest(context as Devvit.Context, auditLog);

  // Increment approved count for successful approvals
  if (executionResult.success && ruleResult.action === 'APPROVE') {
    await trustScoreCalc.incrementApprovedCount(userId, subredditName);
  }

  // Log execution result
  if (!executionResult.success) {
    console.error(`[PostSubmit] Action execution failed:`, {
      postId,
      action: ruleResult.action,
      error: executionResult.error,
    });
  }

  // Update community trust based on action
  if (executionResult.success) {
    const trustManager = new CommunityTrustManager(context as Devvit.Context);

    // Map action to trust action
    let trustAction: 'APPROVE' | 'FLAG' | 'REMOVE';
    if (ruleResult.action === 'APPROVE') {
      trustAction = 'APPROVE';
    } else if (ruleResult.action === 'FLAG') {
      trustAction = 'FLAG';
    } else {
      trustAction = 'REMOVE';
    }

    await trustManager.updateTrust(userId, subredditName, trustAction, 'post');
    console.log(`[PostSubmit] Updated community trust: ${trustAction}`);

    // If approved, track for ModAction
    if (ruleResult.action === 'APPROVE') {
      await trustManager.trackApproved(postId, userId, subredditName, 'post');
    }
  }

  console.log(`[PostSubmit] Post ${postId} processed successfully`);
}
