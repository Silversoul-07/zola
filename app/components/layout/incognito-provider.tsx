"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type IncognitoContextType = {
  incognito: boolean
  setIncognito: (value: boolean) => void
}

const IncognitoContext = createContext<IncognitoContextType | undefined>(
  undefined
)

// Private-mode toggle lives above the header/chat split so both can read it:
// the header renders the toggle button, the chat page reads it to skip persistence.
export function IncognitoProvider({ children }: { children: ReactNode }) {
  const [incognito, setIncognito] = useState(false)
  return (
    <IncognitoContext.Provider value={{ incognito, setIncognito }}>
      {children}
    </IncognitoContext.Provider>
  )
}

export function useIncognito() {
  const context = useContext(IncognitoContext)
  if (!context) {
    throw new Error("useIncognito must be used within IncognitoProvider")
  }
  return context
}
