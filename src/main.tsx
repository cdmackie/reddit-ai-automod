import { Devvit } from '@devvit/public-api';

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
});

// Add a simple menu action for testing
Devvit.addMenuItem({
  label: 'AI Automod Settings',
  location: 'subreddit',
  onPress: async (_event, context) => {
    context.ui.showToast('Reddit AI Automod - Coming Soon!');
  },
});

// Export the app
export default Devvit;
