import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  metrics, 
  incCounter, 
  incGauge, 
  observeHistogram,
  getMetrics,
  HealthStatus,
  getHealthStatus,
  ReadinessStatus,
  getReadinessStatus 
} from '../src/monitoring/index.js';

describe('Monitoring', () => {
  describe('Metrics', () => {
    beforeEach(() => {
      metrics.reset();
    });

    it('should initialize with zero counters', () => {
      expect(metrics.getCounters()).toEqual({});
    });

    it('should increment a counter', () => {
      incCounter('test_counter', { label: 'value' });
      const counters = metrics.getCounters();
      const keys = Object.keys(counters);
      expect(keys.some(k => k.startsWith('test_counter'))).toBe(true);
    });

    it('should increment counter by specific value', () => {
      incCounter('test_counter', { label: 'value' }, 5);
      const counters = metrics.getCounters();
      const testCounter = Object.values(counters).find((_, i) => {
        const key = Object.keys(counters)[i];
        return key.startsWith('test_counter');
      });
      expect(testCounter).toBe(5);
    });

    it('should increment a gauge', () => {
      incGauge('test_gauge', { label: 'value' });
      const gauges = metrics.getGauges();
      const keys = Object.keys(gauges);
      expect(keys.some(k => k.startsWith('test_gauge'))).toBe(true);
    });

    it('should observe histogram values', () => {
      observeHistogram('test_histogram', 0.5, { label: 'value' });
      const histograms = metrics.getHistograms();
      const keys = Object.keys(histograms);
      expect(keys.some(k => k.startsWith('test_histogram'))).toBe(true);
    });

    it('should export Prometheus format', () => {
      incCounter('prometheus_test', { type: 'counter' });
      const output = getMetrics();
      expect(output).toContain('prometheus_test');
      expect(output).toContain('# TYPE prometheus_test counter');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status by default', () => {
      const status = getHealthStatus();
      expect(status.status).toBe('healthy');
    });

    it('should include uptime in health status', () => {
      const status = getHealthStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });

    it('should include memory usage in health status', () => {
      const status = getHealthStatus();
      expect(status.memory).toBeDefined();
      expect(status.memory.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('Readiness Check', () => {
    it('should return ready when system is ready', () => {
      const status = getReadinessStatus();
      expect(status.status).toBe('ready');
    });

    it('should include checks in readiness status', () => {
      const status = getReadinessStatus();
      expect(status.checks).toBeDefined();
    });
  });
});
