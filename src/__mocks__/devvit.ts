/**
 * Mock Devvit Context and Utilities for Local Testing
 *
 * Provides mock implementations of Devvit APIs to enable
 * unit testing without Reddit deployment.
 */

export class MockRedis {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: any, options?: { ttl?: number }): Promise<void> {
    this.store.set(key, value);
    if (options?.ttl) {
      // In real implementation, would expire after TTL
      // For tests, just store it
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    const set = this.store.get(key) || [];
    set.push({ score, member });
    this.store.set(key, set);
  }

  async zrange(key: string, min: number, max: number): Promise<string[]> {
    const set = this.store.get(key) || [];
    return set
      .filter((item: any) => item.score >= min && item.score <= max)
      .map((item: any) => item.member);
  }

  async zrem(key: string, member: string): Promise<void> {
    const set = this.store.get(key) || [];
    this.store.set(key, set.filter((item: any) => item.member !== member));
  }

  // Test utility: Clear all data
  clear(): void {
    this.store.clear();
  }

  // Test utility: Get all keys
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

export class MockSettings {
  private settings: Map<string, any> = new Map();

  constructor(defaults: Record<string, any> = {}) {
    Object.entries(defaults).forEach(([key, value]) => {
      this.settings.set(key, value);
    });
  }

  get(key: string): any {
    return this.settings.get(key);
  }

  getAll(): Record<string, any> {
    const all: Record<string, any> = {};
    this.settings.forEach((value, key) => {
      all[key] = value;
    });
    return all;
  }

  // Test utility: Set a setting
  set(key: string, value: any): void {
    this.settings.set(key, value);
  }
}

export class MockRedditAPI {
  async getCurrentUser() {
    return {
      username: 'test-bot',
      id: 't2_testbot',
    };
  }

  async getPostById(id: string) {
    return {
      id,
      removed: false,
      spam: false,
      authorId: 't2_testuser',
      subredditName: 'test',
    };
  }

  async getUserById(id: string) {
    return {
      id,
      username: 'testuser',
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
      commentKarma: 1000,
      postKarma: 500,
    };
  }

  async report(post: any, options: { reason: string }) {
    // Mock report - just return success
    return { success: true };
  }

  async remove(postId: string) {
    // Mock removal
    return { success: true };
  }

  async submitComment(options: { postId: string; text: string }) {
    return {
      id: 't1_mockcomment',
      body: options.text,
    };
  }
}

export class MockContext {
  redis: MockRedis;
  settings: MockSettings;
  reddit: MockRedditAPI;

  constructor(settingsDefaults: Record<string, any> = {}) {
    this.redis = new MockRedis();
    this.settings = new MockSettings(settingsDefaults);
    this.reddit = new MockRedditAPI();
  }

  // Test utility: Reset all state
  reset(): void {
    this.redis.clear();
  }
}

/**
 * Helper to create mock posts for testing
 */
export function createMockPost(options: {
  id?: string;
  author?: string;
  subreddit?: string;
  title?: string;
  body?: string;
  url?: string;
  createdAt?: Date;
} = {}) {
  return {
    id: options.id || 't3_test123',
    authorId: `t2_${options.author || 'testuser'}`,
    author: options.author || 'testuser',
    subredditName: options.subreddit || 'test',
    title: options.title || 'Test Post',
    body: options.body || 'This is a test post',
    url: options.url || 'https://reddit.com/r/test/comments/test123',
    createdAt: options.createdAt || new Date(),
  };
}

/**
 * Helper to create mock comments for testing
 */
export function createMockComment(options: {
  id?: string;
  author?: string;
  subreddit?: string;
  body?: string;
  createdAt?: Date;
} = {}) {
  return {
    id: options.id || 't1_test123',
    authorId: `t2_${options.author || 'testuser'}`,
    author: options.author || 'testuser',
    subredditName: options.subreddit || 'test',
    body: options.body || 'This is a test comment',
    createdAt: options.createdAt || new Date(),
  };
}

/**
 * Helper to simulate ModAction events
 */
export function createMockModAction(options: {
  action: 'removelink' | 'spamlink' | 'removecomment' | 'spamcomment';
  targetId: string;
  moderator?: string;
  subreddit?: string;
}) {
  return {
    action: options.action,
    actionedAt: new Date(),
    subreddit: {
      name: options.subreddit || 'test',
    },
    moderator: {
      username: options.moderator || 'testmod',
    },
    targetPost: options.action.includes('link') ? { id: options.targetId } : undefined,
    targetComment: options.action.includes('comment') ? { id: options.targetId } : undefined,
  };
}
