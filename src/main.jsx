import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = createRoot(document.getElementById('root'))

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#CCFF00',
    colorTextOnPrimaryBackground: '#000000',
    colorBackground: '#0a0a0a',
    colorInputBackground: '#111111',
    colorInputText: '#ffffff',
    colorText: '#f5f5f5',
    colorTextSecondary: '#888888',
    borderRadius: '0px',
    fontFamily: 'monospace'
  },
  elements: {
    card: 'border border-[#222] bg-[#0a0a0a] shadow-2xl',
    formButtonPrimary: 'bg-[#CCFF00] text-black font-bold uppercase tracking-wider hover:bg-white transition-colors',
    footerActionLink: 'text-[#CCFF00] hover:text-white',
    userButtonPopoverCard: 'border border-[#2a2a2a] bg-[#0c0c0c] shadow-2xl'
  }
}

if (PUBLISHABLE_KEY && PUBLISHABLE_KEY.trim() && !PUBLISHABLE_KEY.includes('your_clerk_publishable_key')) {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
        <App isClerkConfigured={true} />
      </ClerkProvider>
    </StrictMode>
  )
} else {
  root.render(
    <StrictMode>
      <App isClerkConfigured={false} />
    </StrictMode>
  )
}
