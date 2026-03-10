# qa-audit

> Comprehensive Quality Assurance and Project Auditing for TypeScript/Node.js Projects

## Overview

This skill provides systematic approaches for auditing TypeScript/Node.js projects, with emphasis on Telegram bots, blockchain integrations, and AI agents. It covers code quality, testing coverage, security vulnerabilities, performance issues, and architectural concerns.

## Audit Framework

### 4-Layer Audit Approach

```
┌─────────────────────────────────────────────────────────┐
│        STRATEGIC LAYER                                  │
│   Architecture, Business Logic, Risk Assessment        │
├─────────────────────────────────────────────────────────┤
│         TACTICAL LAYER                                 │
│   Code Quality, Testing Strategy, Documentation        │
├─────────────────────────────────────────────────────────┤
│         OPERATIONAL LAYER                              │
│   Performance, Security, Error Handling, Monitoring    │
├─────────────────────────────────────────────────────────┤
│         EXECUTION LAYER                                │
│   Dependencies, Build Process, Deployment, CI/CD       │
└─────────────────────────────────────────────────────────┘
```

## Strategic Layer Audit

### Architecture Review

**Checklist:**
- [ ] **Modularity**: Are components properly separated? (Bot, AI, Blockchain, DB)
- [ ] **Dependency Direction**: Do dependencies flow in one direction?
- [ ] **Abstraction Levels**: Appropriate abstraction for different concerns?
- [ ] **Scalability**: Can the system handle growth in users/transactions?
- [ ] **Maintainability**: Is the codebase easy to understand and modify?

**Common Issues:**
- **God Objects**: Single files/classes doing too much
- **Circular Dependencies**: Import cycles between modules
- **Tight Coupling**: Components too dependent on specific implementations
- **Missing Interfaces**: Concrete dependencies instead of abstractions

### Business Logic Validation

**Checklist:**
- [ ] **Core Flows**: Deposit, Withdraw, Portfolio viewing work correctly
- [ ] **Error Recovery**: System recovers from failures gracefully
- [ ] **Data Consistency**: Transactions maintain data integrity
- [ ] **User Experience**: Bot responses are clear and helpful
- [ ] **Compliance**: Follows Telegram Bot API rules and blockchain standards

## Tactical Layer Audit

### Code Quality Analysis

**Static Analysis Tools:**
```bash
# ESLint for code style
npm run lint

# TypeScript type checking
npm run type-check

# Code complexity analysis
npx @typescript-eslint/parser --ext .ts,.tsx src/ --rule complexity

# Dependency analysis
npm ls --depth=10
```

**Code Quality Metrics:**
- **Cyclomatic Complexity**: Keep under 10 per function
- **Cognitive Complexity**: Keep under 15 per function
- **Lines of Code**: Max 50-100 per function
- **Nesting Depth**: Max 3-4 levels
- **Code Duplication**: Under 5% duplication

### Testing Strategy Audit

**Test Coverage Analysis:**
```bash
# Generate coverage report
npm test -- --coverage

# Check coverage thresholds
# - Statements: ≥ 80%
# - Branches: ≥ 70%
# - Functions: ≥ 80%
# - Lines: ≥ 80%
```

**Test Quality Checklist:**
- [ ] **Unit Tests**: All business logic functions tested
- [ ] **Integration Tests**: Cross-component interactions tested
- [ ] **Edge Cases**: Boundary conditions and error scenarios tested
- [ ] **Mock Quality**: Mocks accurately simulate real dependencies
- [ ] **Test Data**: Test data is realistic and comprehensive
- [ ] **Test Isolation**: Tests don't depend on each other

### Documentation Review

**Checklist:**
- [ ] **README**: Complete project overview and setup instructions
- [ ] **API Documentation**: Clear documentation for all endpoints
- [ ] **Architecture Docs**: System design and component relationships
- [ ] **Deployment Guide**: Step-by-step deployment instructions
- [ ] **Testing Guide**: How to run and write tests
- [ ] **Code Comments**: Critical logic explained in comments

## Operational Layer Audit

### Security Audit

**Authentication & Authorization:**
- [ ] **Telegram Auth**: Proper user authentication via Telegram
- [ ] **Session Management**: Secure session handling
- [ ] **API Keys**: Secrets properly stored (not in code)
- [ ] **Input Validation**: All user inputs validated
- [ ] **Rate Limiting**: Protection against abuse

**Data Security:**
- [ ] **Sensitive Data**: Encryption for sensitive user data
- [ ] **Database Security**: SQL injection protection
- [ ] **Logging**: No sensitive data in logs
- [ ] **Error Messages**: Generic error messages in production

**Blockchain Security:**
- [ ] **Transaction Signing**: Secure signing process
- [ ] **Contract Calls**: Proper gas estimation and validation
- [ ] **Wallet Security**: Private key management
- [ ] **Smart Contract Security**: Contract audits completed

### Performance Audit

**Bot Performance:**
```typescript
// Performance metrics to monitor
const performanceMetrics = {
  commandResponseTime: '< 2s',      // Time from command to bot response
  aiProcessingTime: '< 5s',        // AI response time
  transactionConfirmation: '< 30s', // Blockchain confirmation
  databaseQueryTime: '< 100ms',     // DB query latency
  mcpToolCallTime: '< 1s'          // MCP server response
};
```

**Bottleneck Analysis:**
- **Database Queries**: Indexes missing, N+1 queries
- **External API Calls**: Sequential instead of parallel
- **Memory Leaks**: Unclosed connections, event listeners
- **CPU Usage**: Expensive computations in hot paths

**Load Testing:**
```bash
# Simulate multiple users
npx artillery quick --count 20 --num 100 http://localhost:3000

# Test concurrent bot commands
# Expected: Response times stay consistent under load
```

### Error Handling Audit

**Checklist:**
- [ ] **Graceful Degradation**: System degrades gracefully when components fail
- [ ] **Error Recovery**: Automatic recovery from transient failures
- [ ] **Error Logging**: Comprehensive error logging with context
- [ ] **User-Friendly Messages**: Clear error messages for users
- [ ] **Monitoring**: Error rate monitoring and alerts

**Error Categories to Handle:**
1. **Network Errors**: API timeouts, connection failures
2. **External Service Errors**: MCP server, blockchain RPC failures
3. **Data Errors**: Invalid inputs, missing data
4. **System Errors**: Memory, disk, process failures

## Execution Layer Audit

### Dependency Analysis

**Security Vulnerabilities:**
```bash
# Check for known vulnerabilities
npm audit

# Check for outdated dependencies
npm outdated

# Analyze dependency licenses
npx license-checker --summary
```

**Dependency Health Metrics:**
- **Update Frequency**: Regular dependency updates
- **Vulnerability Count**: Zero critical vulnerabilities
- **License Compliance**: All licenses compatible with project
- **Bundle Size**: Reasonable node_modules size

### Build Process Audit

**Checklist:**
- [ ] **Build Scripts**: Clear, working build commands
- [ ] **Type Checking**: TypeScript compilation without errors
- [ ] **Linting**: Code style rules enforced
- [ ] **Minification**: Production builds optimized
- [ ] **Source Maps**: Available for debugging

**Build Performance:**
- **Build Time**: Under 2 minutes for full build
- **Incremental Builds**: Fast rebuilds during development
- **Cache Utilization**: Proper caching for faster builds

### Deployment Audit

**Checklist:**
- [ ] **Environment Configuration**: Separate configs for dev/test/prod
- [ ] **Secrets Management**: Secure secret handling in production
- [ ] **Deployment Scripts**: Automated, reproducible deployments
- [ ] **Rollback Capability**: Ability to rollback deployments
- [ ] **Monitoring**: Logs, metrics, and alerts in production

**Deployment Metrics:**
- **Deployment Time**: Under 5 minutes
- **Downtime**: Zero downtime deployments
- **Success Rate**: > 99% deployment success rate

### CI/CD Pipeline Audit

**Checklist:**
- [ ] **Automated Testing**: Tests run on every commit
- [ ] **Quality Gates**: Code quality checks block merges
- [ ] **Security Scanning**: Vulnerability scanning in pipeline
- [ ] **Build Artifacts**: Reproducible build artifacts
- [ ] **Deployment Automation**: Automated deployments to staging/prod

## Project-Specific Audit Checklists

### Telegram Bot Audit

**Telegram API Compliance:**
- [ ] **Rate Limits**: Respect Telegram API rate limits
- [ ] **User Privacy**: Handle user data according to Telegram rules
- [ ] **Message Formatting**: Proper use of Markdown/HTML formatting
- [ ] **Inline Keyboards**: Proper callback data handling
- [ ] **Webhook Setup**: Correct webhook configuration if used

**Bot User Experience:**
- [ ] **Response Time**: Under 2 seconds for commands
- [ ] **Error Messages**: Clear, actionable error messages
- [ ] **Command Help**: Comprehensive /help command
- [ ] **State Management**: Proper handling of user state
- [ ] **Session Timeout**: Reasonable session expiration

### Blockchain Integration Audit

**Stacks Blockchain:**
- [ ] **Network Configuration**: Correct network (mainnet/testnet)
- [ ] **Transaction Building**: Proper transaction construction
- [ ] **Gas Estimation**: Accurate gas estimation
- [ ] **Error Handling**: Handle blockchain errors gracefully
- [ ] **Confirmations**: Wait for sufficient confirmations

**Smart Contract Interactions:**
- [ ] **Contract Calls**: Correct function calls with parameters
- [ ] **Event Listening**: Proper handling of contract events
- [ ] **State Updates**: Consistent state with blockchain
- [ ] **Fee Management**: Appropriate fee strategies

### AI Agent Integration Audit

**Claude API Integration:**
- [ ] **API Usage**: Efficient use of API tokens
- [ ] **Prompt Engineering**: Well-structured prompts
- [ ] **Tool Calling**: Proper tool execution flow
- [ ] **Context Management**: Appropriate context window usage
- [ ] **Error Handling**: Handle AI API failures

**Agent Reasoning:**
- [ ] **Decision Logic**: Clear reasoning for decisions
- [ ] **Risk Assessment**: Appropriate risk evaluation
- [ ] **User Preferences**: Respect user settings and history
- [ ] **Transparency**: Clear explanation of actions

## Audit Execution Workflow

### Phase 1: Discovery (1-2 hours)
1. Review project structure and documentation
2. Identify key components and dependencies
3. Map data flows and integration points
4. Establish audit scope and priorities

### Phase 2: Automated Analysis (1 hour)
1. Run static analysis tools
2. Execute test suites
3. Generate coverage reports
4. Scan for vulnerabilities

### Phase 3: Manual Review (2-3 hours)
1. Code review of critical paths
2. Test case review
3. Configuration review
4. Documentation review

### Phase 4: Testing (1-2 hours)
1. Manual testing of core flows
2. Edge case testing
3. Performance testing
4. Security testing

### Phase 5: Reporting (1 hour)
1. Compile findings
2. Prioritize issues
3. Create remediation plan
4. Generate audit report

## Audit Report Template

```markdown
# Project Audit Report

## Executive Summary
- Overall assessment
- Critical findings
- Recommended actions

## Strategic Findings
- Architecture issues
- Business logic gaps
- Risk assessment

## Tactical Findings
- Code quality issues
- Testing gaps
- Documentation deficiencies

## Operational Findings
- Security vulnerabilities
- Performance bottlenecks
- Error handling gaps

## Execution Findings
- Dependency issues
- Build/deployment problems
- CI/CD pipeline gaps

## Recommendations
- Immediate actions (Critical)
- Short-term improvements (High)
- Medium-term enhancements (Medium)
- Long-term optimizations (Low)

## Metrics Summary
- Test coverage: X%
- Vulnerability count: Y
- Performance benchmarks: Z
- Code quality scores: A

## Appendices
- Detailed issue logs
- Test results
- Tool output
- Supporting evidence
```

## Tools for Automated Auditing

### Code Quality
- **ESLint**: Code style and best practices
- **Prettier**: Code formatting
- **TypeScript Compiler**: Type checking
- **SonarQube**: Comprehensive code analysis

### Security
- **npm audit**: Dependency vulnerabilities
- **Snyk**: Security scanning
- **OWASP ZAP**: Web application security
- **TruffleHog**: Secret detection

### Testing
- **Vitest/Jest**: Test execution
- **Istanbul/NYC**: Code coverage
- **Artillery**: Load testing
- **Postman/Newman**: API testing

### Performance
- **Node Clinic**: Performance profiling
- **Autocannon**: HTTP load testing
- **Chrome DevTools**: Web performance
- **Datadog/New Relic**: Application monitoring

## Remediation Strategies

### Critical Issues (Fix Immediately)
- Security vulnerabilities
- Data loss risks
- System crashes
- Legal/compliance violations

### High Priority Issues (Fix in Next Sprint)
- Performance bottlenecks
- Major functionality gaps
- Poor user experience
- High error rates

### Medium Priority Issues (Plan for Future)
- Code quality improvements
- Test coverage gaps
- Technical debt reduction
- Documentation updates

### Low Priority Issues (Consider for Roadmap)
- Nice-to-have features
- Performance optimizations
- Code refactoring
- Developer experience improvements

## Continuous Audit Integration

### Pre-commit Hooks
```bash
# .husky/pre-commit
npm run lint
npm run type-check
npm test -- --run
```

### CI Pipeline Checks
```yaml
# .github/workflows/audit.yml
name: Continuous Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      - run: npm run build
```

### Regular Audit Schedule
- **Daily**: Automated security scans
- **Weekly**: Test coverage review
- **Monthly**: Performance benchmarking
- **Quarterly**: Full architecture review
- **Annually**: Comprehensive security audit

## Best Practices for Maintainable Codebases

1. **Write Tests First**: TDD for critical functionality
2. **Code Reviews**: Peer review for all changes
3. **Document Decisions**: ADRs for architectural decisions
4. **Monitor Metrics**: Track code quality over time
5. **Regular Refactoring**: Address technical debt regularly
6. **Automate Everything**: CI/CD, testing, deployment
7. **Security First**: Security considerations in every decision
8. **User-Centric**: Focus on user experience and value