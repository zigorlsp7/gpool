# Real User Monitoring (RUM) Integration Guide

## What is RUM?

**Real User Monitoring (RUM)** is a performance monitoring technique that tracks actual user interactions with your web application in real-time. Unlike synthetic monitoring (which uses automated tests), RUM captures data from real users' browsers.

### What RUM Tracks:

1. **Performance Metrics:**
   - Page Load Time (PLT)
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)
   - Cumulative Layout Shift (CLS)
   - First Input Delay (FID)
   - Time to First Byte (TTFB)

2. **User Interactions:**
   - Clicks, scrolls, form submissions
   - Navigation patterns
   - User flows and journeys

3. **Errors:**
   - JavaScript errors
   - Network failures
   - API errors
   - Unhandled promise rejections

4. **Network Performance:**
   - API call durations
   - Request/response sizes
   - Failed requests
   - Slow endpoints

5. **User Context:**
   - Browser/device information
   - Geographic location
   - Session information
   - User ID (if authenticated)

## Why Use RUM?

- **Real-world insights**: See how actual users experience your app
- **Performance optimization**: Identify slow pages and bottlenecks
- **Error tracking**: Catch and fix errors before users report them
- **User experience**: Understand user behavior and optimize flows
- **Business metrics**: Track conversion rates, drop-off points, etc.

## Implementation

A custom RUM solution has been implemented that integrates with your existing observability stack.

### Architecture

1. **Frontend (`apps/web/src/lib/rum.ts`)**: 
   - Tracks Web Vitals (LCP, FID, CLS, TTFB)
   - Monitors JavaScript errors
   - Tracks user interactions (clicks, form submissions)
   - Tracks page navigation
   - Tracks API performance automatically
   - Batches events and sends to backend

2. **Backend (`services/pool-service/src/rum/`)**: 
   - Receives RUM events via `/api/rum/events` endpoint
   - Converts events to Prometheus metrics
   - Exposes metrics via existing `/api/metrics` endpoint

3. **Observability Stack**:
   - Prometheus scrapes RUM metrics from pool-service
   - Grafana visualizes RUM data alongside backend metrics

### Metrics Exposed

- `rum_performance_seconds` - Performance metrics (LCP, FID, CLS, TTFB, etc.)
- `rum_errors_total` - Error counts by type and page
- `rum_interactions_total` - User interaction counts
- `rum_navigations_total` - Page navigation counts
- `rum_frustrations_total` - **Frustration metrics** (rage clicks, dead clicks, slow loads, etc.)
- `rum_navigation_path_length` - **User journey tracking** (navigation path length per session)

### Viewing RUM Data

1. **In Prometheus**: Query metrics like:
   - `rum_performance_seconds{metric_name="LCP"}`
   - `rum_errors_total`
   - `rum_interactions_total{interaction_type="Click"}`

2. **In Grafana**: Create dashboards with queries like:
   - Average LCP: `avg(rum_performance_seconds{metric_name="LCP"})`
   - Error rate: `rate(rum_errors_total[5m])`
   - Top pages by interactions: `topk(10, sum by (page) (rum_interactions_total))`
   - **Frustration rate**: `rate(rum_frustrations_total[5m])`
   - **Rage clicks**: `sum(rum_frustrations_total{frustration_type="rage_click"})`
   - **Dead clicks**: `sum(rum_frustrations_total{frustration_type="dead_click"})`
   - **User navigation paths**: `rum_navigation_path_length` (shows journey depth)
   - **Navigation flow**: Query `rum_navigations_total` with `navigation_type` and `page` labels

### Custom Events

You can track custom events from your components:

```typescript
import { rum } from '@/lib/rum';

// Track custom event
rum?.trackCustomEvent('Pool Created', { poolId: '123', poolName: 'My Pool' });

// Track error
rum?.trackError(new Error('Something went wrong'), { context: 'pool-creation' });

// Track performance
rum?.trackPerformance('Custom Metric', 1234, { customLabel: 'value' });
```

### Configuration

RUM is automatically initialized when the app loads. User ID is automatically set when a user logs in.

The service batches events and sends them every 30 seconds or when 10 events are collected, whichever comes first.

### User Navigation Tracking

**Yes!** You can see how users navigate through your web app:

1. **Navigation Path**: Each event includes a `navigationPath` array showing the sequence of pages visited
2. **Session Tracking**: Each session has a unique `sessionId` that groups all events
3. **Navigation Depth**: Tracked in metadata to see how deep users go
4. **Time on Page**: Tracked between navigations

**Query in Prometheus/Grafana:**
- Navigation paths: Look at `navigationPath` in event metadata
- Session journeys: Filter by `sessionId` to see complete user flows
- Popular paths: Aggregate navigation sequences

### Frustration Metrics

**Yes!** The following frustration indicators are tracked:

1. **Rage Clicks**: 3+ clicks on the same element within 1 second
2. **Dead Clicks**: Clicks that don't trigger any response (no navigation, no DOM change)
3. **Slow Page Loads**: Pages taking >3 seconds to load
4. **Long Time on Page**: Users spending >2 minutes on a single page (potential confusion)
5. **Excessive Scrolling**: Many scrolls on short pages (potential confusion)
6. **Form Abandonment**: Forms started but not submitted (tracked via `trackFormAbandonment()`)

**Query frustration metrics:**
```promql
# Total frustrations
sum(rum_frustrations_total)

# By type
sum by (frustration_type) (rum_frustrations_total)

# By page
sum by (page, frustration_type) (rum_frustrations_total)
```

### Endpoints

- **POST `/api/rum/events`** - Receives batched RUM events from frontend
- **GET `/api/metrics`** - Exposes Prometheus metrics including RUM data
