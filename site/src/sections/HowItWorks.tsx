const steps = [
  {
    number: '01',
    title: 'Connect',
    description: 'Link your Stacks wallet via secure deep-link. No seed phrase exposure — we never touch your keys.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    number: '02',
    title: 'Choose',
    description: 'Tell us your risk profile and preferred assets. We scan Zest, ALEX, Hermetica & Bitflow in real-time.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    number: '03',
    title: 'Earn',
    description: 'Confirm the transaction. We execute the deposit, monitor your positions, and optimize automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  }
]

export default function HowItWorks() {
  return (
    <section className="section-base px-4 sm:px-6 bg-[var(--color-bg-secondary)]">
      <div className="container-wide">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] mb-4">
            How It Works
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Three steps to yield
          </h2>
        </div>
        
        {/* Steps */}
        <div className="grid-responsive gap-6 md:gap-8">
          {steps.map((step, index) => (
            <div 
              key={step.number}
              className="relative group"
            >
              {/* Card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] h-full transition-all duration-500 group-hover:border-[var(--color-bitcoin)]/50 group-hover:shadow-2xl group-hover:shadow-[var(--color-bitcoin)]/5">
                {/* Number */}
                <div className="flex items-center justify-between mb-6">
                  <span 
                    className="text-4xl sm:text-5xl md:text-6xl font-normal text-[var(--color-border)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {step.number}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-bitcoin)]">
                    {step.icon}
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-3">
                  {step.title}
                </h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </div>
              
              {/* Arrow connector (except last) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Example Conversation */}
        <div className="mt-16 sm:mt-20 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                Natural Language
              </h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                No complex DeFi interfaces. Just tell the agent what you want.
              </p>
            </div>
            <div className="md:w-2/3 space-y-4">
              <div className="flex gap-2 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-stacks)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white">You</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm">
                  "Coloca meu sBTC para render"
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bitcoin)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-[var(--color-bg-primary)]">Agent</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm">
                  "Encontrei 3 opções: Zest (8.2% APY), Hermetica (6.1%), ALEX LP (11.4% com risco maior). Qual prefere?"
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
