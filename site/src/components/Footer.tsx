export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="py-10 sm:py-12 px-4 sm:px-6 border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-bitcoin)] flex items-center justify-center">
              <span className="text-[var(--color-bg-primary)] font-bold text-sm">₿</span>
            </div>
            <span className="text-[var(--color-text-primary)] font-medium">
              Bitcoin Yield Copilot
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-4 sm:gap-6 text-sm text-[var(--color-text-secondary)]">
            <a 
              href="https://github.com/developerfred/bitcoin-yield-copilot" 
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              GitHub
            </a>
            <a 
              href="https://stacks.co" 
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Stacks
            </a>
            <a 
              href="https://docs.stacks.co" 
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Docs
            </a>
          </div>
          
          <p className="text-sm text-[var(--color-text-muted)]">
            © {currentYear} Bitcoin Yield Copilot
          </p>
        </div>
      </div>
    </footer>
  )
}
