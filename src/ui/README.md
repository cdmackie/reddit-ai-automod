# UI Components

This directory contains UI-related helper functions for displaying information to users and moderators.

## Post Analysis (`postAnalysis.ts`)

Provides functionality to display AI analysis results for individual posts.

### Usage

The "View AI Analysis" menu item appears on posts when:
- User is a moderator of the subreddit
- Viewing the post detail page (not just the feed)
- App is installed and running

### How to Access

1. Navigate to a post in your subreddit
2. Click the three-dot menu (⋯) on the post
3. Select **"View AI Analysis"**
4. View the analysis in a toast notification

### What's Displayed

- Action taken (APPROVE, FLAG, REMOVE, COMMENT)
- Dry-run status
- User who posted
- Trust score (0-100)
- Matched rule (or "Default" if no match)
- AI confidence (if applicable)
- AI cost for analysis
- Execution time
- Reason for action
- Timestamp

### Troubleshooting

**Menu item doesn't appear:**
- **KNOWN LIMITATION**: Post menu items don't work during `devvit playtest` mode
  - They only appear after production upload with `devvit upload`
  - This is a Devvit platform limitation, not a bug in our code
- Ensure you're a moderator of the subreddit
- Make sure you're on the post detail page, not the subreddit feed
- Verify the app is installed and running

**"No analysis available":**
- Post hasn't been processed yet (wait a few seconds after posting)
- Audit logging might be disabled
- Check logs: `devvit logs r/SUBREDDIT`

**Error loading analysis:**
- Check Redis connection
- Verify audit logs are being written (check PostSubmit handler)
- Check console/logs for error messages

### Development

To test locally during playtest:
```bash
devvit playtest r/YOUR_TEST_SUBREDDIT
```

Then visit:
```
https://www.reddit.com/r/YOUR_TEST_SUBREDDIT/comments/POST_ID/?playtest=ai-automod-app
```
