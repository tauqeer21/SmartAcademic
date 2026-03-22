import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [theme,   setTheme]   = useState(() => localStorage.getItem('sas_theme') || 'light')
  // currentClass lives HERE so every component gets the same reactive value
  const [currentClass, setCurrentClassState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sas_class')) } catch { return null }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sas_theme', theme)
  }, [theme])

  useEffect(() => {
    try {
      const s = localStorage.getItem('sas_user')
      if (s) setUser(JSON.parse(s))
    } catch {}
    setIsReady(true)
  }, [])

  const login = useCallback((u, token) => {
    localStorage.setItem('sas_token', token)
    localStorage.setItem('sas_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sas_token')
    localStorage.removeItem('sas_user')
    localStorage.removeItem('sas_class')
    setUser(null)
    setCurrentClassState(null)
  }, [])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])

  const setCurrentClass = useCallback((cls) => {
    if (cls) {
      localStorage.setItem('sas_class', JSON.stringify(cls))
    } else {
      localStorage.removeItem('sas_class')
    }
    setCurrentClassState(cls)
  }, [])

  return (
    <Ctx.Provider value={{ user, isReady, theme, login, logout, toggleTheme, currentClass, setCurrentClass }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)

// Now useCurrentClass reads from context — globally reactive
export function useCurrentClass() {
  const { currentClass, setCurrentClass } = useContext(Ctx)
  return [currentClass, setCurrentClass]
}