import '../styles/dashboard.css'
import {
  FolderOpen, Clock, CheckCircle, MessageSquareWarning,
  ArrowUpRight, RotateCcw, Newspaper, FileText, BarChart3, TrendingUp,
} from 'lucide-react'
import { StatCard } from '../components/ui'

const kpis = [
  { label: 'Hồ sơ hôm nay',       value: '0', icon: FolderOpen,           iconColor: '#2563eb' },
  { label: 'Chờ xử lý',           value: '0', icon: Clock,                iconColor: '#d97706' },
  { label: 'Hoàn thành đúng hạn', value: '0', icon: CheckCircle,          iconColor: '#16a34a' },
  { label: 'Phản ánh chưa xử lý', value: '0', icon: MessageSquareWarning, iconColor: '#dc2626' },
]

const quickActions = [
  { label: 'Tiếp nhận hồ sơ',  to: '/ho-so',    icon: FolderOpen,           color: '#2563eb' },
  { label: 'Tạo tin tức',       to: '/tin-tuc',  icon: Newspaper,            color: '#16a34a' },
  { label: 'Thêm văn bản',      to: '/van-ban',  icon: FileText,             color: '#7c3aed' },
  { label: 'Phản ánh công dân', to: '/phan-anh', icon: MessageSquareWarning, color: '#d97706' },
  { label: 'Xem báo cáo',       to: '/bao-cao',  icon: BarChart3,            color: '#0891b2' },
]

export default function Dashboard() {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'buổi sáng' : hour < 18 ? 'buổi chiều' : 'buổi tối'

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">
          Chào {greeting}, Admin!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Thống kê &amp; theo dõi hoạt động — UBND Xã Hòa Tiến
        </p>
      </div>

      {/* ── Hero card ── */}
      <div className="relative rounded-lg overflow-hidden p-7 shadow-xl shadow-primary/20 bg-hero-card">
        {/* Decorative circles */}
        <div className="absolute w-56 h-56 rounded-full bg-white/[.07] -top-10 right-32 pointer-events-none" />
        <div className="absolute w-80 h-80 rounded-full bg-white/[.04] -top-24 right-0 pointer-events-none" />
        <div className="absolute w-32 h-32 rounded-full bg-white/[.05] bottom-0 left-1/3 translate-y-1/2 pointer-events-none" />

        <div className="relative z-10">
          {/* Top row: label + inline status chips */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <p className="text-sm font-medium text-blue-200">Tổng hồ sơ &amp; phản ánh</p>
            <div className="flex items-center gap-5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Clock size={11} /> Chờ xử lý: 0
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <RotateCcw size={11} /> Đang xử lý: 0
              </span>
              <span className="flex items-center gap-1.5 text-sky-200">
                <CheckCircle size={11} /> Hoàn thành: 0
              </span>
            </div>
          </div>

          {/* Big number */}
          <p className="text-7xl font-black text-white leading-none tracking-tight">0</p>
          <p className="text-xs text-blue-300/80 mt-4">Từ công dân UBND Xã Hòa Tiến</p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* ── Chart + Recent items ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart area */}
        <div className="lg:col-span-2 bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-foreground">Hồ sơ 7 ngày qua</p>
              <p className="text-xs text-muted-foreground mt-0.5">Thống kê số lượng theo ngày</p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Tiếp nhận
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Hoàn thành
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center h-48 rounded-md bg-secondary border border-dashed border-border">
            <TrendingUp size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu biểu đồ</p>
          </div>
        </div>

        {/* Recent items */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-bold text-foreground">Hồ sơ mới nhất</p>
            <a href="/ho-so"
              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors">
              Xem tất cả <ArrowUpRight size={11} />
            </a>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-5 text-center">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
              <FolderOpen size={22} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Chưa có hồ sơ nào</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Hồ sơ mới sẽ xuất hiện ở đây</p>
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
        <p className="text-sm font-bold text-foreground mb-4">Thao tác nhanh</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(item => (
            <a key={item.label} href={item.to}
              className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-md border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 text-center group cursor-pointer">
              <div className="w-10 h-10 rounded-md flex items-center justify-center"
                style={{ backgroundColor: item.color + '18' }}>
                <item.icon size={18} style={{ color: item.color }} />
              </div>
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
