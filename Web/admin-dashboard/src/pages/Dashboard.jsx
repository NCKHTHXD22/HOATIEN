import '../styles/dashboard.css'
import { useEffect, useState } from 'react'
import {
  Users, Home, MapPin, ArrowUpDown,
  ArrowUpRight, TrendingUp, RefreshCw,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { StatCard } from '../components/ui'
import * as reportService from '../services/reportService'

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

  const kpis = [
    { label: 'Hộ dân đang hoạt động', value: summary?.households ?? '—', icon: Home,      iconColor: '#2563eb' },
    { label: 'Tổng nhân khẩu',        value: summary?.members   ?? '—', icon: Users,     iconColor: '#16a34a' },
    { label: 'Số thôn quản lý',        value: summary?.villages  ?? '—', icon: MapPin,    iconColor: '#7c3aed' },
    { label: 'Biến động dân số (net)', value: movStats?.net      ?? '—', icon: ArrowUpDown, iconColor: '#d97706' },
  ]

  // Build chart from village stats for bar data
  const chartData = villageStats.map(v => ({
    name: v.villageName,
    'Hộ dân': v.totalHouseholds,
    'Nhân khẩu': v.totalMembers,
  }))

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            Tổng quan hệ thống quản lý dân số
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            UBND Xã Hòa Tiến
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-md border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="relative rounded-lg overflow-hidden p-7 shadow-xl shadow-primary/20 bg-hero-card">
        <div className="absolute w-56 h-56 rounded-full bg-white/[.07] -top-10 right-32 pointer-events-none" />
        <div className="absolute w-80 h-80 rounded-full bg-white/[.04] -top-24 right-0 pointer-events-none" />
        <div className="absolute w-32 h-32 rounded-full bg-white/[.05] bottom-0 left-1/3 translate-y-1/2 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <p className="text-sm font-medium text-blue-200">Tổng dân số đang quản lý</p>
            <div className="flex items-center gap-5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Home size={11} /> Hộ dân: {loading ? '...' : (summary?.households ?? 0)}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <Users size={11} /> Nhân khẩu: {loading ? '...' : (summary?.members ?? 0)}
              </span>
              <span className="flex items-center gap-1.5 text-sky-200">
                <MapPin size={11} /> Thôn: {loading ? '...' : (summary?.villages ?? 0)}
              </span>
            </div>
          </div>

          <p className="text-7xl font-black text-white leading-none tracking-tight">
            {loading ? '...' : (summary?.members ?? 0)}
          </p>
          <p className="text-xs text-blue-300/80 mt-4">Nhân khẩu — UBND Xã Hòa Tiến</p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* ── Chart + Village list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-foreground">Thống kê theo thôn</p>
              <p className="text-xs text-muted-foreground mt-0.5">Số hộ dân và nhân khẩu từng thôn</p>
            </div>
          </div>
          {loading || chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-md bg-secondary border border-dashed border-border">
              <TrendingUp size={28} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {loading ? 'Đang tải...' : 'Chưa có dữ liệu thôn'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Hộ dân"    stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Nhân khẩu" stroke="#10b981"         strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Village list */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-bold text-foreground">Thống kê thôn</p>
            <a href="/ho-so"
              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors">
              Xem hộ dân <ArrowUpRight size={11} />
            </a>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-8 text-sm text-muted-foreground">Đang tải...</div>
          ) : villageStats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-5 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
                <MapPin size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Chưa có dữ liệu thôn</p>
            </div>
          ) : (
            <ul className="divide-y divide-border flex-1 overflow-auto">
              {villageStats.map(v => (
                <li key={v.villageId} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{v.villageName}</p>
                    <p className="text-[10px] text-muted-foreground">{v.totalMembers} nhân khẩu</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{v.totalHouseholds} hộ</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  )
}
