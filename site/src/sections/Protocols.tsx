const protocols = [
  {
    name: 'Zest',
    apy: '8.2%',
    description: 'Liquid staking with EigenLayer restaking',
    color: '#F7931A',
    status: 'integrated'
  },
  {
    name: 'ALEX',
    apy: '11.4%',
    description: 'DeFi platform with leveraged yields',
    color: '#6F5EE0',
    status: 'integrated'
  },
  {
    name: 'Hermetica',
    apy: '6.1%',
    description: 'Institutional-grade vault strategies',
    color: '#50D5CA',
    status: 'integrated'
  },
  {
    name: 'Bitflow',
    apy: '9.8%',
    description: 'Bitcoin-native AMM and liquidity',
    color: '#FF6B6B',
    status: 'integrated'
  }
]

export default function Protocols() {
  return (
    <section className="section-base px-4 sm:px-6 bg-[var(--color-bg-secondary)]">
      <div className="container-wide">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] mb-4">
            Supported Protocols
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Built on Stacks
          </h2>
          <p className="mt-3 sm:mt-4 text-[var(--color-text-secondary)] max-w-xl mx-auto px-4 sm:px-0">
            Access the best Bitcoin yield opportunities through integrated DeFi protocols.
          </p>
        </div>
        
        {/* Protocols Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {protocols.map((protocol) => (
            <div 
              key={protocol.name}
              className="group relative p-5 sm:p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-all duration-300 overflow-hidden"
            >
              {/* Hover effect */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
                style={{ backgroundColor: protocol.color }}
              />
              
              <div className="relative">
                {/* Logo placeholder */}
                <div 
                  className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-2xl font-bold"
                  style={{ 
                    backgroundColor: `${protocol.color}20`,
                    color: protocol.color 
                  }}
                >
                  {protocol.name[0]}
                </div>
                
                {/* Name & APY */}
                <div className="flex items-end justify-between mb-2">
                  <h3 className="text-xl font-medium text-[var(--color-text-primary)]">
                    {protocol.name}
                  </h3>
                  <span 
                    className="text-2xl font-normal"
                    style={{ 
                      color: protocol.color,
                      fontFamily: 'var(--font-display)' 
                    }}
                  >
                    {protocol.apy}
                  </span>
                </div>
                
                {/* Description */}
                <p className="text-sm text-[var(--color-text-muted)]">
                  {protocol.description}
                </p>
                
                {/* Status badge */}
                <div className="mt-4 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-sbtc)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {protocol.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Note */}
        <p className="mt-12 text-center text-sm text-[var(--color-text-muted)]">
          APYs shown are indicative and subject to change. Always verify current rates before depositing.
        </p>
      </div>
    </section>
  )
}
