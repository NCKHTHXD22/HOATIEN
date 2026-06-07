import { Bell, Menu, Search, ChevronDown, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.hoTen
    ? user.hoTen.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'QT'

  return (
    <header className="h-14 flex items-center px-5 gap-3 shrink-0 bg-header">
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
          className="bg-transparent text-sm text-white flex-1 placeholder:text-white/45 placeholder:text-sm"
        />
      </div>

      {/* Bell */}
      <button className="relative p-2 rounded-md text-white/80 hover:bg-white/15 transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 transition-colors"
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
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
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
