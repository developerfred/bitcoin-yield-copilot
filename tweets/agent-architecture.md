# Tweet: Agent Architecture

Bitcoin Yield Copilot architecture breakdown:

Layer 1: Telegram interface - Users interact in natural language
Layer 2: Claude Sonnet 4 - Reasoning and intent detection  
Layer 3: MCP Server - 120+ Stacks tools for onchain operations
Layer 4: Clarity Contracts - Secure wallet management

The agent understands "Put my sBTC to work" and:
1. Queries real-time APYs from Zest, ALEX, Hermetica
2. Presents options with risk assessment
3. Executes deposit on user approval
4. Confirms transaction onchain

No wallets to manage, no contracts to understand - just tell the bot what you want.
