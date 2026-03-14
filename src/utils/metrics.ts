/**
 * Metrics collected during engine execution
 */
export interface EngineMetrics {
  // Timing metrics
  totalDurationMs: number;
  loadDurationMs: number;
  executeDurationMs: number;

  // Count metrics
  filesProcessed: number;
  functionsExecuted: number;
  functionsEnabled: number;
  findingsCount: number;

  // Breakdown by severity
  findingsBySeverity: Record<string, number>;

  // Cache metrics
  cacheHits: number;
  cacheMisses: number;

  // Error metrics
  errorsCount: number;
  blockedCount: number;
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  /**
   * Record the start of an operation
   */
  startTimer(operation: string): () => void;

  /**
   * Increment a counter
   */
  increment(counter: string, value?: number): void;

  /**
   * Set a gauge value
   */
  gauge(gauge: string, value: number): void;

  /**
   * Record a histogram value
   */
  histogram(histogram: string, value: number): void;

  /**
   * Get all collected metrics
   */
  getMetrics(): EngineMetrics;

  /**
   * Reset all metrics
   */
  reset(): void;
}

/**
 * Default in-memory metrics collector
 */
export class DefaultMetricsCollector implements MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  startTimer(operation: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.histogram(`${operation}DurationMs`, duration);
    };
  }

  increment(counter: string, value: number = 1): void {
    const current = this.counters.get(counter) || 0;
    this.counters.set(counter, current + value);
  }

  gauge(gauge: string, value: number): void {
    this.gauges.set(gauge, value);
  }

  histogram(histogram: string, value: number): void {
    const values = this.histograms.get(histogram) || [];
    // Bounded histogram - keep only last 1000 values (sliding window)
    const MAX_HISTOGRAM_SIZE = 1000;
    if (values.length >= MAX_HISTOGRAM_SIZE) {
      // Remove oldest 10% when full
      values.splice(0, Math.floor(MAX_HISTOGRAM_SIZE * 0.1));
    }
    values.push(value);
    this.histograms.set(histogram, values);
  }

  getMetrics(): EngineMetrics {
    const getCount = (key: string) => this.counters.get(key) || 0;

    return {
      totalDurationMs: this.timers.get('total') || 0,
      loadDurationMs: this.timers.get('load') || 0,
      executeDurationMs: this.timers.get('execute') || 0,
      filesProcessed: getCount('filesProcessed'),
      functionsExecuted: getCount('functionsExecuted'),
      functionsEnabled: getCount('functionsEnabled'),
      findingsCount: getCount('findings'),
      findingsBySeverity: {
        critical: getCount('findings.critical'),
        high: getCount('findings.high'),
        medium: getCount('findings.medium'),
        low: getCount('findings.low'),
        info: getCount('findings.info')
      },
      cacheHits: getCount('cacheHits'),
      cacheMisses: getCount('cacheMisses'),
      errorsCount: getCount('errors'),
      blockedCount: getCount('blocked')
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }

  // Internal method to set timer values
  _setTimer(name: string, value: number): void {
    this.timers.set(name, value);
  }
}

/**
 * No-op metrics collector for when metrics are not needed
 */
export class NoOpMetricsCollector implements MetricsCollector {
  startTimer(): () => void {
    return () => { };
  }
  increment(): void { }
  gauge(): void { }
  histogram(): void { }
  getMetrics(): EngineMetrics {
    return {
      totalDurationMs: 0,
      loadDurationMs: 0,
      executeDurationMs: 0,
      filesProcessed: 0,
      functionsExecuted: 0,
      functionsEnabled: 0,
      findingsCount: 0,
      findingsBySeverity: {},
      cacheHits: 0,
      cacheMisses: 0,
      errorsCount: 0,
      blockedCount: 0
    };
  }
  reset(): void { }
}
