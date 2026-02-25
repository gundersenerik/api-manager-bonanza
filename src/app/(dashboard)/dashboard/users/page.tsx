'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users,
  UserPlus,
  Shield,
  User,
  MoreVertical,
  AlertCircle,
  Check,
  X,
  Trash2,
} from 'lucide-react'
import { AppUser, AppUserRole } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'

export default function UsersPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppUserRole>('user')
  const [inviting, setInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard')
      return
    }
    fetchUsers()
  }, [isAdmin, router])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.data || [])
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch users')
      }
    } catch {
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteEmail('')
        setInviteRole('user')
        setShowInviteForm(false)
        fetchUsers()
      } else {
        setError(data.error || 'Failed to invite user')
      }
    } catch {
      setError('Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: AppUserRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
      } else {
        setError(data.error || 'Failed to update user')
      }
    } catch {
      setError('Failed to update user')
    }
    setActionMenuId(null)
  }

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
      } else {
        setError(data.error || 'Failed to deactivate user')
      }
    } catch {
      setError('Failed to deactivate user')
    }
    setActionMenuId(null)
  }

  const handleReactivate = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
      } else {
        setError(data.error || 'Failed to reactivate user')
      }
    } catch {
      setError('Failed to reactivate user')
    }
    setActionMenuId(null)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  if (loading) {
    return <LoadingScreen message="Loading users..." />
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Invite and manage team members"
        actions={
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        }
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-400/60 hover:text-rose-400">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6"
        >
          <Card>
            <form onSubmit={handleInvite} className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@schibsted.com"
                  className="w-full px-3 py-2 bg-ink-800/50 border border-ink-600/30 rounded-lg text-ink-200 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric/30"
                  required
                />
              </div>
              <div className="w-36">
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as AppUserRole)}
                  className="w-full px-3 py-2 bg-ink-800/50 border border-ink-600/30 rounded-lg text-ink-200 focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric/30"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Inviting...' : 'Send Invite'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowInviteForm(false)}
              >
                Cancel
              </Button>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Active Users */}
      <div className="mb-8">
        <h2 className="text-lg font-heading font-semibold text-ink-200 mb-4">
          Active Users ({activeUsers.length})
        </h2>
        {activeUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users yet"
            description="Invite your team members to get started"
          />
        ) : (
          <div className="space-y-2">
            {activeUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="!p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-ink-700 rounded-full flex items-center justify-center ring-2 ring-ink-600/30">
                      {user.role === 'admin' ? (
                        <Shield className="w-5 h-5 text-electric-400" />
                      ) : (
                        <User className="w-5 h-5 text-ink-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-200 truncate">
                          {user.display_name || user.email}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-electric/10 text-electric-400 ring-1 ring-electric/20'
                            : 'bg-ink-700/50 text-ink-400 ring-1 ring-ink-600/30'
                        }`}>
                          {user.role}
                        </span>
                        {!user.auth_user_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                            pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {user.email}
                        {user.display_name && user.display_name !== user.email && ` · ${user.email}`}
                      </p>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-ink-500">Last login</p>
                      <p className="text-xs text-ink-400">{formatDate(user.last_login_at)}</p>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === user.id ? null : user.id)}
                        className="p-2 text-ink-500 hover:text-ink-300 hover:bg-ink-700/40 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {actionMenuId === user.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-0 top-full mt-1 w-48 bg-ink-800 border border-ink-600/30 rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          {user.role === 'user' ? (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'admin')}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-ink-300 hover:bg-ink-700/50 transition-colors"
                            >
                              <Shield className="w-4 h-4" />
                              Promote to Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'user')}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-ink-300 hover:bg-ink-700/50 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              Demote to User
                            </button>
                          )}
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Deactivate
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-semibold text-ink-500 mb-4">
            Inactive Users ({inactiveUsers.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {inactiveUsers.map((user) => (
              <Card key={user.id} className="!p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-ink-800 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-ink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-ink-400 truncate">{user.email}</span>
                    <p className="text-xs text-ink-600 mt-0.5">Deactivated</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactivate(user.id)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Reactivate
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenuId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActionMenuId(null)}
        />
      )}
    </div>
  )
}
