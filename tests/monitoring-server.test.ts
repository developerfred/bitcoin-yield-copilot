import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMonitoringServer } from '../src/monitoring/server.js';
import { metrics } from '../src/monitoring/index.js';

describe('Monitoring HTTP Server', () => {
  let server: ReturnType<typeof createMonitoringServer>;
  let baseUrl: string;

  beforeEach(async () => {
    metrics.reset();
    server = createMonitoringServer({ port: 3456 });
    await server.start();
    baseUrl = 'http://localhost:3456';
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.memory).toBeDefined();
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const res = await fetch(`${baseUrl}/ready`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ready');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics format', async () => {
      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(res.headers.get('content-type')).toContain('text/plain');
    });
  });

  describe('404', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/unknown`);
      expect(res.status).toBe(404);
    });
  });
});
