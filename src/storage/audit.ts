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
   * Returns the created audit log entry for further processing (e.g., real-time digest)
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const auditEntry: AuditLog = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const key = this.storage.buildKey(
      StorageKey.AUDIT_LOG,
      entry.contentId
    );

    // Store the audit log as an array
    const existingLogs = await this.getLogsForContent(entry.contentId);
    const logs = existingLogs ? [...existingLogs, auditEntry] : [auditEntry];
    await this.storage.set(key, logs);

    return auditEntry;
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
