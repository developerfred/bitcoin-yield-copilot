const milestones = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    weeks: 'Week 1-2',
    items: [
      'Project setup & CI/CD',
      'Telegram bot with /start & onboarding',
      'Claude API integration',
      'MCP server connection (testnet)'
    ]
  },
  {
    phase: 'Phase 2',
    title: 'Core Yield',
    weeks: 'Week 3-4',
    items: [
      'Real-time APY fetching',
      'Deposit execution via MCP',
      'Transaction confirmations',
      'Portfolio overview'
    ]
  },
  {
    phase: 'Phase 3',
    title: 'Memory & Strategy',
    weeks: 'Week 5-6',
    items: [
      'SQLite preference storage',
      'Risk profile logic',
      'APY alert system',
      'Action history with reasoning'
    ]
  },
  {
    phase: 'Phase 4',
    title: 'Identity & Payments',
    weeks: 'Week 7-8',
    items: [
      'ERC-8004 integration',
      'x402 data feed consumption',
      'Mainnet migration',
      'Beta testing (5-10 users)'
    ]
  },
  {
    phase: 'Phase 5',
    title: 'Launch',
    weeks: 'Week 9-10',
    items: [
      'UX refinement',
      'Full documentation',
      'Production deployment',
      'Onboard 20+ users'
    ]
  }
]

export default function Roadmap() {
  return (
    <section className="section-base px-4 sm:px-6">
      <div className="container-wide">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] mb-4">
            Roadmap
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Building in public
          </h2>
          <p className="mt-3 sm:mt-4 text-[var(--color-text-secondary)] max-w-xl mx-auto px-4 sm:px-0">
            10-week development plan to launch.
          </p>
        </div>
        
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 sm:left-4 md:left-1/2 top-0 bottom-0 w-px bg-[var(--color-border)] transform md:-translate-x-1/2" />
          
          {/* Milestones */}
          <div className="space-y-12">
            {milestones.map((milestone, index) => (
              <div 
                key={milestone.phase}
                className={`relative flex items-center ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Dot */}
                <div className="absolute left-3 sm:left-4 md:left-1/2 w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[var(--color-bitcoin)] transform -translate-x-1/2 z-10" />
                
                {/* Content */}
                <div className={`ml-10 sm:ml-12 md:ml-0 md:w-1/2 ${
                  index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12 md:text-left'
                }`}>
                  <div className="p-4 sm:p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 rounded-full bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)]">
                        {milestone.phase}
                      </span>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {milestone.weeks}
                      </span>
                    </div>
                    <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-3">
                      {milestone.title}
                    </h3>
                    <ul className="space-y-2">
                      {milestone.items.map((item) => (
                        <li key={item} className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                          {index % 2 === 0 ? (
                            <>
                              <span className="hidden md:inline text-[var(--color-bitcoin)]">✓</span>
                              {item}
                            </>
                          ) : (
                            <>
                              {item}
                              <span className="hidden md:inline text-[var(--color-bitcoin)]">✓</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Success Metrics */}
        <div className="mt-20 p-8 rounded-2xl bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
          <h3 className="text-xl font-medium text-[var(--color-text-primary)] text-center mb-8">
            Success Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-normal text-[var(--color-bitcoin)]" style={{ fontFamily: 'var(--font-display)' }}>
                20+
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">
                Users
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-normal text-[var(--color-stacks)]" style={{ fontFamily: 'var(--font-display)' }}>
                50+
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">
                Transactions
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-normal text-[var(--color-sbtc)]" style={{ fontFamily: 'var(--font-display)' }}>
                $1K
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">
                TVL Managed
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-normal text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                95%
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">
                Uptime
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
