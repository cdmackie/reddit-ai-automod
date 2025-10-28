/**
 * Default rule sets for target subreddits
 *
 * This module provides pre-configured rules for each target subreddit.
 * These rules are used as starting points and can be customized via the admin UI.
 *
 * @module rules/defaults
 */

import { RuleSet } from '../types/rules.js';

/**
 * Default rules for FriendsOver40 subreddit
 * Focus: Platonic friendships for people aged 40+
 * Key concerns: Dating intent, age appropriateness, low-quality accounts
 */
export const FRIENDSOVER40_RULES: RuleSet = {
  subreddit: 'FriendsOver40',
  dryRunMode: true, // Start in safe mode
  updatedAt: Date.now(),
  rules: [
    // High priority: Moderator override (always approve mods)
    {
      id: 'fo40_moderator_override',
      name: 'Moderator Auto-Approve',
      type: 'HARD',
      enabled: true,
      priority: 1000,
      contentType: 'submission',
      subreddit: 'FriendsOver40',
      conditions: {
        field: 'profile.isModerator',
        operator: '==',
        value: true,
      },
      action: 'APPROVE',
      actionConfig: {
        reason: 'Moderator - auto-approved',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // High priority: Negative karma flag
    {
      id: 'fo40_negative_karma',
      name: 'Negative Karma Flag',
      type: 'HARD',
      enabled: true,
      priority: 200,
      contentType: 'submission',
      subreddit: 'FriendsOver40',
      conditions: {
        field: 'profile.totalKarma',
        operator: '<',
        value: -50,
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'Negative karma account ({profile.totalKarma}) - possible bad actor',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Medium priority: New low karma accounts
    {
      id: 'fo40_new_low_karma',
      name: 'New Low Karma Account',
      type: 'HARD',
      enabled: true,
      priority: 150,
      contentType: 'submission',
      subreddit: 'FriendsOver40',
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'profile.accountAgeInDays',
            operator: '<',
            value: 30,
          },
          {
            field: 'profile.totalKarma',
            operator: '<',
            value: 100,
          },
          {
            field: 'profile.emailVerified',
            operator: '==',
            value: false,
          },
        ],
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'New account ({profile.accountAgeInDays} days) with low karma ({profile.totalKarma}) and unverified email - needs review',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // AI rule: Dating intent detection (high confidence threshold)
    {
      id: 'fo40_dating_intent',
      name: 'Dating Intent Detection',
      type: 'AI',
      enabled: true,
      priority: 50,
      contentType: 'submission',
      subreddit: 'FriendsOver40',
      aiQuestion: {
        id: 'dating_intent_40',
        question:
          'Is this user seeking romantic or sexual relationships rather than platonic friendships?',
        context:
          'Look for: flirting, asking for DMs, relationship-seeking language, compliments focused on appearance, mentions of "connection" or "chemistry". This is a friendship community for people 40+.',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.dating_intent_40.answer',
            operator: '==',
            value: 'YES',
          },
          {
            field: 'aiAnalysis.answers.dating_intent_40.confidence',
            operator: '>=',
            value: 80,
          },
        ],
      },
      action: 'REMOVE',
      actionConfig: {
        reason:
          'Dating intent detected (AI confidence: {aiAnalysis.answers.dating_intent_40.confidence}%)',
        comment:
          'Your post has been removed because it appears to be seeking romantic or dating connections. This community is for platonic friendships only. Please try r/r4r40plus or similar dating-focused subreddits instead.',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // AI rule: Scammer detection
    {
      id: 'fo40_scammer_detection',
      name: 'Scammer Pattern Detection',
      type: 'AI',
      enabled: true,
      priority: 75,
      contentType: 'submission',
      subreddit: 'FriendsOver40',
      aiQuestion: {
        id: 'scammer_risk_40',
        question:
          'Does this post show signs of scamming, such as sob stories, requests for money, crypto promotion, or too-good-to-be-true offers?',
        context:
          'Common scammer patterns: financial hardship stories, investment opportunities, crypto schemes, asking for money/gift cards, urgency tactics, overly personal information requests.',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.scammer_risk_40.answer',
            operator: '==',
            value: 'YES',
          },
          {
            field: 'aiAnalysis.answers.scammer_risk_40.confidence',
            operator: '>=',
            value: 70,
          },
        ],
      },
      action: 'REMOVE',
      actionConfig: {
        reason:
          'Potential scammer detected (AI confidence: {aiAnalysis.answers.scammer_risk_40.confidence}%)',
        comment:
          'Your post has been removed due to potential scam indicators. If this is an error, please contact the moderators.',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

/**
 * Default rules for FriendsOver50 subreddit
 * Similar to FriendsOver40 but with age-appropriate adjustments
 */
export const FRIENDSOVER50_RULES: RuleSet = {
  subreddit: 'FriendsOver50',
  dryRunMode: true,
  updatedAt: Date.now(),
  rules: [
    // Moderator override
    {
      id: 'fo50_moderator_override',
      name: 'Moderator Auto-Approve',
      type: 'HARD',
      enabled: true,
      priority: 1000,
      contentType: 'submission',
      subreddit: 'FriendsOver50',
      conditions: {
        field: 'profile.isModerator',
        operator: '==',
        value: true,
      },
      action: 'APPROVE',
      actionConfig: {
        reason: 'Moderator - auto-approved',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Negative karma flag
    {
      id: 'fo50_negative_karma',
      name: 'Negative Karma Flag',
      type: 'HARD',
      enabled: true,
      priority: 200,
      contentType: 'submission',
      subreddit: 'FriendsOver50',
      conditions: {
        field: 'profile.totalKarma',
        operator: '<',
        value: -50,
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'Negative karma account ({profile.totalKarma}) - possible bad actor',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // New low karma accounts
    {
      id: 'fo50_new_low_karma',
      name: 'New Low Karma Account',
      type: 'HARD',
      enabled: true,
      priority: 150,
      contentType: 'submission',
      subreddit: 'FriendsOver50',
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'profile.accountAgeInDays',
            operator: '<',
            value: 30,
          },
          {
            field: 'profile.totalKarma',
            operator: '<',
            value: 100,
          },
          {
            field: 'profile.emailVerified',
            operator: '==',
            value: false,
          },
        ],
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'New account ({profile.accountAgeInDays} days) with low karma ({profile.totalKarma}) and unverified email - needs review',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Dating intent detection (same as FriendsOver40)
    {
      id: 'fo50_dating_intent',
      name: 'Dating Intent Detection',
      type: 'AI',
      enabled: true,
      priority: 50,
      contentType: 'submission',
      subreddit: 'FriendsOver50',
      aiQuestion: {
        id: 'dating_intent_50',
        question:
          'Is this user seeking romantic or sexual relationships rather than platonic friendships?',
        context:
          'Look for: flirting, asking for DMs, relationship-seeking language, compliments focused on appearance, mentions of "connection" or "chemistry". This is a friendship community for people 50+.',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.dating_intent_50.answer',
            operator: '==',
            value: 'YES',
          },
          {
            field: 'aiAnalysis.answers.dating_intent_50.confidence',
            operator: '>=',
            value: 80,
          },
        ],
      },
      action: 'REMOVE',
      actionConfig: {
        reason:
          'Dating intent detected (AI confidence: {aiAnalysis.answers.dating_intent_50.confidence}%)',
        comment:
          'Your post has been removed because it appears to be seeking romantic or dating connections. This community is for platonic friendships only. Please try r/r4r40plus or similar dating-focused subreddits instead.',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Scammer detection
    {
      id: 'fo50_scammer_detection',
      name: 'Scammer Pattern Detection',
      type: 'AI',
      enabled: true,
      priority: 75,
      contentType: 'submission',
      subreddit: 'FriendsOver50',
      aiQuestion: {
        id: 'scammer_risk_50',
        question:
          'Does this post show signs of scamming, such as sob stories, requests for money, crypto promotion, or too-good-to-be-true offers?',
        context:
          'Common scammer patterns: financial hardship stories, investment opportunities, crypto schemes, asking for money/gift cards, urgency tactics, overly personal information requests.',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.scammer_risk_50.answer',
            operator: '==',
            value: 'YES',
          },
          {
            field: 'aiAnalysis.answers.scammer_risk_50.confidence',
            operator: '>=',
            value: 70,
          },
        ],
      },
      action: 'REMOVE',
      actionConfig: {
        reason:
          'Potential scammer detected (AI confidence: {aiAnalysis.answers.scammer_risk_50.confidence}%)',
        comment:
          'Your post has been removed due to potential scam indicators. If this is an error, please contact the moderators.',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

/**
 * Default rules for bitcointaxes subreddit
 * Focus: Bitcoin tax questions, spam prevention, off-topic detection
 */
export const BITCOINTAXES_RULES: RuleSet = {
  subreddit: 'bitcointaxes',
  dryRunMode: true,
  updatedAt: Date.now(),
  rules: [
    // Moderator override
    {
      id: 'bt_moderator_override',
      name: 'Moderator Auto-Approve',
      type: 'HARD',
      enabled: true,
      priority: 1000,
      contentType: 'submission',
      subreddit: 'bitcointaxes',
      conditions: {
        field: 'profile.isModerator',
        operator: '==',
        value: true,
      },
      action: 'APPROVE',
      actionConfig: {
        reason: 'Moderator - auto-approved',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // New accounts with links
    {
      id: 'bt_new_account_links',
      name: 'New Account with External Links',
      type: 'HARD',
      enabled: true,
      priority: 150,
      contentType: 'submission',
      subreddit: 'bitcointaxes',
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'profile.accountAgeInDays',
            operator: '<',
            value: 30,
          },
          {
            field: 'currentPost.urls',
            operator: '!=',
            value: [],
          },
          {
            field: 'profile.totalKarma',
            operator: '<',
            value: 50,
          },
        ],
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'New account ({profile.accountAgeInDays} days, {profile.totalKarma} karma) posting links - potential spam',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // AI rule: Spam detection
    {
      id: 'bt_spam_detection',
      name: 'Spam Detection',
      type: 'AI',
      enabled: true,
      priority: 100,
      contentType: 'submission',
      subreddit: 'bitcointaxes',
      aiQuestion: {
        id: 'spam_detection_bt',
        question:
          'Is this post promotional spam, advertising a service/product, or trying to drive traffic to an external site?',
        context:
          'Look for: promotional language, service advertisements, affiliate links, repeated posts, vague questions designed to promote a product, SEO spam.',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.spam_detection_bt.answer',
            operator: '==',
            value: 'YES',
          },
          {
            field: 'aiAnalysis.answers.spam_detection_bt.confidence',
            operator: '>=',
            value: 85,
          },
        ],
      },
      action: 'REMOVE',
      actionConfig: {
        reason:
          'Spam detected (AI confidence: {aiAnalysis.answers.spam_detection_bt.confidence}%)',
        comment:
          'Your post has been removed as it appears to be promotional or spam. If you believe this is an error, please contact the moderators.',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // AI rule: Off-topic detection
    {
      id: 'bt_off_topic',
      name: 'Off-Topic Detection',
      type: 'AI',
      enabled: true,
      priority: 75,
      contentType: 'submission',
      subreddit: 'bitcointaxes',
      aiQuestion: {
        id: 'bitcoin_tax_related',
        question:
          'Is this post related to Bitcoin taxation, cryptocurrency tax reporting, or tax implications of crypto transactions?',
        context:
          'On-topic: Bitcoin taxes, crypto tax reporting, capital gains, IRS forms, tax software for crypto. Off-topic: general crypto discussion, price speculation, trading strategies (unless tax-related).',
      },
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'aiAnalysis.answers.bitcoin_tax_related.answer',
            operator: '==',
            value: 'NO',
          },
          {
            field: 'aiAnalysis.answers.bitcoin_tax_related.confidence',
            operator: '>=',
            value: 80,
          },
        ],
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'Post may be off-topic (AI confidence: {aiAnalysis.answers.bitcoin_tax_related.confidence}%)',
        comment: null,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

/**
 * Global rules that apply to all subreddits
 * These are evaluated after subreddit-specific rules
 */
export const GLOBAL_RULES: RuleSet = {
  subreddit: 'global',
  dryRunMode: false, // Global rules can be more aggressive
  updatedAt: Date.now(),
  rules: [
    // Very short posts with links (common spam pattern)
    {
      id: 'global_short_spam',
      name: 'Very Short Post with Links',
      type: 'HARD',
      enabled: true,
      priority: 50,
      contentType: 'submission',
      subreddit: null, // Global rule
      conditions: {
        logicalOperator: 'AND',
        rules: [
          {
            field: 'currentPost.wordCount',
            operator: '<',
            value: 10,
          },
          {
            field: 'currentPost.urls',
            operator: '!=',
            value: [],
          },
        ],
      },
      action: 'FLAG',
      actionConfig: {
        reason:
          'Very short post ({currentPost.wordCount} words) with links - possible spam',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

/**
 * Default rules map for easy lookup
 */
export const DEFAULT_RULES: Record<string, RuleSet> = {
  FriendsOver40: FRIENDSOVER40_RULES,
  FriendsOver50: FRIENDSOVER50_RULES,
  bitcointaxes: BITCOINTAXES_RULES,
  global: GLOBAL_RULES,
};
