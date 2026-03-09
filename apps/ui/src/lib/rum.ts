/**
 * Real User Monitoring (RUM) Service
 * Tracks user interactions, performance metrics, and errors
 */

interface RUMEvent {
  type: 'performance' | 'error' | 'interaction' | 'navigation' | 'frustration';
  name: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  navigationPath?: string[];
}

class RUMService {
  private events: RUMEvent[] = [];
  private batchSize = 10;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private userId?: string;
  private sessionId: string;
  private navigationPath: string[] = [];
  private clickTimestamps: number[] = [];
  private lastClickTime = 0;
  private deadClickThreshold = 500; // ms - click with no response
  private rageClickThreshold = 3; // clicks within 1 second

  constructor() {
    if (typeof window !== 'undefined') {
      // Generate session ID
      this.sessionId = this.generateSessionId();
      this.init();
    } else {
      this.sessionId = '';
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private init() {
    // Set user ID if available
    this.setUserId();

    // Track Web Vitals
    this.trackWebVitals();

    // Track errors
    this.trackErrors();

    // Track page navigation
    this.trackNavigation();

    // Track user interactions
    this.trackInteractions();

    // Start periodic flush
    this.startFlushTimer();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush(true); // Synchronous flush on unload
    });
  }

  setUserId(userId?: string) {
    this.userId = userId;
  }

  private trackWebVitals() {
    // Track Core Web Vitals using Next.js built-in support
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.recordEvent({
            type: 'performance',
            name: 'LCP',
            value: lastEntry.renderTime || lastEntry.loadTime,
            metadata: {
              element: lastEntry.element?.tagName,
            },
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP not supported
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordEvent({
              type: 'performance',
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              metadata: {
                eventType: entry.name,
              },
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // FID not supported
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordEvent({
            type: 'performance',
            name: 'CLS',
            value: clsValue,
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // CLS not supported
      }

      // Time to First Byte (TTFB)
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordEvent({
                type: 'performance',
                name: 'TTFB',
                value: navEntry.responseStart - navEntry.requestStart,
              });
              this.recordEvent({
                type: 'performance',
                name: 'DOMContentLoaded',
                value: navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
              });
              this.recordEvent({
                type: 'performance',
                name: 'Load',
                value: navEntry.loadEventEnd - navEntry.navigationStart,
              });
            }
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        // Navigation timing not supported
      }
    }
  }

  private trackErrors() {
    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      this.recordEvent({
        type: 'error',
        name: 'JavaScript Error',
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.stack,
        },
      });
    });

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.recordEvent({
          type: 'error',
          name: 'Unhandled Promise Rejection',
          metadata: {
            reason: event.reason?.toString(),
            stack: event.reason?.stack,
          },
        });
      });

      // Track slow page loads as frustration
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        if (loadTime > 3000) { // More than 3 seconds
          this.recordEvent({
            type: 'frustration',
            name: 'Slow Page Load',
            value: loadTime,
            metadata: {
              threshold: 3000,
            },
          });
        }
      });
    }

  private trackNavigation() {
    // Track initial page view
    this.navigationPath.push(window.location.pathname);
    this.recordEvent({
      type: 'navigation',
      name: 'Page View',
      metadata: {
        path: window.location.pathname,
        referrer: document.referrer,
        sessionStart: this.navigationPath.length === 1,
      },
    });

    // Track route changes (for Next.js)
    if (typeof window !== 'undefined') {
      let lastPath = window.location.pathname;
      const checkPath = () => {
        if (window.location.pathname !== lastPath) {
          // Add to navigation path
          this.navigationPath.push(window.location.pathname);
          // Keep only last 20 pages to avoid memory issues
          if (this.navigationPath.length > 20) {
            this.navigationPath.shift();
          }

          this.recordEvent({
            type: 'navigation',
            name: 'Route Change',
            metadata: {
              from: lastPath,
              to: window.location.pathname,
              navigationDepth: this.navigationPath.length,
              timeOnPage: Date.now() - (this.lastClickTime || Date.now()),
            },
          });
          lastPath = window.location.pathname;
        }
      };
      // Check periodically (Next.js doesn't expose router events in App Router)
      setInterval(checkPath, 1000);
    }
  }

  private trackInteractions() {
    // Track clicks on important elements with frustration detection
    document.addEventListener('click', (event) => {
      const now = Date.now();
      const target = event.target as HTMLElement;
      const button = target.closest('button, a, [role="button"]');
      
      if (button) {
        // Detect rage clicks (multiple clicks in short time)
        const recentClicks = this.clickTimestamps.filter(ts => now - ts < 1000);
        this.clickTimestamps.push(now);
        this.clickTimestamps = this.clickTimestamps.filter(ts => now - ts < 5000); // Keep last 5 seconds
        
        if (recentClicks.length >= this.rageClickThreshold) {
          this.recordEvent({
            type: 'frustration',
            name: 'Rage Click',
            metadata: {
              element: button.tagName,
              text: button.textContent?.slice(0, 50),
              clicks: recentClicks.length + 1,
              location: `${target.offsetLeft},${target.offsetTop}`,
            },
          });
        }

        // Track click
        this.recordEvent({
          type: 'interaction',
          name: 'Click',
          metadata: {
            element: button.tagName,
            text: button.textContent?.slice(0, 50),
            id: button.id,
            className: button.className,
            location: `${target.offsetLeft},${target.offsetTop}`,
          },
        });

        // Check for dead click (no response after threshold)
        this.lastClickTime = now;
        setTimeout(() => {
          // If no navigation or significant DOM change happened, it's a dead click
          if (Date.now() - this.lastClickTime >= this.deadClickThreshold) {
            // Check if page actually changed or element was removed
            const stillExists = document.contains(button);
            if (stillExists && window.location.pathname === this.navigationPath[this.navigationPath.length - 1]) {
              this.recordEvent({
                type: 'frustration',
                name: 'Dead Click',
                metadata: {
                  element: button.tagName,
                  text: button.textContent?.slice(0, 50),
                  id: button.id,
                  location: `${target.offsetLeft},${target.offsetTop}`,
                },
              });
            }
          }
        }, this.deadClickThreshold);
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.recordEvent({
        type: 'interaction',
        name: 'Form Submit',
        metadata: {
          formId: form.id,
          action: form.action,
        },
      });
    });

    // Track excessive scrolling (frustration indicator)
    let scrollCount = 0;
    let lastScrollTop = window.scrollY;
    let scrollTimer: NodeJS.Timeout;
    
    window.addEventListener('scroll', () => {
      scrollCount++;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const pageHeight = document.documentElement.scrollHeight;
        // Only track if scrolling is excessive (more than 20 scrolls in 2 seconds on a short page)
        if (scrollCount > 20 && pageHeight < window.innerHeight * 3) {
          this.recordEvent({
            type: 'frustration',
            name: 'Excessive Scrolling',
            value: scrollCount,
            metadata: {
              pageHeight,
              viewportHeight: window.innerHeight,
            },
          });
        }
        scrollCount = 0;
      }, 2000); // Check every 2 seconds
    });

    // Track time on page (long time = potential confusion)
    let timeOnPage = 0;
    setInterval(() => {
      timeOnPage += 5; // 5 second intervals
      // If user spends more than 2 minutes on a simple page, might indicate confusion
      if (timeOnPage > 120 && this.navigationPath.length === 1) {
        this.recordEvent({
          type: 'frustration',
          name: 'Long Time on Page',
          value: timeOnPage,
          metadata: {
            page: window.location.pathname,
          },
        });
      }
    }, 5000);
  }

  private recordEvent(event: Omit<RUMEvent, 'timestamp' | 'url' | 'userAgent' | 'sessionId' | 'navigationPath'>) {
    const rumEvent: RUMEvent = {
      ...event,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      navigationPath: [...this.navigationPath], // Copy current navigation path
    };

    this.events.push(rumEvent);

    // Flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(sync = false) {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    const payload = JSON.stringify({ events: eventsToSend });

    if (sync && 'sendBeacon' in navigator) {
      // Use sendBeacon for reliable delivery on page unload
      const blob = new Blob([payload], {
        type: 'application/json',
      });
      const sent = navigator.sendBeacon(`${apiUrl}/rum/events`, blob);
      if (!sent) {
        console.warn('Failed to send RUM events via sendBeacon');
      }
    } else {
      try {
        await fetch(`${apiUrl}/rum/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: true, // Ensures request completes even if page unloads
        });
      } catch (error) {
        console.error('Failed to send RUM events:', error);
        // Re-add events to queue if send failed (except on unload)
        if (!sync) {
          this.events.unshift(...eventsToSend);
        }
      }
    }
  }

  // Public API
  trackCustomEvent(name: string, metadata?: Record<string, any>) {
    this.recordEvent({
      type: 'interaction',
      name,
      metadata,
    });
  }

  trackError(error: Error, context?: Record<string, any>) {
    this.recordEvent({
      type: 'error',
      name: 'Custom Error',
      metadata: {
        message: error.message,
        stack: error.stack,
        ...context,
      },
    });
  }

  trackPerformance(name: string, value: number, metadata?: Record<string, any>) {
    this.recordEvent({
      type: 'performance',
      name,
      value,
      metadata,
    });
  }
}

// Singleton instance
export const rum = typeof window !== 'undefined' ? new RUMService() : null;

// Make rum available on window for lazy access
if (typeof window !== 'undefined') {
    (window as any).__rum = rum;
}
