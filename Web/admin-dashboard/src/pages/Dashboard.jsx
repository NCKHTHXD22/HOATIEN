import '../styles/dashboard.css'
import { useEffect, useState } from 'react'
import {
  Users, Home, MapPin, ArrowUpDown,
  ArrowUpRight, TrendingUp, RefreshCw, ArrowUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import * as reportService from '../services/reportService'

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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Heading ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.7rem] font-extrabold text-foreground tracking-tight">
            Tổng quan hệ thống quản lý dân số
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
      <div className="relative rounded-3xl overflow-hidden px-9 py-8 shadow-2xl shadow-primary/30 bg-hero-card">
        <div className="absolute -top-24 right-16 w-80 h-80 rounded-full pointer-events-none animate-[heroGlow_9s_ease-in-out_infinite]"
             style={{ background: 'radial-gradient(circle,rgba(125,211,252,.5),transparent 65%)' }} />
        <div className="absolute -bottom-28 -right-16 w-72 h-72 rounded-full pointer-events-none animate-[heroGlow2_11s_ease-in-out_infinite]"
             style={{ background: 'radial-gradient(circle,rgba(96,165,250,.45),transparent 68%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-50"
             style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.09) 1px,transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 flex items-end justify-between flex-wrap gap-7">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[13px] font-semibold text-white">
              <span className="w-2 h-2 rounded-full bg-sky-300 ring-4 ring-sky-300/30" />
              Tổng dân số đang quản lý
            </span>
            <div className="flex items-baseline gap-3.5 mt-3.5">
              <span className="text-[5.5rem] font-black text-white leading-[.85] tracking-tight"
                    style={{ textShadow: '0 8px 30px rgba(0,0,0,.18)' }}>
                {loading ? '…' : heroCount.toLocaleString('vi-VN')}
              </span>
              <span className="text-lg font-semibold text-blue-200">nhân khẩu</span>
            </div>
            <p className="text-sm text-blue-100/90 mt-3">Cập nhật mới nhất — UBND Xã Hòa Tiến</p>
          </div>

          <div className="flex gap-3.5 flex-wrap">
            {[
              { icon: Home,  label: 'Hộ dân',    val: households },
              { icon: Users, label: 'Nhân khẩu', val: members },
              { icon: MapPin, label: 'Thôn',     val: villages },
            ].map(s => (
              <div key={s.label} className="px-5 py-4 rounded-2xl bg-white/[.13] backdrop-blur-sm border border-white/20 min-w-[120px]">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-blue-100">
                  <s.icon size={14} className="text-sky-300" /> {s.label}
                </div>
                <div className="text-2xl font-black text-white mt-1.5">{loading ? '…' : s.val.toLocaleString('vi-VN')}</div>
              </div>
            ))}
          </div>
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

    </div>
  )
}
