import { createServer, IncomingMessage, ServerResponse } from 'http';
import { 
  getHealthStatus, 
  getReadinessStatus, 
  getMetrics,
  incCounter,
  incGauge,
  observeHistogram 
} from './index.js';

export interface MonitoringServerOptions {
  port?: number;
  host?: string;
}

export function createMonitoringServer(options: MonitoringServerOptions = {}) {
  const port = options.port || 3000;
  const host = options.host || '0.0.0.0';

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '/';

    try {
      if (url === '/health') {
        const status = getHealthStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
      }

      if (url === '/ready') {
        const status = getReadinessStatus();
        const statusCode = status.status === 'ready' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
      }

      if (url === '/metrics') {
        const metricsOutput = getMetrics();
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(metricsOutput);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  return {
    server,
    start: (): Promise<void> => {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          resolve();
        });
      });
    },
    stop: (): Promise<void> => {
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

export { incCounter, incGauge, observeHistogram, getHealthStatus, getReadinessStatus, getMetrics };
