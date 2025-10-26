/**
 * Audit logging functionality
 *
 * Tracks all moderation actions for transparency and debugging
 */

import { RedisClient } from '@devvit/public-api';
import { AuditLog, ModAction, StorageKey } from '../types/storage';
import { RedisStorage } from './redis';

/**
 * Audit logger for moderation actions
 */
export class AuditLogger {
  private storage: RedisStorage;

  constructor(redis: RedisClient) {
    this.storage = new RedisStorage(redis);
  }

  /**
   * Log a moderation action
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLog = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const key = this.storage.buildKey(
      StorageKey.AUDIT_LOG,
      entry.contentId
    );

    // Store the audit log
    await this.storage.set(key, auditEntry);

    // Also store in a list for the content item (append to array)
    const existingLogs = await this.getLogsForContent(entry.contentId) || [];
    existingLogs.push(auditEntry);
    await this.storage.set(key, existingLogs);
  }

  /**
   * Retrieve audit logs for a specific content item
   */
  async getLogsForContent(contentId: string): Promise<AuditLog[] | null> {
    const key = this.storage.buildKey(StorageKey.AUDIT_LOG, contentId);
    return await this.storage.get<AuditLog[]>(key);
  }

  /**
   * Generate a unique ID for audit entries
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Helper to log a post/comment removal
   */
  async logRemoval(
    contentId: string,
    userId: string,
    reason: string,
    ruleId?: string,
    confidence?: number
  ): Promise<void> {
    await this.log({
      action: ModAction.REMOVE,
      userId,
      contentId,
      reason,
      ruleId,
      confidence,
    });
  }

  /**
   * Helper to log a post/comment approval
   */
  async logApproval(
    contentId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.log({
      action: ModAction.APPROVE,
      userId,
      contentId,
      reason,
    });
  }

  /**
   * Helper to log flagging content for review
   */
  async logFlag(
    contentId: string,
    userId: string,
    reason: string,
    ruleId?: string,
    confidence?: number
  ): Promise<void> {
    await this.log({
      action: ModAction.FLAG,
      userId,
      contentId,
      reason,
      ruleId,
      confidence,
    });
  }
}
