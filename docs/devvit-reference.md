# Reddit Devvit Development Reference

> **Comprehensive guide for building Reddit automod apps with Devvit**
> Extracted from official Reddit Devvit documentation (289KB source)
> Created: 2025-10-30

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Triggers & Events](#triggers--events)
3. [Reddit API](#reddit-api)
4. [Permissions & Security](#permissions--security)
5. [Storage (Redis)](#storage-redis)
6. [HTTP Fetch (External APIs)](#http-fetch-external-apis)
7. [Settings & Configuration](#settings--configuration)
8. [Menu Actions](#menu-actions)
9. [Forms](#forms)
10. [Scheduler](#scheduler)
11. [Error Handling](#error-handling)
12. [Testing & Deployment](#testing--deployment)
13. [Performance Optimization](#performance-optimization)
14. [devvit.json Configuration](#devvitjson-configuration)
15. [Automod Use Cases](#automod-use-cases)

---

## Core Architecture

### Devvit Blocks vs Devvit Web

**Devvit Blocks** (Our Approach):
- Traditional Reddit app architecture
- TypeScript-based with React-like components
- Configuration via `devvit.json` and code
- Entry point: `src/main.tsx`
- Best for: Mod tools, bots, automod apps

**Devvit Web** (Alternative):
- Modern client/server split architecture
- Node.js backend + web frontend
- All configuration in `devvit.json`
- Best for: Interactive web apps, games

### Project Structure (Blocks)
```
project/
├── src/
│   ├── main.tsx              # Entry point, event handlers
│   ├── handlers/             # Event processing logic
│   ├── ai/                   # AI integrations
│   ├── pipeline/             # Moderation pipeline
│   ├── profile/              # User profiling
│   ├── config/               # Configuration management
│   ├── storage/              # Redis operations
│   └── utils/                # Helper utilities
├── devvit.json               # App configuration
├── assets/                   # Static assets
└── package.json              # Dependencies
```

---

## Triggers & Events

### Overview
Triggers allow apps to automatically respond to Reddit events. All apps using triggers must handle events responsibly to avoid recursive loops.

### Available Triggers

**Post Events:**
- `onPostSubmit` - When post is submitted (before approval)
- `onPostCreate` - After post is created (approved)
- `onPostUpdate` - Post edited
- `onPostDelete` - Post deleted
- `onPostReport` - Post reported
- `onPostFlairUpdate` - Flair changed
- `onPostNsfwUpdate` - NSFW status changed
- `onPostSpoilerUpdate` - Spoiler status changed

**Comment Events:**
- `onCommentSubmit` - Comment submitted (before approval)
- `onCommentCreate` - Comment created (approved)
- `onCommentUpdate` - Comment edited
- `onCommentDelete` - Comment deleted
- `onCommentReport` - Comment reported

**Moderation Events:**
- `onModAction` - Any mod action taken
- `onModMail` - Modmail received

**Other Events:**
- `onAppInstall` - App installed on subreddit
- `onAppUpgrade` - App upgraded to new version
- `onAutomoderatorFilterPost` - Automod filtered post
- `onAutomoderatorFilterComment` - Automod filtered comment

### Configuration (Devvit Blocks)

```tsx
// src/main.tsx
import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add trigger handler
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const post = await context.reddit.getPostById(event.post!.id);
    const author = await context.reddit.getUserById(event.author!.id);

    console.log(`Post submitted by ${author.username}: ${post.title}`);

    // Perform moderation logic
    // ...
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    const comment = await context.reddit.getCommentById(event.comment!.id);
    const author = await context.reddit.getUserById(event.author!.id);

    console.log(`Comment by ${author.username}: ${comment.body}`);

    // Perform moderation logic
    // ...
  },
});

export default Devvit;
```

### Event Object Structure

**PostSubmit Event:**
```ts
{
  post: {
    id: 't3_abc123',
    title: 'Post title',
    body: 'Post content',
    url: 'https://...',
    // ... more fields
  },
  author: {
    id: 't2_username',
    name: 'username'
  },
  subreddit: {
    id: 't5_subreddit',
    name: 'subreddit'
  }
}
```

### Best Practices

1. **Prevent Recursive Triggers:**
```ts
Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    // Check if comment is from our app
    const comment = await context.reddit.getCommentById(event.comment!.id);
    const appUser = await context.reddit.getAppUser();

    if (comment.authorId === appUser.id) {
      console.log('Ignoring our own comment');
      return;
    }

    // Process other comments...
  },
});
```

2. **Handle Errors Gracefully:**
```ts
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    try {
      await processPost(event, context);
    } catch (error) {
      console.error('Error processing post:', error);
      // Don't let trigger fail silently
    }
  },
});
```

3. **Log Important Events:**
```ts
console.log(`Processing post ${event.post!.id} from ${event.author!.name}`);
```

---

## Reddit API

### Enabling Reddit API

```ts
// src/main.tsx
Devvit.configure({
  redditAPI: true,
});
```

Or in `devvit.json`:
```json
{
  "permissions": {
    "reddit": {
      "enable": true,
      "scope": "moderator",
      "asUser": ["SUBMIT_COMMENT"]
    }
  }
}
```

### Common Operations

#### Get Current User/Subreddit
```ts
const currentUser = await context.reddit.getCurrentUser();
const username = currentUser.username;

const subreddit = await context.reddit.getCurrentSubreddit();
const subredditName = subreddit.name;
```

#### Get Post/Comment
```ts
const post = await context.reddit.getPostById('t3_abc123');
const comment = await context.reddit.getCommentById('t1_def456');
```

#### Get User Information
```ts
const user = await context.reddit.getUserById('t2_username');

// User properties
const accountAge = new Date().getTime() - user.createdAt.getTime();
const totalKarma = user.linkKarma + user.commentKarma;
const hasVerifiedEmail = user.hasVerifiedEmail ?? false;
const isGold = user.isGold;
const isMod = user.isMod;
```

#### Get User History
```ts
// Get user's posts
const posts = await context.reddit.getPostsByUser({
  username: 'username',
  limit: 100,
  timeframe: 'all',
  sort: 'new',
}).all();

// Get user's comments
const comments = await context.reddit.getCommentsByUser({
  username: 'username',
  limit: 100,
  timeframe: 'all',
  sort: 'new',
}).all();
```

#### Submit Comment
```ts
await context.reddit.submitComment({
  id: post.id,
  text: 'This is a comment from the app',
});

// Comment as user (requires permission)
await context.reddit.submitComment({
  id: post.id,
  text: 'This comment is posted as the user',
  runAs: 'USER',
});
```

#### Moderation Actions

**Remove Content:**
```ts
await post.remove();
await comment.remove();
```

**Approve Content:**
```ts
await post.approve();
await comment.approve();
```

**Lock/Unlock:**
```ts
await post.lock();
await post.unlock();
```

**Distinguish Comment:**
```ts
await comment.distinguish(true); // Distinguish as mod
await comment.distinguish(false); // Un-distinguish
```

**Ban User:**
```ts
await context.reddit.banUser({
  subredditName: 'mysubreddit',
  username: 'username',
  duration: 7, // Days (omit for permanent)
  reason: 'Spam',
  note: 'AI detected spam',
  message: 'You have been banned for spam',
});
```

**Add Mod Log Entry:**
```ts
await context.modLog.add({
  action: 'removepost',
  target: post.id,
  details: 'AI spam detection',
  description: `Removed post by u/${author.username} - confidence: 95%`,
});
```

#### Check User Status

**Is Approved User:**
```ts
const approvedUsers = await context.reddit.getApprovedUsers({
  subredditName: context.subredditName,
}).all();

const isApproved = approvedUsers.some(u => u.username === username);
```

**Is Moderator:**
```ts
const moderators = await context.reddit.getModerators({
  subredditName: context.subredditName,
}).all();

const isModerator = moderators.some(m => m.username === username);
```

### Data Access Scope

**Important:** Reddit API access is scoped to:
- **Site-wide user data** - Can access user profiles, post history across all subreddits
- **Subreddit-specific actions** - Can only take mod actions in subreddits where app is installed

Example logging to verify scope:
```ts
const posts = await user.getPosts({ limit: 100 }).all();
const subreddits = new Set(posts.map(p => p.subredditName));
console.log(`Fetched ${posts.length} posts from ${subreddits.size} subreddits`);
```

---

## Permissions & Security

### Permission Types

1. **UI Permissions** - UI elements used
2. **User Data Handling** - How app manages data
3. **Mod Permissions** - App account permissions

### App Accounts

- Each app has an "app account" (bot user)
- Currently granted **full mod permissions** in installed subreddits
- Can take mod actions, post comments, send messages programmatically
- Not human-operated

### Configuring Permissions

```json
{
  "permissions": {
    "http": {
      "enable": true,
      "domains": ["api.openai.com", "api.anthropic.com"]
    },
    "media": true,
    "redis": true,
    "reddit": {
      "enable": true,
      "scope": "moderator",
      "asUser": ["SUBMIT_COMMENT"]
    }
  }
}
```

**Available Permissions:**
- `http` - External API calls
- `media` - Image uploads
- `payments` - Payment handling
- `realtime` - Realtime messaging
- `redis` - Redis storage
- `reddit` - Reddit API access

### Reddit Scope Options

**`scope: "moderator"`** (Recommended for automod):
- Full access to moderation actions
- Can remove/approve content
- Can ban users
- Can access mod queue

**`scope: "user"`**:
- Limited to user-level actions
- Cannot perform moderation

### User Actions (asUser)

Allow app to perform actions **as the user**:
- `SUBMIT_POST` - Post on behalf of user
- `SUBMIT_COMMENT` - Comment as user
- `SUBSCRIBE_TO_SUBREDDIT` - Subscribe user to subreddit

**Requirements:**
- User must explicitly opt-in
- Must be transparent about what will be posted
- Provide clear opt-out mechanism

### Data Privacy

**Key Principles:**
- Each installation has isolated data storage
- Data cannot be shared between communities
- Uninstalling app deletes all data
- All apps reviewed by Reddit admins

### Security Best Practices

1. **Never log credentials:**
```ts
// ❌ Bad
console.log(`API Key: ${apiKey}`);

// ✅ Good
console.log('API key configured');
```

2. **Validate inputs:**
```ts
if (!context.postId) {
  console.error('No post ID provided');
  return;
}
```

3. **Use secrets for sensitive data:**
```bash
# Set via CLI only
npx devvit settings set apiKey
```

4. **Check user permissions:**
```ts
const moderators = await context.reddit.getModerators({
  subredditName: context.subredditName,
}).all();

if (!moderators.some(m => m.username === context.userId)) {
  context.ui.showToast('This action requires moderator permissions');
  return;
}
```

---

## Storage (Redis)

### Overview

Redis is a fast, scalable key-value store provided by Devvit. Each app installation gets its own isolated namespace.

### Limits (per installation)
- Max commands/sec: 1,000
- Max request size: 5 MB
- Max storage: 500 MB

### Enabling Redis

```ts
Devvit.configure({
  redis: true,
});
```

### Basic Operations

```ts
// Set/get
await context.redis.set('key', 'value');
const value = await context.redis.get('key');

// Check existence
const exists = await context.redis.exists('key');

// Delete
await context.redis.del('key');

// Expire (TTL in seconds)
await context.redis.set('session', 'data');
await context.redis.expire('session', 3600); // 1 hour
```

### Batch Operations

```ts
// Set multiple
await context.redis.mSet({
  name: 'Devvit',
  version: '1.0',
  status: 'active',
});

// Get multiple
const [name, version] = await context.redis.mGet(['name', 'version']);
```

### Numeric Operations

```ts
await context.redis.set('counter', '0');
await context.redis.incrBy('counter', 1); // Returns 1
await context.redis.incrBy('counter', 10); // Returns 11
```

### Hashes (Collections)

**Use hashes for structured data!**

```ts
// Set hash fields
await context.redis.hSet('user:123', {
  username: 'alice',
  karma: '1500',
  posts: '42',
  trustScore: '85',
});

// Get field
const username = await context.redis.hGet('user:123', 'username');

// Get multiple fields
const [karma, posts] = await context.redis.hMGet('user:123', ['karma', 'posts']);

// Get all fields
const userData = await context.redis.hGetAll('user:123');
// Returns: { username: 'alice', karma: '1500', ... }

// Increment field
await context.redis.hIncrBy('user:123', 'karma', 5);

// Get all keys
const fields = await context.redis.hKeys('user:123');
// Returns: ['username', 'karma', 'posts', 'trustScore']

// Check if field exists
const exists = await context.redis.hExists('user:123', 'username');

// Delete field
await context.redis.hDel('user:123', ['posts']);

// Scan large hash
let cursor = 0;
const allData = {};
do {
  const result = await context.redis.hScan('user:123', cursor);
  cursor = result.cursor;
  Object.assign(allData, result.members);
} while (cursor !== 0);
```

### Sorted Sets (Leaderboards)

```ts
// Add members with scores
await context.redis.zAdd(
  'leaderboard',
  { member: 'alice', score: 100 },
  { member: 'bob', score: 85 },
  { member: 'charlie', score: 92 }
);

// Get top 10 (highest scores)
const top10 = await context.redis.zRange('leaderboard', 0, 9, {
  by: 'rank',
  reverse: true,
});

// Get range by score
const highScorers = await context.redis.zRange('leaderboard', 90, 100, {
  by: 'score',
});

// Get member rank (0-indexed)
const rank = await context.redis.zRank('leaderboard', 'alice');

// Get member score
const score = await context.redis.zScore('leaderboard', 'alice');

// Increment score
await context.redis.zIncrBy('leaderboard', 'alice', 10);

// Remove members
await context.redis.zRem('leaderboard', ['bob']);

// Get count
const count = await context.redis.zCard('leaderboard');
```

### Transactions

```ts
// Create transaction
const txn = await context.redis.watch('inventory');

await txn.multi(); // Begin transaction

// Queue commands
await txn.incrBy('gold', -10);
await txn.incrBy('items', 1);

// Execute atomically
const results = await txn.exec();

// Or discard
await txn.discard();
```

### Key Patterns

**Recommended naming conventions:**
```ts
// User data
`user:${userId}:profile`
`user:${userId}:history`
`user:${userId}:trustScore`

// Tracking
`tracking:${postId}`
`tracking:${commentId}`

// Caches (with expiration)
`cache:${key}`

// Leaderboards
`leaderboard:${category}`
```

### Best Practices

1. **Use hashes for collections:**
```ts
// ❌ Bad - multiple keys
await context.redis.set(`user:123:name`, 'alice');
await context.redis.set(`user:123:karma`, '1500');

// ✅ Good - single hash
await context.redis.hSet('user:123', {
  name: 'alice',
  karma: '1500',
});
```

2. **Set expiration on temporary data:**
```ts
await context.redis.set('temp:data', value);
await context.redis.expire('temp:data', 3600); // 1 hour
```

3. **Use transactions for atomic operations:**
```ts
// Voting - prevent race conditions
const txn = await context.redis.watch(`votes:${postId}`);
await txn.multi();
await txn.incrBy(`votes:${postId}`, 1);
await txn.hSet(`voted:${userId}`, postId, '1');
await txn.exec();
```

4. **Batch operations when possible:**
```ts
// ❌ Bad
for (const key of keys) {
  await context.redis.get(key);
}

// ✅ Good
const values = await context.redis.mGet(keys);
```

---

## HTTP Fetch (External APIs)

### Overview

Devvit apps can make HTTP requests to allow-listed external domains. Domain requests are reviewed by Reddit admins.

### Configuration

```json
{
  "permissions": {
    "http": {
      "enable": true,
      "domains": [
        "api.openai.com",
        "api.anthropic.com",
        "api.z.ai",
        "api.groq.com"
      ]
    }
  }
}
```

### Domain Requirements

**Must be:**
- Exact hostnames (e.g., `api.example.com`)
- No wildcards (`*.example.com` ❌)
- No protocols (`https://api.example.com` ❌)
- No paths (`api.example.com/v1` ❌)

**Categories:**

1. **Public APIs** - Approved if:
   - Publicly accessible with documentation
   - Valid use case for app functionality

2. **Cloud Providers** - May be approved with restrictions:
   - Must follow user privacy guidelines
   - Approved providers: Supabase, Firebase, SpacetimeDB, AWS S3, Google Cloud Storage
   - Must demonstrate capability Devvit doesn't support

3. **Personal Domains** - Not approved

### README Requirements

Must document why each domain is needed:

```markdown
## External Domains

The following domains are requested:

- `api.openai.com` - AI analysis for content moderation (GPT-4o-mini)
- `api.anthropic.com` - Primary AI provider (Claude 3.5 Haiku)
- `api.z.ai` - Alternative AI provider fallback
```

### Usage

```ts
// GET request
const response = await fetch('https://api.example.com/data', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
});

const data = await response.json();

// POST request
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Analyze this text' }],
  }),
});

const result = await response.json();
```

### Limitations

- Only HTTPS allowed
- Supported methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
- Timeout: 30 seconds
- Must provide Terms & Conditions + Privacy Policy

### Global Allowlist

These domains don't require approval:
- `api.openai.com`
- `api.anthropic.com`
- `example.com`
- `api.wikipedia.org`
- `discord.com`
- `slack.com`
- `api.telegram.org`
- Plus many more (see full list in docs)

### Error Handling

```ts
try {
  const response = await fetch('https://api.example.com/data');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Fetch error:', error);

  if (error.message.includes('FETCH_ERROR')) {
    // Domain not in allowlist
    console.error('Domain not approved - add to devvit.json');
  } else if (error.message.includes('timeout')) {
    // Request timed out (>30s)
    console.error('Request timed out');
  }

  throw error;
}
```

---

## Settings & Configuration

### Two Scopes

1. **Global Settings & Secrets** - Set by developers, shared across all installations
2. **Subreddit Settings** - Configured by moderators per installation

### Defining Settings

```ts
// src/main.tsx
Devvit.addSettings([
  // Global secret (CLI only)
  {
    type: 'string',
    name: 'openaiApiKey',
    label: 'OpenAI API Key',
    helpText: 'Get your API key from platform.openai.com',
    isSecret: true,
    scope: 'app',
  },

  // Subreddit setting - string
  {
    type: 'string',
    name: 'welcomeMessage',
    label: 'Welcome Message',
    helpText: 'Message posted on new user posts',
    defaultValue: 'Welcome to our community!',
    scope: 'installation',
    onValidate: async ({ value }) => {
      if (!value || value.length < 5) {
        return 'Message must be at least 5 characters';
      }
    },
  },

  // Number setting
  {
    type: 'number',
    name: 'trustThreshold',
    label: 'Trust Score Threshold',
    helpText: 'Users below this score will be analyzed',
    defaultValue: 70,
    scope: 'installation',
  },

  // Boolean toggle
  {
    type: 'boolean',
    name: 'enableAI',
    label: 'Enable AI Analysis',
    defaultValue: true,
    scope: 'installation',
  },

  // Select dropdown
  {
    type: 'select',
    name: 'aiProvider',
    label: 'AI Provider',
    options: [
      { label: 'Claude 3.5 Haiku', value: 'claude' },
      { label: 'OpenAI GPT-4o-mini', value: 'openai' },
    ],
    defaultValue: ['claude'],
    scope: 'installation',
  },

  // Paragraph (multi-line)
  {
    type: 'paragraph',
    name: 'customRules',
    label: 'Custom Rules (JSON)',
    helpText: 'JSON array of custom moderation rules',
    defaultValue: '[]',
    scope: 'installation',
  },

  // Group (organize related settings)
  {
    type: 'group',
    label: 'Trust Score Settings',
    helpText: 'Configure trust score calculation',
    fields: [
      {
        type: 'number',
        name: 'minAccountAge',
        label: 'Minimum Account Age (days)',
        defaultValue: 30,
      },
      {
        type: 'number',
        name: 'minKarma',
        label: 'Minimum Karma',
        defaultValue: 100,
      },
    ],
  },
]);
```

### Managing Secrets (CLI)

```bash
# List secrets
npx devvit settings list

# Set secret value (interactive prompt)
npx devvit settings set openaiApiKey

# Set with value
echo "sk-..." | npx devvit settings set openaiApiKey
```

**Important:**
- Secrets can only be global
- Secrets can only be set via CLI by app developers
- At least one app installation required before storing secrets

### Accessing Settings

```ts
// Get single setting
const apiKey = await context.settings.get('openaiApiKey');

// Get multiple settings
const [threshold, enableAI] = await Promise.all([
  context.settings.get('trustThreshold'),
  context.settings.get('enableAI'),
]);

// Get all settings
const allSettings = await context.settings.getAll();
```

### Input Validation

```ts
Devvit.addSettings([
  {
    type: 'number',
    name: 'confidenceThreshold',
    label: 'AI Confidence Threshold (%)',
    defaultValue: 75,
    scope: 'installation',
    onValidate: async ({ value }) => {
      const num = parseInt(value as string);

      if (isNaN(num)) {
        return 'Must be a number';
      }

      if (num < 0 || num > 100) {
        return 'Must be between 0 and 100';
      }
    },
  },
]);
```

### Settings UI

Moderators can configure settings via:
1. App settings page in mod tools
2. Forms displayed by the app

Settings automatically generate UI - no need to create forms manually.

### Best Practices

1. **Use secrets for API keys:**
```ts
// ✅ Good - secret
{
  type: 'string',
  name: 'apiKey',
  isSecret: true,
  scope: 'app',
}
```

2. **Provide helpful defaults:**
```ts
{
  type: 'number',
  name: 'threshold',
  label: 'Threshold',
  helpText: 'Higher values = stricter moderation',
  defaultValue: 75, // Sensible default
}
```

3. **Validate inputs:**
```ts
onValidate: async ({ value }) => {
  if (!value || value.length === 0) {
    return 'This field is required';
  }
}
```

4. **Group related settings:**
```ts
{
  type: 'group',
  label: 'Layer 1: Trust Score',
  fields: [
    // Related trust score settings
  ],
}
```

---

## Menu Actions

### Overview

Menu actions add items to the three-dot menu for posts, comments, or subreddits. They're primarily used for moderator tools.

### Configuration

```ts
// src/main.tsx
Devvit.addMenuItem({
  label: 'Check Post with AI',
  description: 'Run AI analysis on this post',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(event.targetId);

    // Show loading toast
    context.ui.showToast('Analyzing post...');

    // Run analysis
    const result = await analyzePost(post);

    // Show result
    if (result.isSpam) {
      context.ui.showToast(`⚠️ Potential spam detected (${result.confidence}%)`);
    } else {
      context.ui.showToast(`✅ Post looks good`);
    }
  },
});

Devvit.addMenuItem({
  label: 'Show User Profile',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: async (event, context) => {
    // Show form with user info
    context.ui.showForm(userProfileForm, {
      userId: event.authorId,
    });
  },
});
```

### Menu Item Properties

- `label` (required) - Display text
- `description` - Short description
- `location` - Where menu appears:
  - `'post'` - Post overflow menu
  - `'comment'` - Comment overflow menu
  - `'subreddit'` - Subreddit menu
  - `['post', 'comment']` - Multiple locations
- `forUserType` - Who can see it:
  - `'moderator'` (default) - Only moderators
  - `'user'` - All users
- `postFilter` (optional):
  - `'none'` (default) - Show on all posts
  - `'currentApp'` - Only on posts created by this app
- `onPress` - Handler function

### Event Object

```ts
{
  targetId: 't3_abc123',  // Post/comment ID
  location: 'post',       // Where clicked
  authorId: 't2_user',    // Content author ID
}
```

### UI Responses

**Show Toast:**
```ts
context.ui.showToast('Action completed!');
context.ui.showToast({
  text: 'Error occurred',
  appearance: 'error',
});
```

**Show Form:**
```ts
context.ui.showForm(myForm, { initialData });
```

**Navigate:**
```ts
context.ui.navigateTo(`https://reddit.com/r/subreddit`);
```

### Best Practices

1. **Provide feedback:**
```ts
onPress: async (event, context) => {
  context.ui.showToast('Processing...');

  try {
    await doWork();
    context.ui.showToast('✅ Success!');
  } catch (error) {
    context.ui.showToast({
      text: '❌ Failed',
      appearance: 'error',
    });
  }
}
```

2. **Use appropriate user types:**
```ts
// Moderation actions - moderator only
{
  label: 'Remove and Ban',
  forUserType: 'moderator',
  // ...
}

// Reporting - all users
{
  label: 'Report Issue',
  forUserType: 'user',
  // ...
}
```

3. **Check permissions:**
```ts
onPress: async (event, context) => {
  const mods = await context.reddit.getModerators({
    subredditName: context.subredditName,
  }).all();

  if (!mods.some(m => m.username === context.userId)) {
    context.ui.showToast('Moderator only');
    return;
  }

  // Perform action
}
```

### Security Note

When `forUserType: 'moderator'`, user must complete all actions within **10 minutes** for security.

---

## Forms

### Overview

Forms let apps collect user input. They're displayed as modal dialogs with various field types.

### Basic Form

```ts
import { Devvit, useForm } from '@devvit/public-api';

// Create form
const myForm = Devvit.createForm(
  {
    fields: [
      {
        type: 'string',
        name: 'username',
        label: 'Username',
        placeholder: 'Enter username',
        required: true,
      },
      {
        type: 'number',
        name: 'age',
        label: 'Age',
      },
      {
        type: 'boolean',
        name: 'newsletter',
        label: 'Subscribe to newsletter',
        defaultValue: false,
      },
    ],
    title: 'User Information',
    description: 'Tell us about yourself',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  },
  // Submit handler
  async (event, context) => {
    const { username, age, newsletter } = event.values;

    console.log(`User: ${username}, Age: ${age}, Newsletter: ${newsletter}`);

    context.ui.showToast('Form submitted!');
  }
);

// Show form from menu action
Devvit.addMenuItem({
  label: 'Show Form',
  location: 'subreddit',
  onPress: (event, context) => {
    context.ui.showForm(myForm);
  },
});
```

### Field Types

**1. String - Single-line text**
```ts
{
  type: 'string',
  name: 'title',
  label: 'Tournament Title',
  placeholder: 'Enter title',
  required: true,
  helpText: 'Must be unique',
  defaultValue: 'My Tournament',
}
```

**2. Paragraph - Multi-line text**
```ts
{
  type: 'paragraph',
  name: 'description',
  label: 'Description',
  helpText: 'Detailed explanation',
  lineHeight: 5,
}
```

**3. Number - Numeric input**
```ts
{
  type: 'number',
  name: 'maxPlayers',
  label: 'Maximum Players',
  defaultValue: 10,
}
```

**4. Boolean - Yes/no toggle**
```ts
{
  type: 'boolean',
  name: 'enableFeature',
  label: 'Enable this feature',
  defaultValue: true,
}
```

**5. Select - Dropdown**
```ts
{
  type: 'select',
  name: 'difficulty',
  label: 'Difficulty Level',
  options: [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ],
  defaultValue: ['medium'],
  multiSelect: false, // or true for multiple selection
}
```

**6. Image - Upload image**
```ts
{
  type: 'image',
  name: 'avatar',
  label: 'Upload Avatar',
  required: true,
}
// Returns i.redd.it URL
```

**7. Group - Organize fields**
```ts
{
  type: 'group',
  label: 'Personal Information',
  helpText: 'Tell us about yourself',
  fields: [
    { type: 'string', name: 'firstName', label: 'First Name' },
    { type: 'string', name: 'lastName', label: 'Last Name' },
    { type: 'number', name: 'age', label: 'Age' },
  ],
}
```

### Form with Initial Data

```ts
context.ui.showForm(myForm, {
  username: 'alice',
  age: 25,
});
```

### Multi-Step Forms

```ts
// Step 1 form
const step1Form = Devvit.createForm(
  { fields: [{ type: 'string', name: 'name', label: 'Name' }] },
  async (event, context) => {
    // Save step 1 data
    await context.redis.set('form:name', event.values.name);

    // Show step 2
    context.ui.showForm(step2Form);
  }
);

// Step 2 form
const step2Form = Devvit.createForm(
  { fields: [{ type: 'string', name: 'email', label: 'Email' }] },
  async (event, context) => {
    // Get step 1 data
    const name = await context.redis.get('form:name');

    // Process complete form
    console.log(`Name: ${name}, Email: ${event.values.email}`);

    context.ui.showToast('Registration complete!');
  }
);
```

### Form Validation

```ts
const validatedForm = Devvit.createForm(
  {
    fields: [
      {
        type: 'string',
        name: 'email',
        label: 'Email',
        required: true,
      },
    ],
  },
  async (event, context) => {
    const { email } = event.values;

    // Validate
    if (!email.includes('@')) {
      context.ui.showToast({
        text: 'Invalid email address',
        appearance: 'error',
      });
      return;
    }

    // Process
    context.ui.showToast('Email saved!');
  }
);
```

### Best Practices

1. **Provide helpful labels and help text:**
```ts
{
  type: 'number',
  name: 'threshold',
  label: 'Confidence Threshold',
  helpText: 'AI confidence percentage (0-100)',
  defaultValue: 75,
}
```

2. **Use appropriate field types:**
```ts
// Use select for predefined options
{
  type: 'select',
  name: 'action',
  options: [
    { label: 'Remove', value: 'remove' },
    { label: 'Flag', value: 'flag' },
  ],
}

// Use boolean for yes/no
{
  type: 'boolean',
  name: 'autoApprove',
  label: 'Auto-approve trusted users',
}
```

3. **Validate before processing:**
```ts
async (event, context) => {
  const { value } = event.values;

  if (!value || value < 0) {
    context.ui.showToast('Invalid input');
    return;
  }

  // Process valid data
}
```

4. **Provide feedback:**
```ts
async (event, context) => {
  context.ui.showToast('Saving...');

  try {
    await saveData(event.values);
    context.ui.showToast('✅ Saved!');
  } catch (error) {
    context.ui.showToast({
      text: '❌ Error saving',
      appearance: 'error',
    });
  }
}
```

---

## Scheduler

### Overview

Scheduler allows running tasks at specific times - both recurring (cron) and one-off jobs.

### Recurring Jobs (Cron)

```ts
// Register cron job
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    // Schedule recurring job on install
    await context.scheduler.runJob({
      name: 'daily_cleanup',
      cron: '0 2 * * *', // 2 AM daily
    });
  },
});

// Handle scheduled job
Devvit.addSchedulerJob({
  name: 'daily_cleanup',
  onRun: async (event, context) => {
    console.log('Running daily cleanup...');

    // Cleanup old data
    const keys = await context.redis.keys('cache:*');
    for (const key of keys) {
      const ttl = await context.redis.expireTime(key);
      if (ttl && ttl < Date.now()) {
        await context.redis.del(key);
      }
    }

    console.log('Cleanup complete');
  },
});
```

### Cron Format

```
* * * * *
│ │ │ │ └─ day of week (0-6, Sunday=0)
│ │ │ └─── month (1-12)
│ │ └───── day of month (1-31)
│ └─────── hour (0-23)
└───────── minute (0-59)
```

**Examples:**
- `0 * * * *` - Every hour
- `*/15 * * * *` - Every 15 minutes
- `0 2 * * *` - 2 AM daily
- `0 0 * * 0` - Midnight every Sunday
- `0 9 1 * *` - 9 AM on 1st of month

Use [crontab.guru](https://crontab.guru/) to build cron expressions.

### One-Off Jobs

```ts
// Schedule one-time job
const runAt = new Date(Date.now() + 60000); // 1 minute from now

await context.scheduler.runJob({
  name: 'one_off_task',
  data: {
    postId: 't3_abc123',
    action: 'check',
  },
  runAt: runAt,
});

// Handler
Devvit.addSchedulerJob({
  name: 'one_off_task',
  onRun: async (event, context) => {
    const { postId, action } = event.data;

    console.log(`Running ${action} for ${postId}`);

    // Perform action
    const post = await context.reddit.getPostById(postId);
    await checkPost(post);
  },
});
```

### Job with Data

```ts
// Pass data to job
await context.scheduler.runJob({
  name: 'process_user',
  cron: '0 * * * *',
  data: {
    userId: 't2_user123',
    checkType: 'trust_score',
  },
});

// Access data in handler
Devvit.addSchedulerJob({
  name: 'process_user',
  onRun: async (event, context) => {
    const { userId, checkType } = event.data;

    if (checkType === 'trust_score') {
      await updateTrustScore(userId, context);
    }
  },
});
```

### Limitations (per installation)

- Max 10 live recurring actions
- Rate limits:
  - Creation: Up to 60 calls/minute
  - Delivery: Up to 60 deliveries/minute

### Common Use Cases

**1. Cleanup old data:**
```ts
Devvit.addSchedulerJob({
  name: 'cleanup',
  onRun: async (event, context) => {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

    // Delete old tracking records
    const keys = await context.redis.keys('tracking:*');
    for (const key of keys) {
      const created = await context.redis.hGet(key, 'created');
      if (created && parseInt(created) < cutoff) {
        await context.redis.del(key);
      }
    }
  },
});
```

**2. Periodic checks:**
```ts
Devvit.addSchedulerJob({
  name: 'health_check',
  onRun: async (event, context) => {
    // Check AI provider health
    const health = await checkAIProviders();

    if (!health.ok) {
      // Send modmail alert
      await context.reddit.sendPrivateMessage({
        to: 'moderators',
        subject: 'AI Automod Alert',
        text: 'AI provider health check failed',
      });
    }
  },
});
```

**3. Delayed actions:**
```ts
// User posts controversial content
// Schedule review in 24 hours
await context.scheduler.runJob({
  name: 'review_post',
  runAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  data: { postId: post.id },
});
```

### Best Practices

1. **Handle errors gracefully:**
```ts
Devvit.addSchedulerJob({
  name: 'task',
  onRun: async (event, context) => {
    try {
      await performTask();
    } catch (error) {
      console.error('Scheduled task error:', error);
      // Don't let job crash
    }
  },
});
```

2. **Log job execution:**
```ts
Devvit.addSchedulerJob({
  name: 'task',
  onRun: async (event, context) => {
    console.log(`Job started: ${event.name} at ${new Date()}`);

    // Do work

    console.log('Job completed');
  },
});
```

3. **Use appropriate schedules:**
```ts
// Cleanup - off-peak hours
cron: '0 3 * * *' // 3 AM

// Frequent checks - every 15 minutes
cron: '*/15 * * * *'

// Weekly reports - Monday morning
cron: '0 9 * * 1'
```

---

## Error Handling

### Best Practices

**1. Wrap API calls in try-catch:**
```ts
try {
  const post = await context.reddit.getPostById(postId);
  await post.remove();
  context.ui.showToast('Post removed');
} catch (error) {
  console.error(`Error removing post ${postId}:`, error);
  context.ui.showToast({
    text: 'Failed to remove post',
    appearance: 'error',
  });
}
```

**2. Log errors with context:**
```ts
try {
  await processUser(userId);
} catch (error) {
  console.error('Error processing user:', {
    userId,
    subreddit: context.subredditName,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
```

**3. Handle Reddit API errors:**
```ts
try {
  await context.reddit.submitComment({
    id: postId,
    text: 'Comment text',
  });
} catch (error) {
  if (error.message.includes('RATELIMIT')) {
    // Hit rate limit - wait and retry
    console.log('Rate limited, waiting 60s');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Retry
    await context.reddit.submitComment({
      id: postId,
      text: 'Comment text',
    });
  } else if (error.message.includes('DELETED')) {
    // Post was deleted
    console.log('Post deleted, skipping comment');
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

**4. Validate inputs:**
```ts
function processPost(postId: string, context: Context) {
  if (!postId) {
    console.error('No post ID provided');
    return;
  }

  if (!context.userId) {
    console.error('User not authenticated');
    context.ui.showToast('Please log in');
    return;
  }

  // Process post
}
```

**5. Handle external API errors:**
```ts
async function callAI(prompt: string): Promise<string> {
  const apiKey = await context.settings.get('apiKey');

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('AI API error:', {
      error: error instanceof Error ? error.message : String(error),
      prompt: prompt.substring(0, 100), // Log first 100 chars
    });

    throw error;
  }
}
```

**6. Never crash on single failure:**
```ts
// Process multiple items
for (const comment of comments) {
  try {
    await processComment(comment);
  } catch (error) {
    console.error(`Failed to process comment ${comment.id}:`, error);
    // Continue processing other comments
    continue;
  }
}
```

**7. Graceful degradation:**
```ts
async function getUser(userId: string) {
  try {
    return await context.reddit.getUserById(userId);
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);

    // Return null instead of crashing
    return null;
  }
}

// Usage
const user = await getUser(userId);
if (user) {
  // Use user data
} else {
  // Handle missing user
  console.log('User data unavailable, using defaults');
}
```

**8. Timeout long operations:**
```ts
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  );

  return Promise.race([promise, timeout]);
}

// Usage
try {
  const result = await withTimeout(
    analyzePost(post),
    30000 // 30 second timeout
  );
} catch (error) {
  if (error.message === 'Operation timed out') {
    console.error('Analysis timed out');
    // Handle timeout
  }
}
```

### Common Error Scenarios

**Reddit API Errors:**
- `RATELIMIT` - Hit rate limit
- `DELETED` - Content was deleted
- `THREAD_LOCKED` - Can't comment on locked post
- `SUBREDDIT_NOEXIST` - Subreddit doesn't exist

**Fetch Errors:**
- `FETCH_ERROR` - Domain not in allowlist
- Timeout - Request took >30 seconds
- Network error - Connection failed

**Redis Errors:**
- `WRONGTYPE` - Wrong data type for operation
- Quota exceeded - Storage or rate limit hit

---

## Testing & Deployment

### Playtest Mode

**Start playtest:**
```bash
# Upload app first
devvit upload

# Playtest on auto-created subreddit
devvit playtest

# Or specify subreddit (must be <200 subscribers)
devvit playtest r/my-test-subreddit
```

**Features:**
- Creates private test subreddit (you're mod)
- App pre-installed
- Live log streaming to terminal
- Code changes auto-update
- Real-time testing with live data

**Client-side logs:**
Add `?playtest=<app-name>` to URL to see client logs.

**End playtest:**
Press Ctrl+C. Playtest version remains installed.

### Viewing Logs

```bash
# Stream live logs
devvit logs r/mysubreddit ai-automod-app

# View historical logs (last 24 hours)
devvit logs r/mysubreddit --since=1d

# JSON output
devvit logs r/mysubreddit --json

# Filter by level
devvit logs r/mysubreddit --level=error
```

**Creating logs:**
```ts
console.log('Info message');
console.info('Info message');
console.warn('Warning message');
console.error('Error message', error);

// Log objects
console.log('User data:', {
  userId,
  karma,
  trustScore,
});
```

### Upload & Publish

**Upload new version:**
```bash
devvit upload

# Automatically bumps version:
# 0.0.1 → 0.0.2
# 0.1.5 → 0.1.6
```

**Publish app:**
```bash
# Unlisted (private, only you can see)
devvit publish

# Listed (public in Apps directory)
devvit publish --listed
```

### App Review

- All apps reviewed by Reddit admins before public availability
- Major updates require re-review
- Review covers source code and functionality
- Apps with security implications get thorough review

### Testing Checklist

**Before uploading:**
- [ ] All tests pass locally
- [ ] No console errors or warnings
- [ ] API keys configured as secrets
- [ ] No hardcoded credentials in code
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] devvit.json validated

**Testing in private subreddit:**
- [ ] Test with new posts/comments
- [ ] Test with different user types:
  - New users (low karma, new account)
  - Established users (high karma)
  - Moderators
  - Approved users
- [ ] Test edge cases:
  - Empty content
  - Very long content
  - Deleted content
  - Private user profiles
- [ ] Test error conditions:
  - API failures
  - Rate limits
  - Timeouts
- [ ] Test all menu actions
- [ ] Test all forms
- [ ] Test settings configuration

**Performance testing:**
- [ ] Response times acceptable
- [ ] No excessive API calls
- [ ] Redis operations optimized
- [ ] No memory leaks

### Deployment Best Practices

1. **Use version tags:**
```bash
# Tag releases in git
git tag -a v0.1.5 -m "Release 0.1.5: Add spam detection"
git push origin v0.1.5
```

2. **Document changes:**
Update CHANGELOG.md with each version.

3. **Test before deploying:**
Always playtest new versions before uploading.

4. **Monitor logs after deployment:**
```bash
devvit logs r/mysubreddit --follow
```

5. **Rollback plan:**
Keep previous version available in case issues arise.

6. **Gradual rollout:**
Test on small subreddit before deploying to large communities.

---

## Performance Optimization

### Caching

**Use cache helper for non-personalized data:**

```ts
// Cache result for 24 hours
const result = await context.cache(
  async () => {
    const response = await fetch('https://api.example.com/data');
    return await response.json();
  },
  {
    key: 'api_data',
    ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  }
);
```

**Important:** Only cache non-sensitive, non-personalized data!

### Batch Operations

**Redis batch operations:**
```ts
// ❌ Bad - multiple round trips
const name = await context.redis.get('name');
const karma = await context.redis.get('karma');
const posts = await context.redis.get('posts');

// ✅ Good - single round trip
const [name, karma, posts] = await context.redis.mGet(['name', 'karma', 'posts']);
```

**Use hashes for collections:**
```ts
// ❌ Bad - many keys
await context.redis.set('user:123:name', 'alice');
await context.redis.set('user:123:karma', '1500');
await context.redis.set('user:123:posts', '42');

// ✅ Good - single hash
await context.redis.hSet('user:123', {
  name: 'alice',
  karma: '1500',
  posts: '42',
});
```

### Optimize Reddit API Calls

**Fetch in parallel:**
```ts
// ❌ Bad - sequential
const user = await context.reddit.getUserById(userId);
const posts = await user.getPosts({ limit: 100 }).all();
const comments = await user.getComments({ limit: 100 }).all();

// ✅ Good - parallel
const [user, posts, comments] = await Promise.all([
  context.reddit.getUserById(userId),
  context.reddit.getPostsByUser({ username, limit: 100 }).all(),
  context.reddit.getCommentsByUser({ username, limit: 100 }).all(),
]);
```

**Use pagination limits:**
```ts
// Only fetch what you need
const recent = await user.getPosts({
  limit: 10, // Not 100
  timeframe: 'week', // Not 'all'
}).all();
```

### Optimize External API Calls

**1. Cache responses:**
```ts
async function callAI(prompt: string) {
  // Check cache first
  const cacheKey = `ai:${hashPrompt(prompt)}`;
  const cached = await context.redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Call API
  const result = await fetch('https://api.example.com', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  const data = await result.json();

  // Cache for 1 hour
  await context.redis.set(cacheKey, JSON.stringify(data));
  await context.redis.expire(cacheKey, 3600);

  return data;
}
```

**2. Implement retry with backoff:**
```ts
async function fetchWithRetry(url: string, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, i) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw lastError;
}
```

### Efficient Data Structures

**Use sorted sets for rankings:**
```ts
// Add user scores
await context.redis.zAdd(
  'leaderboard',
  { member: 'user1', score: 100 },
  { member: 'user2', score: 95 }
);

// Get top 10 - O(log N + 10)
const top10 = await context.redis.zRange('leaderboard', 0, 9, {
  by: 'rank',
  reverse: true,
});
```

**Use transactions for atomicity:**
```ts
// Prevent race conditions
const txn = await context.redis.watch('counter');
await txn.multi();
await txn.incrBy('counter', 1);
await txn.exec();
```

### Rate Limiting Considerations

**Reddit API:**
- PRAW handles rate limiting automatically
- Don't disable rate limit handling
- Use streaming for real-time monitoring
- Batch operations when possible

**External APIs:**
- Implement rate limiting on your side
- Use queues for high-volume operations
- Monitor API usage and costs

**Redis:**
- Max 1000 commands/sec per installation
- Batch operations to stay under limit

### Content Optimization

**Sanitize before sending to AI:**
```ts
function sanitizeContent(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/g, '[URL]') // Replace URLs
    .replace(/u\/[\w-]+/g, '[USER]') // Replace usernames
    .replace(/r\/[\w-]+/g, '[SUBREDDIT]') // Replace subreddit mentions
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

// Can reduce AI tokens by 40-60%
```

### Monitoring Performance

**Log execution times:**
```ts
async function processPost(post: Post) {
  const start = Date.now();

  try {
    // Do work
    await analyzePost(post);

    const duration = Date.now() - start;
    console.log(`Processed post ${post.id} in ${duration}ms`);

  } catch (error) {
    const duration = Date.now() - start;
    console.error(`Failed after ${duration}ms:`, error);
  }
}
```

**Track API usage:**
```ts
// Increment counter
await context.redis.hIncrBy('stats', 'api_calls', 1);
await context.redis.hIncrBy('stats', 'api_tokens', tokensUsed);

// Get stats
const stats = await context.redis.hGetAll('stats');
console.log('API usage:', stats);
```

---

## devvit.json Configuration

### Complete Example

```json
{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": "ai-automod-app",

  "blocks": {
    "entry": "src/main.tsx"
  },

  "permissions": {
    "http": {
      "enable": true,
      "domains": [
        "api.anthropic.com",
        "api.openai.com",
        "api.z.ai",
        "api.groq.com"
      ]
    },
    "redis": true,
    "media": false,
    "payments": false,
    "realtime": false,
    "reddit": {
      "enable": true,
      "scope": "moderator",
      "asUser": ["SUBMIT_COMMENT"]
    }
  },

  "marketingAssets": {
    "icon": "assets/icon.png"
  },

  "dev": {
    "subreddit": "my-test-subreddit"
  }
}
```

### Required Properties

- `name` - App account name (3-16 chars, lowercase, letters/numbers/hyphens)
- Must include at least one of: `post`, `server`, or `blocks`

### Permissions

**HTTP:**
```json
{
  "http": {
    "enable": true,
    "domains": ["api.example.com"]
  }
}
```

**Reddit:**
```json
{
  "reddit": {
    "enable": true,
    "scope": "moderator",  // or "user"
    "asUser": ["SUBMIT_COMMENT", "SUBMIT_POST"]
  }
}
```

**Other:**
- `redis: true` - Enable Redis storage
- `media: true` - Enable image uploads
- `payments: true` - Enable payments
- `realtime: true` - Enable realtime messaging

### Environment Variables

- `DEVVIT_SUBREDDIT` - Override `dev.subreddit`
- `DEVVIT_APP_NAME` - Override `name`

### Validation

Common errors:
- Missing required `name`
- Missing one of `post`/`server`/`blocks`
- Invalid patterns for names/paths
- Missing files referenced in config
- Missing required permissions for used features

---

## Automod Use Cases

### 1. Spam Detection

```ts
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const post = await context.reddit.getPostById(event.post!.id);
    const author = await context.reddit.getUserById(event.author!.id);

    // Calculate trust score
    const accountAge = new Date().getTime() - author.createdAt.getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);
    const totalKarma = author.linkKarma + author.commentKarma;

    let trustScore = 0;
    if (ageInDays >= 30) trustScore += 40;
    if (totalKarma >= 100) trustScore += 30;
    if (author.hasVerifiedEmail) trustScore += 30;

    // Low trust - analyze with AI
    if (trustScore < 70) {
      const analysis = await analyzeWithAI(post.body);

      if (analysis.isSpam && analysis.confidence > 0.9) {
        await post.remove();
        await context.modLog.add({
          action: 'removepost',
          target: post.id,
          description: `Spam detected - confidence: ${analysis.confidence}`,
        });
      } else if (analysis.confidence > 0.7) {
        await post.report({ reason: 'Potential spam - review needed' });
      }
    }
  },
});
```

### 2. Toxic Comment Detection

```ts
Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    const comment = await context.reddit.getCommentById(event.comment!.id);

    // Check with OpenAI Moderation API
    const moderation = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: comment.body,
      }),
    });

    const result = await moderation.json();
    const flagged = result.results[0].flagged;

    if (flagged) {
      await comment.remove();
      await context.reddit.sendPrivateMessage({
        to: comment.author.name,
        subject: 'Comment removed',
        text: 'Your comment violated community guidelines.',
      });
    }
  },
});
```

### 3. User Flair Based on Activity

```ts
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const userId = event.author!.id;

    // Track posts
    const postCount = await context.redis.hIncrBy(`user:${userId}`, 'posts', 1);

    // Award flair at milestones
    if (postCount === 10) {
      await context.reddit.setUserFlair({
        subredditName: context.subredditName,
        username: event.author!.name,
        text: 'Active Member',
        backgroundColor: '#46D160',
      });
    } else if (postCount === 100) {
      await context.reddit.setUserFlair({
        subredditName: context.subredditName,
        username: event.author!.name,
        text: 'Power User',
        backgroundColor: '#0079D3',
      });
    }
  },
});
```

### 4. Scheduled Cleanup

```ts
// Schedule cleanup on install
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    await context.scheduler.runJob({
      name: 'cleanup_old_posts',
      cron: '0 3 * * *', // 3 AM daily
    });
  },
});

// Handle cleanup
Devvit.addSchedulerJob({
  name: 'cleanup_old_posts',
  onRun: async (event, context) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Get tracked posts
    const keys = await context.redis.keys('tracking:*');

    for (const key of keys) {
      const created = await context.redis.hGet(key, 'created');

      if (created && parseInt(created) < cutoff.getTime()) {
        // Delete tracking record
        await context.redis.del(key);
      }
    }

    console.log(`Cleaned up ${keys.length} old records`);
  },
});
```

### 5. New User Welcome

```ts
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const author = await context.reddit.getUserById(event.author!.id);

    // Check if first post in subreddit
    const hasPosted = await context.redis.hExists('users', event.author!.id);

    if (!hasPosted) {
      // Mark as posted
      await context.redis.hSet('users', {
        [event.author!.id]: Date.now().toString(),
      });

      // Post welcome comment
      const welcomeMsg = await context.settings.get('welcomeMessage');

      await context.reddit.submitComment({
        id: event.post!.id,
        text: welcomeMsg || 'Welcome to our community!',
      });
    }
  },
});
```

---

## Important Links

- **Schema:** https://developers.reddit.com/schema/config-file.v1.json
- **Developer Portal:** https://developers.reddit.com
- **Apps Directory:** https://developers.reddit.com/apps
- **Cron Helper:** https://crontab.guru/
- **Reddit Help:** https://support.reddithelp.com/hc/en-us/requests/new

---

## Quick Reference Commands

```bash
# Development
devvit new <app-name>               # Create new app
devvit playtest [subreddit]         # Test app
devvit logs <subreddit> [app]       # View logs

# Deployment
devvit upload                       # Upload new version
devvit publish                      # Publish (unlisted)
devvit publish --listed             # Publish (public)

# Installation
devvit install <subreddit> [app]    # Install app
devvit uninstall <subreddit> [app]  # Uninstall app

# Settings
devvit settings list                # List settings
devvit settings set <name>          # Set secret value

# Authentication
devvit login                        # Login to Reddit
devvit whoami                       # Check auth status
```

---

**Last Updated:** 2025-10-30
**Source:** Reddit Devvit Documentation (289KB)
**For:** Reddit AI Automod Project
