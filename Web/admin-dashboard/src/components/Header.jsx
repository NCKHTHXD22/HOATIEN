import { Bell, Menu, Search, ChevronDown } from 'lucide-react'

export default function Header({ onMenuClick }) {
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

      {/* User */}
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 transition-colors">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center text-xs font-bold text-primary shrink-0">
          Q
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-xs font-semibold text-white">Quản trị viên</p>
          <p className="text-[10px] text-white/55">Quản trị viên</p>
        </div>
        <ChevronDown size={13} className="text-white/55 hidden sm:block" />
      </button>
    </header>
  )
}
