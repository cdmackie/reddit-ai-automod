# Request Coalescer Implementation Task

## Component: RequestCoalescer (`src/ai/requestCoalescer.ts`)

### Purpose
Prevent duplicate AI analysis calls for the same user by using Redis-based request deduplication with SETNX locking.

### Design Reference
See `docs/ai-provider-design.md` lines 774-854 for complete specification.

---

## Requirements

### 1. Import Required Types
```typescript
import { Devvit } from '@devvit/public-api';
import { InFlightRequest, AIAnalysisResult } from '../types/ai.js';
```

### 2. Implement RequestCoalescer Class

#### Constructor Pattern: Singleton
```typescript
export class RequestCoalescer {
  private constructor(private redis: Devvit.Context['redis']) {}

  private static instances = new Map<any, RequestCoalescer>();

  static getInstance(context: Devvit.Context): RequestCoalescer {
    if (!this.instances.has(context.redis)) {
      this.instances.set(context.redis, new RequestCoalescer(context.redis));
    }
    return this.instances.get(context.redis)!;
  }
}
```

#### Method: `acquireLock()`
```typescript
async acquireLock(userId: string, correlationId: string): Promise<boolean>
```

**Behavior**:
- Redis key: `ai:inflight:{userId}`
- Value: JSON.stringify(InFlightRequest) with:
  - userId
  - correlationId
  - startTime: Date.now()
  - expiresAt: Date.now() + 30000 (30s auto-expiry)
- Use Redis SETNX with 30s TTL (atomic operation)
- Return true if lock acquired, false if already held

**Implementation**:
```typescript
const key = `ai:inflight:${userId}`;
const value = JSON.stringify({
  userId,
  correlationId,
  startTime: Date.now(),
  expiresAt: Date.now() + 30000
});

// SETNX with 30s TTL (atomic operation)
const acquired = await this.redis.setNX(key, value, { expiration: 30 });
return acquired;
```

#### Method: `releaseLock()`
```typescript
async releaseLock(userId: string): Promise<void>
```

**Behavior**:
- Redis key: `ai:inflight:{userId}`
- Delete the lock key
- No error if key doesn't exist

**Implementation**:
```typescript
const key = `ai:inflight:${userId}`;
await this.redis.del(key);
```

#### Method: `waitForResult()`
```typescript
async waitForResult(userId: string, maxWaitMs?: number): Promise<AIAnalysisResult | null>
```

**Behavior**:
- Default maxWaitMs: 30000 (30 seconds)
- Poll for cached result every 500ms
- Use exponential backoff: 500ms, 750ms, 1000ms (max)
- Return result if found in cache
- Return null if timeout reached
- Check cache key: `ai:analysis:{userId}`

**Implementation**:
```typescript
const startTime = Date.now();
let delayMs = 500; // Initial delay
const maxDelayMs = 1000; // Max delay

while (Date.now() - startTime < maxWaitMs) {
  // Check if analysis is cached
  const cacheKey = `ai:analysis:${userId}`;
  const cachedData = await this.redis.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData) as AIAnalysisResult;
  }

  // Wait with exponential backoff
  await new Promise(resolve => setTimeout(resolve, delayMs));
  delayMs = Math.min(delayMs * 1.5, maxDelayMs); // Exponential backoff
}

return null; // Timeout
```

#### Method: `getInFlightRequest()`
```typescript
async getInFlightRequest(userId: string): Promise<InFlightRequest | null>
```

**Behavior**:
- Get current in-flight request data for debugging/monitoring
- Return parsed InFlightRequest if exists
- Return null if no request in flight

**Implementation**:
```typescript
const key = `ai:inflight:${userId}`;
const data = await this.redis.get(key);
if (!data) return null;

try {
  return JSON.parse(data) as InFlightRequest;
} catch (error) {
  // Invalid JSON in Redis, clean it up
  await this.redis.del(key);
  return null;
}
```

---

## Redis Keys Used

1. **Lock Key**: `ai:inflight:{userId}`
   - Value: InFlightRequest JSON
   - TTL: 30 seconds (auto-expiry)
   - Purpose: SETNX lock for deduplication

2. **Cache Key**: `ai:analysis:{userId}` (read-only, written by analyzer)
   - Value: AIAnalysisResult JSON
   - TTL: Variable (set by analyzer based on trust score)
   - Purpose: Result storage, read by waitForResult()

---

## Usage Pattern (Include in JSDoc)

```typescript
const coalescer = RequestCoalescer.getInstance(context);

// Try to acquire lock
if (!await coalescer.acquireLock(userId, correlationId)) {
  // Another request is in progress, wait for its result
  console.log('Request coalesced, waiting for result', { userId, correlationId });
  const result = await coalescer.waitForResult(userId);
  if (result) return result;

  // Timeout - proceed with analysis anyway (other request may have failed)
}

try {
  // Perform analysis
  const result = await analyzeUser(...);

  // Cache result (done by analyzer, not coalescer)
  // await cacheResult(userId, result);

  return result;
} finally {
  // Always release lock
  await coalescer.releaseLock(userId);
}
```

---

## Error Handling

1. **Redis Errors**:
   - Log error and return false (fail-safe: allow duplicate analysis)
   - Do NOT throw errors (graceful degradation)

2. **Invalid JSON in Redis**:
   - Clean up corrupted keys
   - Return null/false as appropriate

3. **Lock Expiry During Wait**:
   - Normal scenario, continue waiting for cached result
   - Return null on timeout

---

## Edge Cases to Handle

1. **Lock expires during analysis (>30s)**:
   - Auto-expiry prevents stuck locks
   - Releasing non-existent lock should not error

2. **Multiple waiters for same result**:
   - All waiters poll for the same cache key
   - First to complete caches result, others read it

3. **Analysis fails before releasing lock**:
   - finally {} block ensures lock is always released
   - If process crashes, TTL auto-expires lock after 30s

4. **Result cached before lock released**:
   - Normal and expected
   - Waiters can return as soon as result is cached

---

## Performance Considerations

1. **Exponential Backoff**:
   - Start: 500ms
   - Growth: 1.5x per iteration
   - Max: 1000ms
   - Prevents Redis hammering

2. **Singleton Pattern**:
   - One instance per Redis connection
   - Reduces memory overhead

3. **JSON Parsing**:
   - Parse once, cache in memory (for getInFlightRequest)
   - Minimal CPU overhead

---

## Logging Requirements

Add console.log statements for:
1. Lock acquisition success/failure
2. Lock release
3. Wait timeout
4. Coalesced request (waiting for another request)
5. Invalid JSON cleanup

Format:
```typescript
console.log('[RequestCoalescer] Lock acquired', { userId, correlationId });
console.log('[RequestCoalescer] Lock failed (already held)', { userId, correlationId });
console.log('[RequestCoalescer] Lock released', { userId });
console.log('[RequestCoalescer] Waiting for result', { userId, correlationId });
console.log('[RequestCoalescer] Wait timeout', { userId, waitedMs: maxWaitMs });
```

---

## Implementation Checklist

- [ ] Import types from `../types/ai.js`
- [ ] Implement singleton pattern with getInstance()
- [ ] Implement acquireLock() with Redis SETNX + TTL
- [ ] Implement releaseLock() with error handling
- [ ] Implement waitForResult() with exponential backoff
- [ ] Implement getInFlightRequest() for debugging
- [ ] Add comprehensive JSDoc comments
- [ ] Add usage example in JSDoc
- [ ] Add logging statements
- [ ] Handle all edge cases
- [ ] Export class as default and named export

---

## Code Quality Requirements

1. **TypeScript Strict Mode**: No `any` types, all parameters typed
2. **Error Handling**: Try-catch where appropriate, graceful degradation
3. **JSDoc**: Every method with description, parameters, return value, example
4. **Logging**: Debug-friendly console.log statements
5. **Comments**: Explain complex logic (exponential backoff, TTL reasoning)

---

## Testing Requirements (for test-automator agent)

After implementation, comprehensive tests should cover:

1. **Lock Acquisition**:
   - First request acquires lock successfully
   - Second request fails to acquire (returns false)
   - Lock auto-expires after 30s

2. **Lock Release**:
   - Lock can be released
   - Releasing non-existent lock doesn't error
   - Lock can be re-acquired after release

3. **Request Coalescing**:
   - Second request waits for first request's cached result
   - Multiple waiters all receive the same cached result
   - Timeout returns null after maxWaitMs

4. **Exponential Backoff**:
   - Polling starts at 500ms
   - Delay increases to 750ms, then 1000ms
   - Delay caps at 1000ms

5. **Edge Cases**:
   - Invalid JSON in Redis (cleanup)
   - Lock expires during wait (continue waiting)
   - Result cached before lock released (early return)

6. **Redis Mocking**:
   - Mock setNX, get, del operations
   - Verify correct keys and TTLs used
   - Simulate Redis errors

---

## Deliverables

1. **Production Code**: `src/ai/requestCoalescer.ts`
   - Clean, well-documented TypeScript
   - Follows project conventions
   - No linting errors
   - Comprehensive JSDoc

2. **Unit Tests**: `src/ai/requestCoalescer.test.ts`
   - 90%+ code coverage
   - All edge cases covered
   - Redis operations properly mocked
   - Clear test descriptions

3. **README Update**: `src/ai/README.md`
   - Document the RequestCoalescer component
   - Explain how it prevents duplicate calls
   - Include usage examples

---

## Success Criteria

✅ Code compiles without errors
✅ All tests pass
✅ Code coverage >90%
✅ No ESLint warnings
✅ JSDoc complete for all public methods
✅ Edge cases handled gracefully
✅ Logging statements in place
✅ Redis keys follow naming convention
✅ Singleton pattern implemented correctly
✅ Exponential backoff working as designed
