export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database?: boolean;
    external_services?: boolean;
  };
}

interface CounterMetric {
  value: number;
  labels: Record<string, string>;
}

interface GaugeMetric {
  value: number;
  labels: Record<string, string>;
}

interface HistogramMetric {
  values: number[];
  labels: Record<string, string>;
}

class MetricsCollector {
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private histograms: Map<string, HistogramMetric> = new Map();
  private startTime = Date.now();

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  getCounters(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, metric] of this.counters) {
      result[key] = metric.value;
    }
    return result;
  }

  getGauges(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, metric] of this.gauges) {
      result[key] = metric.value;
    }
    return result;
  }

  getHistograms(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const [key, metric] of this.histograms) {
      result[key] = metric.values;
    }
    return result;
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.getKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { value, labels });
    }
  }

  incrementGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.getKey(name, labels);
    const existing = this.gauges.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.gauges.set(key, { value, labels });
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(name, labels);
    const existing = this.histograms.get(key);
    if (existing) {
      existing.values.push(value);
    } else {
      this.histograms.set(key, { values: [value], labels });
    }
  }

  private getKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private getBaseName(key: string): string {
    return key.split('{')[0];
  }

  toPrometheus(): string {
    const lines: string[] = [];
    const baseNames = new Set<string>();

    for (const [key, metric] of this.counters) {
      const baseName = this.getBaseName(key);
      if (!baseNames.has(baseName)) {
        lines.push(`# TYPE ${baseName} counter`);
        baseNames.add(baseName);
      }
      lines.push(`${key} ${metric.value}`);
    }

    for (const [key, metric] of this.gauges) {
      const baseName = this.getBaseName(key);
      if (!baseNames.has(baseName)) {
        lines.push(`# TYPE ${baseName} gauge`);
        baseNames.add(baseName);
      }
      lines.push(`${key} ${metric.value}`);
    }

    for (const [key, metric] of this.histograms) {
      const baseName = this.getBaseName(key);
      if (!baseNames.has(baseName)) {
        lines.push(`# TYPE ${baseName} histogram`);
        baseNames.add(baseName);
      }
      for (const value of metric.values) {
        lines.push(`${key} ${value}`);
      }
    }

    return lines.join('\n');
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

export const metrics = new MetricsCollector();

export function incCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
  metrics.incrementCounter(name, labels, value);
}

export function incGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
  metrics.incrementGauge(name, labels, value);
}

export function observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
  metrics.observeHistogram(name, value, labels);
}

export function getMetrics(): string {
  return metrics.toPrometheus();
}

export function getHealthStatus(): HealthStatus {
  const memUsage = process.memoryUsage();
  return {
    status: 'healthy',
    uptime: metrics.getUptime(),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    },
  };
}

export function getReadinessStatus(): ReadinessStatus {
  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {},
  };
}
