# Async Queue System Design

## Overview

Design document for implementing an async queue system to decouple post/comment submission from expensive AI analysis operations.

**Date**: 2025-10-31
**Status**: Design Phase
**Priority**: Medium (Performance Optimization)

---

## Problem Statement

Currently, all moderation processing happens **synchronously** in trigger handlers:

```
PostSubmit Event → Layer 1 → Layer 2 → Layer 3 (AI) → Action → Return
                    (blocks for 5-10 seconds)
```

**Issues:**
- **User Experience**: Posts appear to "hang" during submission
- **Crash Risk**: AI failures can crash the trigger handler
- **Resource Pressure**: High-volume periods can overwhelm inline processing
- **Rate Limits**: Trigger timeouts if processing takes too long

---

## Proposed Solution

Implement **Redis-based queue system** with background worker:

```
PostSubmit Event → Layer 1 (fast) → Enqueue → Return immediately
                                         ↓
                           Background Worker (every minute)
                                         ↓
                          Dequeue → Layer 2+3 → Action
```

---

## Architecture Options

### Option 1: Sorted Set Queue (RECOMMENDED)

**Data Structure:**
- **Queue**: Sorted Set (`queue:posts`)
  - Score: timestamp (FIFO) or priority
  - Member: postId
- **Metadata**: Hash per item (`queue:meta:{postId}`)
  - authorId, subreddit, timestamp, type

**Operations:**
```typescript
// Enqueue (PostSubmit)
await redis.zAdd('queue:posts', { member: postId, score: Date.now() });
await redis.hSet(`queue:meta:${postId}`, { authorId, subreddit, ... });

// Dequeue (Worker)
const items = await redis.zRange('queue:posts', 0, 9, { by: 'rank' }); // Get 10
// Process items...
await redis.zRem('queue:posts', [postId]);
await redis.del(`queue:meta:${postId}`);
```

**Pros:**
- ✅ FIFO ordering via timestamp score
- ✅ Priority support (adjust score for high-risk users)
- ✅ Get queue size: `zCard('queue:posts')`
- ✅ Atomic operations
- ✅ Can peek at queue without removing items

**Cons:**
- ⚠️ Two Redis operations (queue + metadata)
- ⚠️ Need cleanup for orphaned metadata

**Devvit Support**: ✅ Full support (zAdd, zRange, zRem, zCard)

---

### Option 2: Counter + Hash Storage

**Data Structure:**
- **Counter**: `queue:next` (incrementing ID)
- **Items**: Hash per item (`queue:item:{id}`)
- **Processed**: Set of processed IDs (`queue:processed`)

**Operations:**
```typescript
// Enqueue
const id = await redis.incrBy('queue:next', 1);
await redis.hSet(`queue:item:${id}`, { postId, authorId, ... });

// Dequeue
for (let id = lastProcessed + 1; id <= currentId; id++) {
  const item = await redis.hGetAll(`queue:item:${id}`);
  // Process...
  await redis.sAdd('queue:processed', id.toString());
}
```

**Pros:**
- ✅ Simple counter-based approach
- ✅ Single data structure per item

**Cons:**
- ❌ No efficient range queries
- ❌ Must track last processed ID
- ❌ Gap handling complex
- ❌ Cleanup more difficult

**Devvit Support**: ✅ Supported but inefficient

---

### Option 3: Simple Key-Value List

**Data Structure:**
- **Items**: Individual keys (`queue:{timestamp}:{postId}`)

**Operations:**
```typescript
// Enqueue
await redis.set(`queue:${Date.now()}:${postId}`, JSON.stringify(data));

// Dequeue
const keys = await redis.keys('queue:*');
// Sort by timestamp...
// Process oldest 10...
await redis.del(key);
```

**Pros:**
- ✅ Very simple
- ✅ Single operation per item

**Cons:**
- ❌ redis.keys() is expensive (scans all keys)
- ❌ No atomic batch operations
- ❌ Sorting done client-side

**Devvit Support**: ✅ Supported but not recommended

---

## Implementation Plan: Option 1 (Sorted Set Queue)

### Phase 1: Queue Infrastructure

**New Files:**
- `src/queue/queueManager.ts` - Queue operations
- `src/queue/worker.ts` - Background processor

**Key Functions:**
```typescript
class QueueManager {
  // Enqueue post/comment for processing
  async enqueue(contentId: string, metadata: QueueMetadata): Promise<void>

  // Dequeue batch of items (worker)
  async dequeue(batchSize: number): Promise<QueueItem[]>

  // Remove item from queue
  async remove(contentId: string): Promise<void>

  // Get queue size
  async size(): Promise<number>

  // Get queue stats
  async stats(): Promise<QueueStats>
}
```

### Phase 2: Modify Trigger Handlers

**PostSubmit Changes:**
```typescript
async function handlePostSubmit(event, context) {
  // 1. Fast checks (Layer 1)
  const layer1Result = await runLayer1Fast(post, profile);

  if (layer1Result.action !== 'APPROVE') {
    // Immediate action needed
    await executeAction(layer1Result);
    return;
  }

  // 2. Check community trust
  if (isCommunityTrusted(userId, subreddit)) {
    // Auto-approve trusted users
    return;
  }

  // 3. Enqueue for deep analysis
  await queueManager.enqueue(postId, {
    authorId,
    subreddit,
    type: 'post',
    timestamp: Date.now(),
  });

  console.log(`Post ${postId} queued for Layer 2+3 analysis`);
}
```

### Phase 3: Background Worker

**Scheduler Setup:**
```typescript
// Register worker on install
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    await context.scheduler.runJob({
      name: 'queue_worker',
      cron: '* * * * *', // Every minute
    });
  },
});

// Worker implementation
Devvit.addSchedulerJob({
  name: 'queue_worker',
  onRun: async (event, context) => {
    const startTime = Date.now();
    const batchSize = 10; // Process 10 items per run

    try {
      const items = await queueManager.dequeue(batchSize);

      if (items.length === 0) {
        console.log('[QueueWorker] Queue empty');
        return;
      }

      console.log(`[QueueWorker] Processing ${items.length} items`);

      let processed = 0;
      let errors = 0;

      for (const item of items) {
        try {
          // Process with timeout
          await processWithTimeout(item, 25000); // 25s timeout
          processed++;

          // Remove from queue
          await queueManager.remove(item.contentId);

        } catch (error) {
          errors++;
          console.error(`[QueueWorker] Error processing ${item.contentId}:`, error);

          // Retry logic: move to retry queue or remove after N failures
          const retries = await incrementRetryCount(item.contentId);
          if (retries >= 3) {
            await queueManager.remove(item.contentId);
            await flagForManualReview(item);
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[QueueWorker] Complete: ${processed} processed, ${errors} errors, ${duration}ms`);

    } catch (error) {
      console.error('[QueueWorker] Fatal error:', error);
      // Worker will retry next minute
    }
  },
});
```

### Phase 4: Monitoring & Observability

**Queue Metrics:**
```typescript
// Add menu action for moderators
Devvit.addMenuItem({
  label: 'Queue Status',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const stats = await queueManager.stats();

    context.ui.showToast(
      `Queue: ${stats.size} items\n` +
      `Processing rate: ${stats.itemsPerMinute}/min\n` +
      `Oldest item: ${stats.oldestItemAge}s ago`
    );
  },
});
```

---

## Performance Analysis

### Capacity

**Current Inline Processing:**
- Processing time: 5-10 seconds per post
- Theoretical max: 6-12 posts/minute
- Practical max: ~5 posts/minute (with overhead)

**Queue System:**
- Worker runs: Every 60 seconds
- Batch size: 10 items
- Processing per item: ~5-10 seconds
- Theoretical capacity: 10 posts/minute
- With parallelization (future): 30-60 posts/minute

### Real-World Scenarios

**Low Volume (1-5 posts/hour):**
- Queue typically empty or 1-2 items
- Average processing delay: ~30 seconds
- No performance concerns

**Medium Volume (10-30 posts/hour):**
- Queue size: 0-5 items
- Average delay: ~60 seconds
- Worker utilization: ~30-50%

**High Volume (60+ posts/hour):**
- Queue size: 5-15 items
- Average delay: 1-3 minutes
- Worker at capacity, may need tuning

**Burst Traffic (100+ posts in 10 minutes):**
- Queue builds up during burst
- Gradually processes backlog
- May want to increase worker frequency during bursts

---

## Failure Scenarios & Recovery

### Worker Crashes
- **Detection**: Queue size grows continuously
- **Recovery**: Worker auto-restarts on next cron run
- **Mitigation**: Add health check monitoring

### Redis Connection Loss
- **Impact**: Queue operations fail, posts not enqueued
- **Fallback**: Could implement in-memory emergency queue
- **Recovery**: Auto-reconnect, queue operations resume

### AI Provider Failure
- **Impact**: Worker processes items but analysis fails
- **Handling**: Retry logic (3 attempts), then flag for manual review
- **Recovery**: Next batch uses fallback provider

### Queue Backlog
- **Detection**: Queue size > threshold (e.g., 50 items)
- **Action**:
  1. Log alert
  2. Increase worker frequency temporarily
  3. Send modmail notification
- **Recovery**: Process backlog, return to normal

---

## Migration Strategy

### Phase 1: Parallel Operation (1-2 weeks)
- Deploy queue system alongside existing inline processing
- 10% of posts use queue (feature flag)
- Monitor performance and error rates
- Compare processing times and success rates

### Phase 2: Gradual Rollout (2-4 weeks)
- Increase to 50% queue usage
- Monitor queue depth and processing delays
- Adjust worker frequency and batch size as needed
- Validate error handling and retry logic

### Phase 3: Full Migration (1 week)
- 100% queue usage
- Remove inline processing code (keep for emergencies)
- Monitor for 1 week

### Phase 4: Cleanup
- Remove old inline processing code
- Archive migration documentation
- Update system documentation

---

## Configuration Options

### Settings to Add

```typescript
// Queue configuration
{
  type: 'boolean',
  name: 'enableQueue',
  label: 'Enable Queue System',
  helpText: 'Process Layer 2+3 asynchronously via queue',
  defaultValue: true,
}

{
  type: 'number',
  name: 'queueWorkerBatchSize',
  label: 'Worker Batch Size',
  helpText: 'Number of items to process per worker run',
  defaultValue: 10,
}

{
  type: 'number',
  name: 'queueWorkerFrequency',
  label: 'Worker Frequency (minutes)',
  helpText: 'How often to run queue worker',
  defaultValue: 1,
}

{
  type: 'number',
  name: 'queueRetryLimit',
  label: 'Retry Limit',
  helpText: 'Max retries before flagging for manual review',
  defaultValue: 3,
}
```

---

## Limitations & Considerations

### Devvit Constraints
- ✅ Scheduler rate limits: 60 jobs/minute (sufficient)
- ✅ Redis: 1000 commands/sec (sufficient)
- ⚠️ No explicit scheduler timeout documented
- ⚠️ Worker must complete in reasonable time (~1-2 minutes)

### Trade-offs
- ✅ **Pro**: Better user experience (instant post submission)
- ✅ **Pro**: Better error isolation
- ✅ **Pro**: More scalable
- ⚠️ **Con**: Added complexity (two code paths)
- ⚠️ **Con**: Slight processing delay (30-60 seconds)
- ⚠️ **Con**: Harder to debug (async)

### When NOT to Use Queue
- Layer 1 determines immediate action needed (keep inline)
- Community-trusted users (skip Layer 2+3 entirely)
- Dry-run mode testing (inline is fine)
- Very low-traffic subreddits (<5 posts/day)

---

## Success Metrics

### Performance
- ✅ Post submission returns in <500ms (vs 5-10s inline)
- ✅ Queue processing delay <2 minutes (95th percentile)
- ✅ Worker processes 10+ items per run

### Reliability
- ✅ <1% item processing failures
- ✅ All items processed within 5 minutes
- ✅ Zero item loss (every enqueued item gets processed)

### Scalability
- ✅ Handle 100+ posts/hour without queue backlog
- ✅ Graceful degradation under extreme load

---

## Future Enhancements

### Priority Queue
- High-risk users (new accounts, low karma) get priority
- Adjust sorted set score based on risk factors
- Process high-priority items first

### Parallel Workers
- Multiple workers processing queue concurrently
- Requires distributed locking to prevent duplicate processing
- Could use Redis transactions for lock acquisition

### Adaptive Batch Size
- Increase batch size when queue is large
- Decrease when queue is small to reduce latency
- Monitor worker execution time

### Intelligent Scheduling
- Run worker more frequently during high-traffic hours
- Reduce frequency during low-traffic periods
- Learn traffic patterns over time

---

## References

- Devvit Scheduler: `/docs/devvit-reference.md` lines 1503-1721
- Redis Sorted Sets: `/docs/devvit-reference.md` lines 595-631
- Rate Limits: `/docs/devvit-reference.md` lines 1620-1626

---

**End of Document**
