export default function CTA() {
  return (
    <section className="section-base px-4 sm:px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--color-bg-secondary)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--color-bitcoin)]/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative container-wide text-center">
        {/* Heading */}
        <h2 
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal text-[var(--color-text-primary)] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Ready to yield?
        </h2>
        <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] mb-10 sm:mb-12 max-w-xl mx-auto px-4 sm:px-0">
          Join the whitelist to get early access. Star us on GitHub to show support.
        </p>
        
        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSe8EgYLVw7i8Y2z-iHCP5lTqK6z1jK1jK1jK1jK1jK1jK1/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-[var(--color-bitcoin)] text-[var(--color-bg-primary)] font-medium rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-[var(--color-bitcoin)]/30 text-center w-full sm:w-auto"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Join Whitelist
            </span>
            <div className="absolute inset-0 bg-[var(--color-bitcoin-dark)] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </a>
          
          <a
            href="https://github.com/developerfred/bitcoin-yield-copilot"
            target="_blank"
            rel="noopener noreferrer"
            className="group px-6 sm:px-8 py-3 sm:py-4 border border-[var(--color-border-light)] text-[var(--color-text-primary)] font-medium rounded-lg hover:border-[var(--color-text-secondary)] transition-all duration-300 flex items-center justify-center gap-2 hover:bg-[var(--color-bg-tertiary)] w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Star on GitHub</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-muted)]">
              ★
            </span>
          </a>
        </div>
        
        {/* Trust indicators */}
        <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-sbtc)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Open Source</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-sbtc)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Non-custodial</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-sbtc)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Built on Stacks</span>
          </div>
        </div>
      </div>
    </section>
  )
}
