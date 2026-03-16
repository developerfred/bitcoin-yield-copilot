import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GitHub Actions CI Configuration', () => {
  const repoRoot = resolve(__dirname, '../../bitcoin-yield-copilot');

  describe('CI Workflow', () => {
    const ciWorkflowPath = resolve(repoRoot, '.github/workflows/ci.yml');

    it('should have CI workflow file', () => {
      expect(existsSync(ciWorkflowPath)).toBe(true);
    });

    it('should have valid YAML structure', () => {
      const content = readFileSync(ciWorkflowPath, 'utf-8');
      expect(content).toContain('name: CI');
      expect(content).toContain('on:');
      expect(content).toContain('push:');
      expect(content).toContain('pull_request:');
    });

    it('should run tests', () => {
      const content = readFileSync(ciWorkflowPath, 'utf-8');
      expect(content).toContain('npm test');
    });

    it('should run type checking', () => {
      const content = readFileSync(ciWorkflowPath, 'utf-8');
      expect(content).toContain('npx tsc');
    });

    it('should run linting', () => {
      const content = readFileSync(ciWorkflowPath, 'utf-8');
      expect(content).toContain('npm run lint');
    });

    it('should run on multiple Node.js versions', () => {
      const content = readFileSync(ciWorkflowPath, 'utf-8');
      expect(content).toContain('node-version:');
    });
  });

  describe('Dependabot Configuration', () => {
    const dependabotPath = resolve(repoRoot, '.github/dependabot.yml');

    it('should have Dependabot configuration file', () => {
      expect(existsSync(dependabotPath)).toBe(true);
    });

    it('should have valid YAML structure', () => {
      const content = readFileSync(dependabotPath, 'utf-8');
      expect(content).toContain('version: 2');
      expect(content).toContain('updates:');
    });

    it('should configure npm updates', () => {
      const content = readFileSync(dependabotPath, 'utf-8');
      expect(content).toContain('package-ecosystem: npm');
    });
  });
});
