import { useRef } from 'react'

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null)
  
  return (
    <section 
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden section-base"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[var(--color-bg-primary)]">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-bitcoin)]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-stacks)]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(var(--color-text-primary) 1px, transparent 1px),
              linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 container-wide text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mb-8 opacity-0 animate-[fadeIn_0.6s_ease-out_forwards]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-sbtc)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Powered by Claude + Stacks
          </span>
        </div>
        
        {/* Main Heading */}
        <h1 
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-normal mb-6 sm:mb-8 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-[var(--color-text-primary)]">Your Bitcoin.</span>
          <br className="sm:hidden" />
          <span className="text-[var(--color-bitcoin)]"> Working Harder.</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-[var(--color-text-secondary)] max-w-xl sm:max-w-2xl mx-auto mb-10 sm:mb-12 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.4s_forwards]">
          Autonomous agent that manages your Bitcoin yield on Stacks. 
          Natural language. Maximum returns. Zero friction.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.6s_forwards]">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSe8EgYLVw7i8Y2z-iHCP5lTqK6z1jK1jK1jK1jK1jK1jK1/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative btn-primary w-full sm:w-auto"
          >
            <span className="relative z-10">Join Whitelist</span>
            <div className="absolute inset-0 bg-[var(--color-bitcoin-dark)] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </a>
          
          <a
            href="https://github.com/developerfred/bitcoin-yield-copilot"
            target="_blank"
            rel="noopener noreferrer"
            className="group btn-secondary w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Star on GitHub</span>
          </a>
        </div>
        
        {/* Stats */}
        <div className="mt-16 sm:mt-20 grid grid-cols-3 gap-4 sm:gap-8 max-w-xl mx-auto opacity-0 animate-[fadeInUp_0.8s_ease-out_0.8s_forwards]">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl font-normal text-[var(--color-bitcoin)]" style={{ fontFamily: 'var(--font-display)' }}>
              $545M+
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">
              Stacks TVL
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl font-normal text-[var(--color-stacks)]" style={{ fontFamily: 'var(--font-display)' }}>
              4
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">
              Protocols
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl font-normal text-[var(--color-sbtc)]" style={{ fontFamily: 'var(--font-display)' }}>
              12%
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">
              Max APY
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 animate-[fadeIn_1s_ease-out_1s_forwards]">
        <div className="w-6 h-10 rounded-full border-2 border-[var(--color-border-light)] flex justify-center pt-2">
          <div className="w-1 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" />
        </div>
      </div>
      
    </section>
  )
}
