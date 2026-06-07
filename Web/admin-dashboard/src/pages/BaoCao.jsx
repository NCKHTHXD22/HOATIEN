import '../styles/bao-cao.css'
import { useEffect, useState } from 'react'
import { Download, BarChart3, TrendingUp, FileText, Calendar, Users, Home, MapPin, RefreshCw } from 'lucide-react'
import { PageHeader, PrimaryBtn, StatCard } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import * as reportService from '../services/reportService'

const COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#dc2626', '#059669', '#f59e0b']

export default function BaoCao() {
  const [summary, setSummary]       = useState(null)
  const [byVillage, setByVillage]   = useState([])
  const [movStats, setMovStats]     = useState(null)
  const [loading, setLoading]       = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sumRes, vilRes, movRes] = await Promise.all([
        reportService.getSummary(),
        reportService.getByVillage(),
        reportService.getMovements(),
      ])
      setSummary(sumRes.data.data)
      setByVillage(vilRes.data.data || [])
      setMovStats(movRes.data.data)
    } catch (e) {
      console.error('BaoCao load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Pie chart: loại hộ tổng hợp từ by-village
  const pieData = (() => {
    const totals = { THUONG_TRU: 0, TAM_TRU: 0, TAM_VANG: 0 }
    byVillage.forEach(v => {
      totals.THUONG_TRU += v.byType?.THUONG_TRU || 0
      totals.TAM_TRU    += v.byType?.TAM_TRU    || 0
      totals.TAM_VANG   += v.byType?.TAM_VANG   || 0
    })
    return [
      { name: 'Thường trú', value: totals.THUONG_TRU },
      { name: 'Tạm trú',    value: totals.TAM_TRU },
      { name: 'Tạm vắng',  value: totals.TAM_VANG },
    ].filter(d => d.value > 0)
  })()

  // Bar chart: hộ dân & nhân khẩu theo thôn
  const barData = byVillage.map(v => ({
    name: v.villageName,
    'Hộ dân':    v.totalHouseholds,
    'Nhân khẩu': v.totalMembers,
  }))

  const kpis = [
    { label: 'Tổng hộ dân',   value: summary?.households ?? '—', icon: Home,   iconColor: '#2563eb' },
    { label: 'Tổng nhân khẩu', value: summary?.members   ?? '—', icon: Users,  iconColor: '#16a34a' },
    { label: 'Số thôn',       value: summary?.villages   ?? '—', icon: MapPin, iconColor: '#7c3aed' },
    { label: 'Biến động (net)', value: movStats?.net     ?? '—', icon: TrendingUp, iconColor: '#d97706' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Báo cáo – Thống kê"
        subtitle="Tổng hợp số liệu dân số Xã Hòa Tiến"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-md border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <PrimaryBtn><Download size={14} /> Xuất báo cáo tổng hợp</PrimaryBtn>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="bc-chart-box">
          <p className="bc-chart-title">Hộ dân & Nhân khẩu theo thôn</p>
          <p className="bc-chart-sub">Phân bổ hộ dân và nhân khẩu từng thôn</p>
          {loading || barData.length === 0 ? (
            <div className="bc-chart-empty">
              <p className="text-sm text-muted-foreground">
                {loading ? 'Đang tải...' : 'Chưa có dữ liệu'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Hộ dân"    fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Nhân khẩu" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="bc-chart-box">
          <p className="bc-chart-title">Phân loại hộ dân</p>
          <p className="bc-chart-sub">Thường trú / Tạm trú / Tạm vắng</p>
          {loading || pieData.length === 0 ? (
            <div className="bc-chart-empty">
              <p className="text-sm text-muted-foreground">
                {loading ? 'Đang tải...' : 'Chưa có dữ liệu'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Biến động dân số */}
      <div className="bc-chart-box">
        <p className="bc-chart-title">Biến động dân số</p>
        <p className="bc-chart-sub">Thống kê chuyển đến – chuyển đi</p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Đang tải...</p>
        ) : (
          <div className="grid grid-cols-3 gap-4 mt-3">
            {[
              { label: 'Chuyển đến (Move In)',  value: movStats?.moveIn  ?? 0, color: '#16a34a' },
              { label: 'Chuyển đi (Move Out)', value: movStats?.moveOut ?? 0, color: '#dc2626' },
              { label: 'Biến động ròng (Net)',  value: movStats?.net     ?? 0, color: '#2563eb' },
            ].map(s => (
              <div key={s.label} className="bg-secondary rounded-lg p-4 text-center">
                <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thống kê theo thôn (table) */}
      {byVillage.length > 0 && (
        <div className="bc-chart-box overflow-x-auto">
          <p className="bc-chart-title mb-3">Chi tiết theo thôn</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border">
                {['Thôn', 'Mã', 'Tổng hộ', 'Đang hoạt động', 'Nhân khẩu', 'Thường trú', 'Tạm trú', 'Tạm vắng'].map(c => (
                  <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byVillage.map(v => (
                <tr key={v.villageId} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-2 font-semibold text-foreground">{v.villageName}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{v.ma}</td>
                  <td className="px-4 py-2 text-foreground">{v.totalHouseholds}</td>
                  <td className="px-4 py-2 text-emerald-600">{v.activeHouseholds}</td>
                  <td className="px-4 py-2 text-foreground">{v.totalMembers}</td>
                  <td className="px-4 py-2 text-blue-600">{v.byType?.THUONG_TRU ?? 0}</td>
                  <td className="px-4 py-2 text-amber-600">{v.byType?.TAM_TRU ?? 0}</td>
                  <td className="px-4 py-2 text-purple-600">{v.byType?.TAM_VANG ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report type cards */}
      <div>
        <p className="bc-section-title">Xuất báo cáo theo loại</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: 'Báo cáo hộ dân theo thôn',       desc: 'Tổng hợp hộ dân, nhân khẩu phân theo từng thôn',        icon: Home,    color: '#2563eb', periods: ['Tháng', 'Quý', 'Năm'] },
            { title: 'Báo cáo biến động dân số',        desc: 'Số hộ chuyển đến, chuyển đi trong kỳ báo cáo',          icon: TrendingUp, color: '#16a34a', periods: ['Tháng', 'Quý', 'Năm'] },
            { title: 'Báo cáo phân loại hộ khẩu',      desc: 'Thống kê thường trú, tạm trú, tạm vắng theo thời gian', icon: BarChart3,  color: '#7c3aed', periods: ['Tháng', 'Năm'] },
            { title: 'Báo cáo nhân khẩu học',          desc: 'Cơ cấu giới tính, độ tuổi, phân bổ nhân khẩu',          icon: Calendar,  color: '#d97706', periods: ['Quý', 'Năm'] },
          ].map(r => (
            <div key={r.title} className="bc-report-card">
              <div className="bc-report-icon" style={{ backgroundColor: r.color + '18' }}>
                <r.icon size={18} style={{ color: r.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="bc-report-title">{r.title}</p>
                <p className="bc-report-desc">{r.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {r.periods.map(p => (
                    <button
                      key={p}
                      className="bc-period-btn"
                      onMouseOver={e => { e.currentTarget.style.backgroundColor = r.color; e.currentTarget.style.borderColor = r.color }}
                      onMouseOut={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.borderColor = '' }}
                    >
                      <Download size={10} /> {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
