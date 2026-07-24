import { createContext, useContext } from 'react'

const LayoutContext = createContext({ openMenu: () => {} })

export function LayoutProvider({ children, openMenu }) {
  return <LayoutContext.Provider value={{ openMenu }}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  return useContext(LayoutContext)
}
