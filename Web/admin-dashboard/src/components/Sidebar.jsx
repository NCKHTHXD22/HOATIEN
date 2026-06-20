import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Newspaper, FileText,
  MessageSquareWarning, Users, BarChart3, Settings, Shield, LogOut, MapPin,
  Bell, UserRound, ClipboardList, PieChart, MessageCircle
} from 'lucide-react'
import clsx from 'clsx'

const navGroups = [
  {
    label: 'Menu chính',
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' }],
  },
  {
    label: 'Hành chính',
    items: [
      { to: '/ho-so',    icon: FolderOpen, label: 'Hồ sơ hành chính' },
      { to: '/thon-xom', icon: MapPin,     label: 'Thôn / Địa bàn' },
      { to: '/van-ban',  icon: FileText,   label: 'Quản lý văn bản' },
    ],
  },
  {
    label: 'Nội dung',
    items: [{ to: '/tin-tuc', icon: Newspaper, label: 'Tin tức / Thông báo' }],
  },
  {
    label: 'Thông báo',
    items: [
      { to: '/thong-bao',  icon: Bell,          label: 'Soạn & Gửi thông báo' },
      { to: '/zalo-followers', icon: MessageCircle, label: 'Gửi tin Zalo trực tiếp' },
      { to: '/nguoi-nhan', icon: UserRound,      label: 'Người nhận / Nhóm' },
      { to: '/khao-sat',   icon: ClipboardList,  label: 'Khảo sát nhanh' },
      { to: '/bao-cao-tb', icon: PieChart,       label: 'Báo cáo hiệu quả' },
    ],
  },
  {
    label: 'Công dân',
    items: [{ to: '/phan-anh', icon: MessageSquareWarning, label: 'Phản ánh kiến nghị' }],
  },
  {
    label: 'Nhân sự & Báo cáo',
    items: [
      { to: '/nhan-su', icon: Users,     label: 'Cán bộ – Nhân sự' },
      { to: '/bao-cao', icon: BarChart3, label: 'Báo cáo – Thống kê' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [{ to: '/cai-dat', icon: Settings, label: 'Cài đặt' }],
  },
]

export default function Sidebar({ open }) {
  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 w-60 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 bg-sidebar',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[.07]">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 4px 14px rgba(59,130,246,.4)' }}
        >
          <Shield size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">UBND Xã Hòa Tiến</p>
          <p className="text-[11px] text-white/40 truncate">Cổng quản lý nội bộ</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] px-2 mb-1.5 text-white/25">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3.5 border-t border-white/[.07] flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}
        >
          Q
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">Quản trị viên</p>
          <p className="text-[11px] text-white/40 truncate">Lãnh đạo Ủy ban</p>
        </div>
        <button className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[.07] transition-colors shrink-0">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
          : 'text-white/50 hover:bg-white/[.06] hover:text-white/85'
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}
