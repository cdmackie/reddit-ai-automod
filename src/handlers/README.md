# Event Handlers

Event handlers for Reddit triggers (posts, comments, app lifecycle).

## Handlers

### appInstall.ts
- Handles AppInstall event
- Initializes default rules for new installations
- Uses atomic locks to prevent race conditions
- Supports subreddit-specific defaults

**Functions:**
- `initializeDefaultRules(context)` - Main initialization entry point
- `getDefaultRuleSetForSubreddit(name)` - Subreddit detection and rule selection
- `isInitialized(context, name)` - Check initialization status

**Default Ruleset Mapping:**
- `FriendsOver40` → 6 rules (dating, scammer, age detection)
- `FriendsOver50` → 5 rules (dating, scammer, age detection)
- `bitcointaxes` → 4 rules (spam, off-topic, low effort)
- Other subreddits → Global rules (1 rule - short posts with links)

### postSubmit.ts
- Handles PostSubmit event
- Analyzes new posts for moderation
- Fallback initialization check (safety net)
- Full rules engine integration

**Flow:**
1. Check if user is deleted → FLAG
2. Check initialization status → Initialize if needed
3. Check if user is trusted → APPROVE
4. Fetch user profile and history
5. Calculate trust score
6. Evaluate rules (with optional AI analysis)
7. Execute action (APPROVE/FLAG/REMOVE/COMMENT)
8. Log to audit trail

### commentSubmit.ts
- Handles CommentSubmit event
- Currently minimal (Phase 5 expansion planned)
- Placeholder for comment moderation

### postBuilder.ts
- Helper utility for building CurrentPost objects
- Extracts URLs, domains, post types, word counts
- ReDoS protection for URL extraction
- Protocol validation (http/https only)

## Initialization Flow

```
App installed on r/FriendsOver40
  ↓
AppInstall event fired
  ↓
initializeDefaultRules() called
  ↓
Acquire atomic lock (60s expiration)
  ↓
Check if rules already exist
  ↓
Load FriendsOver40 default rules
  ↓
Save to Redis via RuleStorage
  ↓
Mark as initialized
  ↓
Release lock
  ↓
Done ✅
```

**If AppInstall event is missed:**
- PostSubmit handler checks initialization on first post
- Calls `initializeDefaultRules()` if needed
- Ensures rules are always available

## Atomic Lock Strategy

**Purpose:** Prevent race conditions when multiple processes try to initialize simultaneously

**Implementation:**
```typescript
const acquired = await context.redis.set(lockKey, '1', {
  expiration: new Date(Date.now() + 60000), // 60 seconds
  nx: true, // Only set if not exists
});
```

**Key Features:**
- Uses Redis SET with NX (only if not exists)
- 60-second TTL prevents locks from persisting if initialization crashes
- `finally` block ensures lock is always released
- Safe to call multiple times (idempotent)

## Initialization Safety

**Double-Check Pattern:**
Both AppInstall AND PostSubmit can initialize (safety net)

**Why?**
- AppInstall event might be missed in some scenarios
- PostSubmit provides fallback initialization
- First post to any subreddit triggers initialization check

**Idempotent Design:**
- Safe to call `initializeDefaultRules()` multiple times
- Checks existing rules before overwriting
- Only initializes once per subreddit

## Error Handling

**AppInstall Handler:**
- Logs errors but doesn't throw
- Allows app to continue even if initialization fails
- PostSubmit fallback ensures eventual initialization

**PostSubmit Handler:**
- Attempts initialization if needed
- Continues processing even if initialization fails
- Rules engine handles missing rules gracefully (defaults to APPROVE)

## Redis Keys

**Lock Keys:**
- `automod:init:lock:{subredditName}` - Atomic initialization lock

**Initialization Flags:**
- `automod:initialized:{subredditName}` - Marks successful initialization

**Rule Storage:**
- `rules:{subredditName}:set` - Rule set storage (managed by RuleStorage)

## Testing Initialization

**To test initialization:**
```typescript
// 1. Delete rules
await context.redis.del('rules:FriendsOver40:set');

// 2. Delete init flag
await context.redis.del('automod:initialized:FriendsOver40');

// 3. Post to subreddit or reinstall app
// Rules should be automatically initialized

// 4. Verify rules exist
const ruleStorage = new RuleStorage(context.redis);
const rules = await ruleStorage.getRuleSet('FriendsOver40');
console.log(`Rules initialized: ${rules?.rules.length || 0} rules`);
```

## Troubleshooting

**Rules not initializing:**
1. Check AppInstall event logs
2. Check PostSubmit fallback logs
3. Verify Redis connectivity
4. Check for lock contention (unlikely with 60s TTL)

**Rules getting overwritten:**
- Should NOT happen - initialization checks existing rules first
- If happening, check for bugs in lock acquisition logic

**Lock not releasing:**
- 60-second TTL ensures automatic cleanup
- Manual cleanup: `await context.redis.del('automod:init:lock:SUBREDDIT')`

## Future Enhancements

**Phase 5+:**
- Custom rule templates via UI
- Rule import/export functionality
- Per-moderator rule customization
- Rule versioning and rollback
