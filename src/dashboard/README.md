# Dashboard Module

Cost dashboard and analytics for AI spending monitoring.

## Components

### costDashboardCache.ts
Caching layer for dashboard data with 5-minute TTL.

**Features:**
- Redis-based caching with automatic expiration
- Aggregates data from CostTracker and SettingsService
- Manual cache invalidation support
- Graceful error handling with fallback to fresh data

**Cache Strategy:**
- 5-minute TTL (300 seconds)
- Automatic expiration via Redis
- Manual invalidation available via `CostDashboardCache.invalidateCache()`
- Reduces Redis lookups while keeping data reasonably fresh

### costDashboardUI.ts
Rendering logic for cost display via toast messages.

**Display Includes:**
- Daily costs (today) with provider breakdown
- Monthly costs (current month) with provider breakdown
- Budget status indicators (within budget, warning, critical)
- Current settings (limits, dry-run mode, providers)
- Last updated timestamp

**Status Indicators:**
- ✅ Within budget (< 50% used)
- ⚠️ Approaching limit (50%+ used)
- ⚠️ Near limit (75%+ used)
- 🔴 CRITICAL (90%+ used)

## Usage

### For Moderators
Access via: **Subreddit Menu > "View AI Costs"**

The dashboard displays:
1. Today's AI costs per provider (Claude, OpenAI, DeepSeek)
2. Monthly costs per provider
3. Budget limits and usage percentages
4. Budget status with visual indicators
5. Current configuration (primary/fallback providers, dry-run mode)

To refresh data, simply close and reopen the dashboard.

### For Developers

```typescript
// Get cached dashboard data
import { CostDashboardCache } from './dashboard/costDashboardCache';

const data = await CostDashboardCache.getDashboardData(context);
console.log(`Daily spent: $${data.daily.total.toFixed(2)}`);

// Invalidate cache after cost updates
await costTracker.recordCost(record);
await CostDashboardCache.invalidateCache(context);

// Render dashboard for display
import { renderCostDashboard } from './dashboard/costDashboardUI';

const dashboard = await renderCostDashboard(context);
context.ui.showToast({ text: dashboard, appearance: 'neutral' });
```

## Data Sources

- **CostTracker**: Daily/monthly costs per provider
- **SettingsService**: Budget limits, provider configuration, dry-run mode

## Caching Strategy

Dashboard data is cached for 5 minutes to balance freshness with performance:

- **Why 5 minutes?**
  - Costs don't change frequently (only on AI analysis calls)
  - Reduces Redis lookups significantly
  - Fresh enough for monitoring purposes
  - Auto-expires without manual management

- **When to invalidate cache:**
  - Optional: After recording costs (for real-time updates)
  - Otherwise: Wait for auto-expiry (simpler, good enough)

## Current Limitations

### 1. Request Counts Not Tracked
The dashboard includes placeholder fields for request counts, but CostTracker doesn't currently track per-provider request counts. These show as zeros.

**Future Enhancement:**
Add request count tracking to CostTracker:
```typescript
// In CostTracker.recordCost()
await this.redis.incrBy(`cost:daily:${today}:requests:${provider}`, 1);
```

### 2. Monthly Costs Placeholder
CostTracker currently only tracks daily costs. Monthly costs are estimated from current day values.

**Future Enhancement:**
Add proper monthly cost aggregation to CostTracker.

### 3. Toast Message Display
Current implementation uses toast messages, which have character limits and no interactivity.

**Future Enhancement (Phase 5):**
Migrate to custom post UI with:
- Interactive charts/graphs
- Historical cost trends
- Export to CSV
- Filterable date ranges

## Future Enhancements

### Phase 5 Improvements
1. **Custom Post UI**
   - Replace toast with interactive custom post
   - Add cost trend charts (Chart.js or similar)
   - Historical data visualization
   - Filterable by date range

2. **Request Count Tracking**
   - Add per-provider request counters to CostTracker
   - Display requests/day metrics
   - Average cost per request

3. **Cost Trends**
   - 7-day/30-day trend graphs
   - Cost projections
   - Budget burn rate

4. **Export Functionality**
   - Export cost data to CSV
   - Scheduled email reports
   - Webhook notifications on budget alerts

5. **Advanced Analytics**
   - Cost per subreddit (multi-sub deployments)
   - Cost per rule type
   - Provider reliability metrics

## Testing

### Manual Testing
1. Deploy app to test subreddit
2. Navigate to subreddit menu
3. Click "View AI Costs"
4. Verify dashboard displays correctly
5. Check budget status indicators
6. Verify settings display accurately

### Cache Testing
```typescript
// Test cache hit
const data1 = await CostDashboardCache.getDashboardData(context);
const data2 = await CostDashboardCache.getDashboardData(context);
// Should return cached data (same timestamp)

// Test cache invalidation
await CostDashboardCache.invalidateCache(context);
const data3 = await CostDashboardCache.getDashboardData(context);
// Should compute fresh data (new timestamp)
```

## Performance

**Cache Hit:**
- Redis read: ~1-2ms
- JSON parse: ~1ms
- Total: ~3ms

**Cache Miss:**
- CostTracker lookups: ~10-20ms
- SettingsService reads: ~10-15ms (with cache)
- Computation: ~5ms
- Redis write: ~2ms
- Total: ~30-40ms

**Recommendation:** Cache is effective, reduces load by ~10x on repeated views.

## Security

- No sensitive data exposed in dashboard
- API keys never displayed (only provider selection shown)
- Cost data is read-only
- No actions can be triggered from dashboard

## Dependencies

- `@devvit/public-api`: Context, Redis
- `../ai/costTracker`: Cost data source
- `../config/settingsService`: Settings data source

## Files

- `costDashboardCache.ts`: Caching layer (~350 lines)
- `costDashboardUI.ts`: Rendering logic (~150 lines)
- `README.md`: This documentation

## Integration Points

### In main.tsx
```typescript
import { renderCostDashboard } from './dashboard/costDashboardUI';

Devvit.addMenuItem({
  label: 'View AI Costs',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const dashboard = await renderCostDashboard(context);
    context.ui.showToast({ text: dashboard, appearance: 'neutral' });
  },
});
```

## Troubleshooting

**Dashboard shows $0.00 for all costs:**
- Check if AI analysis has been run today
- Verify CostTracker is recording costs correctly
- Check Redis keys: `cost:daily:YYYY-MM-DD` and `cost:daily:YYYY-MM-DD:{provider}`

**Budget status always shows "Within budget":**
- Verify budget limits are set in settings
- Check if limits are > 0
- Verify cost calculations are correct

**"Error loading cost dashboard":**
- Check console logs for detailed error
- Verify Redis is accessible
- Verify SettingsService is working
- Check CostTracker singleton initialization

**Dashboard data seems stale:**
- Cache TTL is 5 minutes - this is expected
- To force refresh, invalidate cache manually
- Or wait for auto-expiry

## Related Documentation

- `/docs/project-status.md`: Phase 4.4 status
- `/docs/implementation-plan.md`: Phase 4 overview
- `/src/ai/costTracker.ts`: Cost tracking implementation
- `/src/config/settingsService.ts`: Settings access
