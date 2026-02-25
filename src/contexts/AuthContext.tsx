'use client'

import { createContext, useContext } from 'react'
import type { AppUserRole } from '@/types'

interface AuthContextValue {
  email: string | null
  role: AppUserRole | null
  displayName: string | null
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue>({
  email: null,
  role: null,
  displayName: null,
  isAdmin: false,
})

export const AuthProvider = AuthContext.Provider
export const useAuth = () => useContext(AuthContext)
