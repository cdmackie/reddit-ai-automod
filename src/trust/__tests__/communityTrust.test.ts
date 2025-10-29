/**
 * Community Trust System - Comprehensive Test Suite
 *
 * Tests trust score calculations, decay, approval/removal tracking,
 * and integration scenarios without requiring Reddit deployment.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockRedis, MockContext, createMockPost } from '../../__mocks__/devvit';

// Import types (will implement manager next)
import type { CommunityTrust, TrustEvaluation } from '../../types/communityTrust';

// Mock implementation of CommunityTrustManager for testing
class CommunityTrustManager {
  private redis: MockRedis;
  private config = {
    minApprovalRate: 70,
    minSubmissions: 3,  // Updated from 10 to 3
    decayRatePerMonth: 5,
  };

  constructor(private context: MockContext) {
    this.redis = context.redis as MockRedis;
  }

  async getTrust(userId: string, subreddit: string, contentType: 'post' | 'comment'): Promise<TrustEvaluation> {
    const key = `trust:community:${userId}:${subreddit}`;
    const trust = await this.redis.get(key) as CommunityTrust | null;

    if (!trust) {
      return {
        isTrusted: false,
        approvalRate: 0,
        submissions: 0,
        reason: 'No history in this community',
        monthsInactive: 0,
        decayApplied: 0,
      };
    }

    const stats = contentType === 'post' ? trust.posts : trust.comments;

    // Calculate months inactive
    const now = new Date();
    const monthsInactive = this.getMonthsSince(trust.lastActivity);

    // Apply decay
    const rawApprovalRate = stats.submitted > 0
      ? (stats.approved / stats.submitted) * 100
      : 0;
    const decayAmount = monthsInactive * this.config.decayRatePerMonth;
    const approvalRate = Math.max(0, rawApprovalRate - decayAmount);

    // Check if trusted
    const isTrusted =
      stats.submitted >= this.config.minSubmissions &&
      approvalRate >= this.config.minApprovalRate;

    return {
      isTrusted,
      approvalRate,
      submissions: stats.submitted,
      reason: isTrusted ? 'Trusted contributor' : this.getReason(stats, approvalRate),
      monthsInactive,
      decayApplied: decayAmount,
    };
  }

  async updateTrust(
    userId: string,
    subreddit: string,
    action: 'APPROVE' | 'FLAG' | 'REMOVE',
    contentType: 'post' | 'comment'
  ): Promise<void> {
    const key = `trust:community:${userId}:${subreddit}`;
    let trust = await this.redis.get(key) as CommunityTrust | null;

    if (!trust) {
      trust = this.initializeTrust(userId, subreddit);
    }

    const stats = contentType === 'post' ? trust.posts : trust.comments;

    // Update counts
    stats.submitted++;
    if (action === 'APPROVE') {
      stats.approved++;
    } else if (action === 'FLAG') {
      stats.flagged++;
    } else if (action === 'REMOVE') {
      stats.removed++;
    }

    // Update timestamps
    trust.lastActivity = new Date();
    trust.lastCalculated = new Date();

    await this.redis.set(key, trust);
  }

  async retroactiveRemoval(contentId: string): Promise<void> {
    const record = await this.redis.get(`approved:tracking:${contentId}`);
    if (!record) return;

    const { userId, subreddit, contentType } = record as any;
    const key = `trust:community:${userId}:${subreddit}`;
    const trust = await this.redis.get(key) as CommunityTrust | null;

    if (!trust) return;

    const stats = contentType === 'post' ? trust.posts : trust.comments;

    // Undo the approval, add to removed
    stats.approved = Math.max(0, stats.approved - 1);
    stats.removed++;

    trust.lastCalculated = new Date();

    await this.redis.set(key, trust);
    await this.redis.del(`approved:tracking:${contentId}`);
  }

  private initializeTrust(userId: string, subreddit: string): CommunityTrust {
    return {
      userId,
      subreddit,
      posts: { submitted: 0, approved: 0, flagged: 0, removed: 0, approvalRate: 0 },
      comments: { submitted: 0, approved: 0, flagged: 0, removed: 0, approvalRate: 0 },
      lastActivity: new Date(),
      lastCalculated: new Date(),
    };
  }

  private getMonthsSince(date: Date): number {
    const now = new Date();
    const months = (now.getFullYear() - date.getFullYear()) * 12 +
      (now.getMonth() - date.getMonth());
    return Math.max(0, months);
  }

  private getReason(stats: any, approvalRate: number): string {
    if (stats.submitted < this.config.minSubmissions) {
      return `Need ${this.config.minSubmissions - stats.submitted} more submissions`;
    }
    if (approvalRate < this.config.minApprovalRate) {
      return `Approval rate ${approvalRate.toFixed(1)}% below ${this.config.minApprovalRate}%`;
    }
    return 'Not trusted';
  }
}

describe('CommunityTrustManager', () => {
  let manager: CommunityTrustManager;
  let context: MockContext;

  beforeEach(() => {
    context = new MockContext();
    manager = new CommunityTrustManager(context);
  });

  describe('Initial State', () => {
    it('should return untrusted for new user', async () => {
      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.isTrusted).toBe(false);
      expect(result.approvalRate).toBe(0);
      expect(result.submissions).toBe(0);
      expect(result.reason).toContain('No history');
    });
  });

  describe('Building Trust - Posts', () => {
    it('should not trust user with only 2 approved posts (< 3 minimum)', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.isTrusted).toBe(false);
      expect(result.submissions).toBe(2);
      expect(result.approvalRate).toBe(100);
      expect(result.reason).toContain('Need 1 more');
    });

    it('should trust user with 3 approved posts (meets minimum)', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.isTrusted).toBe(true);
      expect(result.submissions).toBe(3);
      expect(result.approvalRate).toBe(100);
      expect(result.reason).toBe('Trusted contributor');
    });

    it('should trust user with 70% approval rate (4 posts, 3 approved)', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'FLAG', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.isTrusted).toBe(true);
      expect(result.submissions).toBe(4);
      expect(result.approvalRate).toBe(75);
    });

    it('should NOT trust user with 67% approval rate (3 posts, 2 approved)', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'FLAG', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.isTrusted).toBe(false);
      expect(result.submissions).toBe(3);
      expect(result.approvalRate).toBeCloseTo(66.67, 1);
      expect(result.reason).toContain('below 70%');
    });
  });

  describe('Separate Post/Comment Tracking', () => {
    it('should track posts and comments independently', async () => {
      // Approve 3 posts
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      // Approve 2 comments (below minimum)
      await manager.updateTrust('user1', 'test', 'APPROVE', 'comment');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'comment');

      const postTrust = await manager.getTrust('user1', 'test', 'post');
      const commentTrust = await manager.getTrust('user1', 'test', 'comment');

      expect(postTrust.isTrusted).toBe(true);
      expect(postTrust.submissions).toBe(3);

      expect(commentTrust.isTrusted).toBe(false);
      expect(commentTrust.submissions).toBe(2);
    });

    it('should prevent gaming through comments', async () => {
      // User spams 10 short comments (all approved)
      for (let i = 0; i < 10; i++) {
        await manager.updateTrust('user1', 'test', 'APPROVE', 'comment');
      }

      // Then posts rule-breaking content
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      // Comment trust is high
      const commentTrust = await manager.getTrust('user1', 'test', 'comment');
      expect(commentTrust.isTrusted).toBe(true);

      // But post trust is low (only 1 post)
      const postTrust = await manager.getTrust('user1', 'test', 'post');
      expect(postTrust.isTrusted).toBe(false);
      expect(postTrust.submissions).toBe(1);
    });
  });

  describe('Cross-Subreddit Isolation', () => {
    it('should track trust separately per subreddit', async () => {
      // User is trusted in r/FriendsOver40
      await manager.updateTrust('user1', 'FriendsOver40', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'FriendsOver40', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'FriendsOver40', 'APPROVE', 'post');

      // But new in r/bitcointaxes
      // (no posts yet)

      const trust1 = await manager.getTrust('user1', 'FriendsOver40', 'post');
      const trust2 = await manager.getTrust('user1', 'bitcointaxes', 'post');

      expect(trust1.isTrusted).toBe(true);
      expect(trust2.isTrusted).toBe(false);
      expect(trust2.submissions).toBe(0);
    });
  });

  describe('Retroactive Removal (ModAction)', () => {
    it('should decrease trust when mod removes approved post', async () => {
      // User gets 3 posts approved
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      // Track the third post for removal
      await context.redis.set('approved:tracking:post3', {
        userId: 'user1',
        subreddit: 'test',
        contentType: 'post',
      });

      // Initial trust: 100%
      let trust = await manager.getTrust('user1', 'test', 'post');
      expect(trust.isTrusted).toBe(true);
      expect(trust.approvalRate).toBe(100);

      // Mod removes post3
      await manager.retroactiveRemoval('post3');

      // Trust recalculated: 2 approved, 1 removed = 67%
      trust = await manager.getTrust('user1', 'test', 'post');
      expect(trust.isTrusted).toBe(false); // Below 70%
      expect(trust.approvalRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Decay System', () => {
    it('should apply 5% decay per month of inactivity', async () => {
      // User gets trusted (3 posts, 100% approval)
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      // Manually set lastActivity to 3 months ago
      const key = 'trust:community:user1:test';
      const trust = await context.redis.get(key) as CommunityTrust;
      trust.lastActivity = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
      await context.redis.set(key, trust);

      const result = await manager.getTrust('user1', 'test', 'post');

      // 100% - (3 months * 5%) = 85%
      expect(result.monthsInactive).toBe(3);
      expect(result.decayApplied).toBe(15);
      expect(result.approvalRate).toBe(85);
      expect(result.isTrusted).toBe(true); // Still above 70%
    });

    it('should lose trust after 6+ months of inactivity', async () => {
      // User gets trusted
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');

      // 7 months inactive
      const key = 'trust:community:user1:test';
      const trust = await context.redis.get(key) as CommunityTrust;
      trust.lastActivity = new Date(Date.now() - 210 * 24 * 60 * 60 * 1000);
      await context.redis.set(key, trust);

      const result = await manager.getTrust('user1', 'test', 'post');

      // 100% - (7 months * 5%) = 65%
      expect(result.monthsInactive).toBe(7);
      expect(result.decayApplied).toBe(35);
      expect(result.approvalRate).toBe(65);
      expect(result.isTrusted).toBe(false); // Below 70%
    });
  });

  describe('Edge Cases', () => {
    it('should handle removed posts reducing approval rate', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      // 2 approved, 2 removed = 50%
      expect(result.approvalRate).toBe(50);
      expect(result.isTrusted).toBe(false);
    });

    it('should handle mix of approved, flagged, and removed', async () => {
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'APPROVE', 'post');
      await manager.updateTrust('user1', 'test', 'FLAG', 'post');
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      // 3 approved out of 5 total = 60%
      expect(result.submissions).toBe(5);
      expect(result.approvalRate).toBe(60);
      expect(result.isTrusted).toBe(false); // Below 70%
    });

    it('should never go below 0% approval rate', async () => {
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');
      await manager.updateTrust('user1', 'test', 'REMOVE', 'post');

      const result = await manager.getTrust('user1', 'test', 'post');

      expect(result.approvalRate).toBe(0);
      expect(result.isTrusted).toBe(false);
    });
  });
});
