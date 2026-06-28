import { Bell, Menu, Search, ChevronDown, LogOut, Check, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { toast } from 'sonner'

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const ref = useRef(null)
  const bellRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: countData } = useQuery({
    queryKey: ['alerts-unread-count'],
    queryFn: () => api.get('/api/alerts/unread-count').then(r => r.data),
    refetchInterval: 30000, // Refetch every 30s
  })

  const { data: alertsData, isLoading: loadingAlerts } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: () => api.get('/api/alerts', { params: { limit: 10 } }).then(r => r.data),
    enabled: bellOpen,
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => api.post(`/api/alerts/${id}/read`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-recent'] })
    }
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.post(`/api/alerts/read-all`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-recent'] })
      toast.success('Đã đánh dấu đọc tất cả thông báo')
    }
  })

  const handleAlertClick = (alert) => {
    if (!alert.read) {
      markReadMutation.mutate(alert._id)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.hoTen
    ? user.hoTen.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'QT'

  const unreadCount = countData?.count || 0
  const alerts = alertsData?.data || []

  return (
    <header className="h-14 flex items-center px-5 gap-3 shrink-0 bg-header relative z-30">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-md text-white/80 hover:bg-white/15 transition-colors lg:hidden shrink-0"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 bg-white/10 min-w-[180px] transition-colors hover:bg-white/15">
        <Search size={13} className="text-white/60 shrink-0" />
        <input
          type="text"
          placeholder="Tìm kiếm..."
          className="bg-transparent text-sm text-white flex-1 placeholder:text-white/45 placeholder:text-sm focus:outline-none"
        />
      </div>

      {/* Bell / Notifications */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setBellOpen(v => !v)}
          className="relative p-2 rounded-md text-white/80 hover:bg-white/15 transition-colors cursor-pointer"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-header">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl py-1 z-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => readAllMutation.mutate()}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Check size={11} /> Đọc tất cả
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingAlerts ? (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-1.5">
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  <span className="text-xs">Đang tải...</span>
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Không có thông báo mới nào</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert._id}
                    onClick={() => handleAlertClick(alert)}
                    className={`px-4 py-2.5 text-left border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors relative flex items-start gap-2 ${!alert.read ? 'bg-slate-50/40' : ''}`}
                  >
                    {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold text-slate-700 truncate ${!alert.read ? 'text-slate-800 font-bold' : ''}`}>
                        {alert.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 break-words line-clamp-2">
                        {alert.body}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {formatDate(alert.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-xs font-semibold text-white">{user?.hoTen || 'Quản trị viên'}</p>
            <p className="text-[10px] text-white/55">{user?.role || 'Admin'}</p>
          </div>
          <ChevronDown size={13} className="text-white/55 hidden sm:block" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground">{user?.hoTen}</p>
              <p className="text-[10px] text-muted-foreground">{user?.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
