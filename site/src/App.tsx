import Hero from './sections/Hero'
import HowItWorks from './sections/HowItWorks'
import Features from './sections/Features'
import Protocols from './sections/Protocols'
import Roadmap from './sections/Roadmap'
import CTA from './sections/CTA'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Hero />
      <HowItWorks />
      <Features />
      <Protocols />
      <Roadmap />
      <CTA />
      <Footer />
    </div>
  )
}

export default App
