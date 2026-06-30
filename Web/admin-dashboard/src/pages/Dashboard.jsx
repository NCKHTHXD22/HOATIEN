import '../styles/dashboard.css'
import { useEffect, useState } from 'react'
import {
  Users, Home, MapPin, ArrowUpDown,
  ArrowUpRight, TrendingUp, RefreshCw, ArrowUp,
  ArrowRightLeft, Send, ClipboardList, BarChart3,
  ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import * as reportService from '../services/reportService'

const QUICK_ACTIONS = [
  { to: '/ho-so',     label: 'Thêm hộ dân',       icon: Home,          color: '#2563eb', light: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { to: '/bien-dong',  label: 'Ghi nhận biến động', icon: ArrowRightLeft, color: '#ea580c', light: 'linear-gradient(135deg,#ffedd5,#fed7aa)' },
  { to: '/thon-xom',   label: 'Thêm thôn',          icon: MapPin,        color: '#7c3aed', light: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
  { to: '/thong-bao',  label: 'Gửi tin Zalo',       icon: Send,          color: '#0891b2', light: 'linear-gradient(135deg,#cffafe,#a5f3fc)' },
  { to: '/khao-sat',   label: 'Khảo sát nhanh',     icon: ClipboardList, color: '#d97706', light: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
  { to: '/bao-cao',    label: 'Báo cáo thống kê',   icon: BarChart3,     color: '#16a34a', light: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' },
]

/* ── Count-up animation hook ───────────────────────────────────────────── */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const end = Number(target)
    if (!Number.isFinite(end)) { setVal(0); return }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(eased * end))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

/* ── KPI card ──────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, color, light, foot, footIcon: FootIcon, loading, signed }) {
  const n = useCountUp(loading ? 0 : value, 1300)
  const display = loading ? '—' : `${signed && value > 0 ? '+' : ''}${n.toLocaleString('vi-VN')}`
  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-sm card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p>
          <p className="text-[2.4rem] font-black mt-2 leading-none" style={{ color }}>{display}</p>
        </div>
        <div
          className="shrink-0 rounded-2xl flex items-center justify-center"
          style={{ width: 52, height: 52, background: light, boxShadow: `inset 0 0 0 1px ${color}22` }}
        >
          <Icon size={24} style={{ color }} />
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: foot.color }}>
        {FootIcon ? <FootIcon size={14} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
        {foot.text}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [movStats, setMovStats] = useState(null)
  const [villageStats, setVillageStats] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sumRes, movRes, vilRes] = await Promise.all([
        reportService.getSummary(),
        reportService.getMovements(),
        reportService.getByVillage(),
      ])
      setSummary(sumRes.data.data)
      setMovStats(movRes.data.data)
      setVillageStats(vilRes.data.data || [])
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const households = Number(summary?.households) || 0
  const members    = Number(summary?.members)    || 0
  const villages   = Number(summary?.villages)   || 0
  const net        = Number(movStats?.net)        || 0
  const density    = households > 0 ? (members / households) : 0
  const heroCount  = useCountUp(loading ? 0 : members, 1500)

  const chartData = villageStats.map(v => ({
    name: v.villageName,
    'Hộ dân': v.totalHouseholds,
    'Nhân khẩu': v.totalMembers,
  }))

  const typeTotals = villageStats.reduce((acc, v) => ({
    THUONG_TRU: acc.THUONG_TRU + (v.byType?.THUONG_TRU || 0),
    TAM_TRU:    acc.TAM_TRU    + (v.byType?.TAM_TRU    || 0),
    TAM_VANG:   acc.TAM_VANG   + (v.byType?.TAM_VANG   || 0),
  }), { THUONG_TRU: 0, TAM_TRU: 0, TAM_VANG: 0 })

  const typeData = [
    { name: 'Thường trú', value: typeTotals.THUONG_TRU, color: '#2563eb' },
    { name: 'Tạm trú',    value: typeTotals.TAM_TRU,    color: '#d97706' },
    { name: 'Tạm vắng',   value: typeTotals.TAM_VANG,   color: '#9333ea' },
  ].filter(d => d.value > 0)

  const moveIn  = Number(movStats?.moveIn)  || 0
  const moveOut = Number(movStats?.moveOut) || 0
  const movementData = [
    { name: 'Chuyển đến', value: moveIn,  color: '#16a34a' },
    { name: 'Chuyển đi',  value: moveOut, color: '#dc2626' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Heading ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.7rem] font-extrabold text-foreground tracking-tight">
            Hệ thống Quản lý thông tin chủ hộ- Xã Hòa Tiến
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <MapPin size={14} /> UBND Xã Hòa Tiến
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 rounded-xl border border-border bg-card text-primary hover:shadow-md hover:shadow-primary/15 transition-all disabled:opacity-50"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="relative rounded-3xl overflow-hidden px-9 py-8 shadow-xl shadow-slate-200/70 bg-white border border-slate-100">
        <div className="absolute -top-24 right-16 w-80 h-80 rounded-full pointer-events-none animate-[heroGlow_9s_ease-in-out_infinite]"
             style={{ background: 'radial-gradient(circle,rgba(96,165,250,.32),transparent 65%)' }} />
        <div className="absolute -bottom-28 -right-10 w-72 h-72 rounded-full pointer-events-none animate-[heroGlow2_11s_ease-in-out_infinite]"
             style={{ background: 'radial-gradient(circle,rgba(217,70,239,.22),transparent 68%)' }} />
        <div className="absolute -top-16 left-1/3 w-64 h-64 rounded-full pointer-events-none animate-[heroGlow_13s_ease-in-out_infinite]"
             style={{ background: 'radial-gradient(circle,rgba(251,191,36,.2),transparent 70%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-60"
             style={{ backgroundImage: 'radial-gradient(rgba(37,99,235,.07) 1px,transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 flex items-end justify-between flex-wrap gap-7">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[13px] font-semibold text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
              Tổng dân số đang quản lý
            </span>
            <div className="flex items-baseline gap-3.5 mt-3.5">
              <span
                className="text-[5.5rem] font-black leading-[.85] tracking-tight"
                style={{ background: 'linear-gradient(135deg,#2563eb,#9333ea,#ec4899)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
              >
                {loading ? '…' : heroCount.toLocaleString('vi-VN')}
              </span>
              <span className="text-lg font-semibold text-slate-500">nhân khẩu</span>
            </div>
            <p className="text-sm text-slate-400 mt-3">Cập nhật mới nhất — UBND Xã Hòa Tiến</p>
          </div>

          <div className="flex gap-3.5 flex-wrap">
            {[
              { icon: Home,  label: 'Hộ dân',    val: households, color: '#2563eb', light: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
              { icon: Users, label: 'Nhân khẩu', val: members,    color: '#059669', light: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
              { icon: MapPin, label: 'Thôn',     val: villages,   color: '#9333ea', light: 'linear-gradient(135deg,#f3e8ff,#e9d5ff)' },
            ].map(s => (
              <div key={s.label} className="px-5 py-4 rounded-2xl border border-slate-100 min-w-[120px]" style={{ background: s.light }}>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: s.color }}>
                  <s.icon size={14} /> {s.label}
                </div>
                <div className="text-2xl font-black mt-1.5" style={{ color: s.color }}>{loading ? '…' : s.val.toLocaleString('vi-VN')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Thao tác nhanh ── */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <p className="text-sm font-bold text-foreground mb-4">Thao tác nhanh</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(qa => (
            <a key={qa.to} href={qa.to} className="quick-action group">
              <div className="quick-action-icon" style={{ background: qa.light }}>
                <qa.icon size={18} style={{ color: qa.color }} />
              </div>
              <span className="quick-action-label">{qa.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Hộ dân hoạt động" value={households} loading={loading}
          icon={Home} color="#1d4ed8" light="linear-gradient(135deg,#dbeafe,#bfdbfe)"
          foot={{ text: 'Đang quản lý ổn định', color: '#16a34a' }} footIcon={ArrowUp} />
        <KpiCard label="Tổng nhân khẩu" value={members} loading={loading}
          icon={Users} color="#0891b2" light="linear-gradient(135deg,#cffafe,#a5f3fc)"
          foot={{ text: `${density.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} nhân khẩu / hộ`, color: '#64748b' }} />
        <KpiCard label="Số thôn quản lý" value={villages} loading={loading}
          icon={MapPin} color="#7c3aed" light="linear-gradient(135deg,#ede9fe,#ddd6fe)"
          foot={{ text: villageStats[0]?.villageName || 'Toàn xã', color: '#64748b' }} />
        <KpiCard label="Biến động (net)" value={net} loading={loading} signed
          icon={ArrowUpDown} color="#ea580c" light="linear-gradient(135deg,#ffedd5,#fed7aa)"
          foot={{ text: net >= 0 ? 'Tăng trong kỳ' : 'Giảm trong kỳ', color: '#ea580c' }} footIcon={ArrowUp} />
      </div>

      {/* ── Chart + Village list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-base font-bold text-foreground">Thống kê theo thôn</p>
              <p className="text-xs text-muted-foreground mt-0.5">Số hộ dân và nhân khẩu từng thôn</p>
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="w-3 h-3 rounded-[3px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }} /> Hộ dân
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="w-3 h-3 rounded-[3px]" style={{ background: 'linear-gradient(135deg,#22d3ee,#0891b2)' }} /> Nhân khẩu
              </span>
            </div>
          </div>
          {loading || chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 rounded-xl bg-secondary border border-dashed border-border">
              <TrendingUp size={28} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{loading ? 'Đang tải...' : 'Chưa có dữ liệu thôn'}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={chartData} barGap={10} barCategoryGap="32%" margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gHo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="gNk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 600, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))', boxShadow: '0 8px 24px rgba(21,61,150,.14)' }} />
                <Bar dataKey="Hộ dân" fill="url(#gHo)" radius={[8, 8, 0, 0]} maxBarSize={56} />
                <Bar dataKey="Nhân khẩu" fill="url(#gNk)" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Village list */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <p className="text-base font-bold text-foreground">Thống kê thôn</p>
            <a href="/ho-so" className="text-xs font-semibold text-primary hover:opacity-80 flex items-center gap-1 transition-opacity">
              Xem hộ dân <ArrowUpRight size={13} />
            </a>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-10 text-sm text-muted-foreground">Đang tải...</div>
          ) : villageStats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-5 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
                <MapPin size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Chưa có dữ liệu thôn</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 gap-3">
              <div className="space-y-2.5 overflow-auto">
                {villageStats.map((v, i) => (
                  <a key={v.villageId} href="/ho-so"
                    className="block rounded-2xl p-4 border border-border transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15 hover:border-primary/30"
                    style={i === 0 ? { background: 'linear-gradient(135deg,#f7faff,#eef4ff)' } : undefined}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/30"
                           style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-foreground truncate">{v.villageName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.totalMembers} nhân khẩu</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-primary leading-none">{v.totalHouseholds}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground">hộ</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto pt-1">
                <div className="rounded-xl border border-border p-3.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Mật độ TB</p>
                  <p className="text-xl font-black mt-1" style={{ color: '#0891b2' }}>
                    {density.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">nhân khẩu/hộ</p>
                </div>
                <div className="rounded-xl border border-border p-3.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Tỷ lệ phủ</p>
                  <p className="text-xl font-black mt-1 text-emerald-600">100%</p>
                  <p className="text-[11px] text-muted-foreground/70">đã cập nhật</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Hộ dân theo loại + Biến động dân cư ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Hộ dân theo loại cư trú */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <p className="text-base font-bold text-foreground">Hộ dân theo loại cư trú</p>
          <p className="text-xs text-muted-foreground mt-0.5">Phân loại thường trú / tạm trú / tạm vắng</p>
          {loading || typeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 rounded-xl bg-secondary border border-dashed border-border mt-4">
              <Home size={28} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{loading ? 'Đang tải...' : 'Chưa có dữ liệu'}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 mt-2">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {typeData.map(d => <Cell key={d.name} fill={d.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {typeData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
                    </span>
                    <span className="text-sm font-black" style={{ color: d.color }}>{d.value.toLocaleString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Biến động dân cư: chuyển đến / chuyển đi */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <p className="text-base font-bold text-foreground">Biến động dân cư</p>
          <p className="text-xs text-muted-foreground mt-0.5">Số lượt chuyển đến / chuyển đi</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl p-4 border border-emerald-100" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <ArrowDownToLine size={14} /> Chuyển đến
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1.5">{loading ? '…' : moveIn.toLocaleString('vi-VN')}</p>
            </div>
            <div className="rounded-xl p-4 border border-red-100" style={{ background: 'linear-gradient(135deg,#fef2f2,#fee2e2)' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <ArrowUpFromLine size={14} /> Chuyển đi
              </div>
              <p className="text-2xl font-black text-red-700 mt-1.5">{loading ? '…' : moveOut.toLocaleString('vi-VN')}</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground mt-3">Đang tải...</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={movementData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={28}>
                  {movementData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  )
}
