import '../styles/bao-cao.css'
import { useEffect, useState } from 'react'
import { Download, BarChart3, TrendingUp, FileText, Calendar, Users, Home, MapPin, RefreshCw } from 'lucide-react'
import { PageHeader, StatCard } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import * as reportService from '../services/reportService'

function downloadCsv(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#dc2626', '#059669', '#f59e0b']

export default function BaoCao() {
  const [summary, setSummary]       = useState(null)
  const [byVillage, setByVillage]   = useState([])
  const [movStats, setMovStats]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [exporting, setExporting]   = useState('')  // 'excel' | 'pdf' | ''

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

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      const res = await reportService.exportExcel()
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(new Blob([res.data], { type: res.headers['content-type'] }), `bao-cao-hoa-tien-${date}.xlsx`)
    } catch (e) {
      alert('Xuất Excel thất bại: ' + (e.response?.data?.message || e.message))
    } finally {
      setExporting('')
    }
  }

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      const res = await reportService.exportPdf()
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(new Blob([res.data], { type: 'application/pdf' }), `bao-cao-hoa-tien-${date}.pdf`)
    } catch (e) {
      alert('Xuất PDF thất bại: ' + (e.response?.data?.message || e.message))
    } finally {
      setExporting('')
    }
  }

  const exportTongHop = () => {
    const now = new Date().toLocaleDateString('vi-VN')
    const rows = [
      ['BÁO CÁO TỔNG HỢP DÂN SỐ — UBND XÃ HÒA TIẾN'],
      [`Ngày xuất: ${now}`],
      [],
      ['=== TỔNG QUAN ==='],
      ['Chỉ số', 'Giá trị'],
      ['Tổng hộ dân',    summary?.households ?? 0],
      ['Tổng nhân khẩu', summary?.members    ?? 0],
      ['Số thôn',        summary?.villages   ?? 0],
      ['Biến động ròng', movStats?.net       ?? 0],
      ['Chuyển đến',     movStats?.moveIn    ?? 0],
      ['Chuyển đi',      movStats?.moveOut   ?? 0],
      [],
      ['=== THỐNG KÊ THEO THÔN ==='],
      ['Thôn', 'Mã', 'Tổng hộ', 'Đang hoạt động', 'Nhân khẩu', 'Thường trú', 'Tạm trú', 'Tạm vắng'],
      ...byVillage.map(v => [
        v.villageName,
        v.ma,
        v.totalHouseholds,
        v.activeHouseholds,
        v.totalMembers,
        v.byType?.THUONG_TRU ?? 0,
        v.byType?.TAM_TRU    ?? 0,
        v.byType?.TAM_VANG   ?? 0,
      ]),
    ]
    downloadCsv(rows, `bao-cao-tong-hop-${now.replace(/\//g, '-')}.csv`)
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
            <button
              onClick={exportTongHop}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              title="Xuất CSV"
            >
              <FileText size={14} /> CSV
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting !== ''}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors disabled:opacity-50"
              title="Xuất Excel (.xlsx)"
            >
              <Download size={14} /> {exporting === 'excel' ? 'Đang xuất...' : 'Excel'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={loading || exporting !== ''}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm transition-colors disabled:opacity-50"
              title="Xuất PDF"
            >
              <Download size={14} /> {exporting === 'pdf' ? 'Đang xuất...' : 'PDF'}
            </button>
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
            { title: 'Báo cáo hộ dân theo thôn',       desc: 'Tổng hợp hộ dân, nhân khẩu phân theo từng thôn',        icon: Home,    color: '#2563eb', periods: ['Tháng', 'Quý', 'Năm'],
              onExport: () => {
                const now = new Date().toLocaleDateString('vi-VN')
                const rows = [
                  ['BÁO CÁO HỘ DÂN THEO THÔN — UBND XÃ HÒA TIẾN'],
                  [`Ngày xuất: ${now}`],
                  [],
                  ['Thôn', 'Mã', 'Tổng hộ', 'Đang hoạt động', 'Nhân khẩu', 'Thường trú', 'Tạm trú', 'Tạm vắng'],
                  ...byVillage.map(v => [v.villageName, v.ma, v.totalHouseholds, v.activeHouseholds, v.totalMembers, v.byType?.THUONG_TRU??0, v.byType?.TAM_TRU??0, v.byType?.TAM_VANG??0]),
                ]
                downloadCsv(rows, `bao-cao-ho-dan-theo-thon-${now.replace(/\//g,'-')}.csv`)
              }
            },
            { title: 'Báo cáo biến động dân số',        desc: 'Số hộ chuyển đến, chuyển đi trong kỳ báo cáo',          icon: TrendingUp, color: '#16a34a', periods: ['Tháng', 'Quý', 'Năm'],
              onExport: () => {
                const now = new Date().toLocaleDateString('vi-VN')
                const rows = [
                  ['BÁO CÁO BIẾN ĐỘNG DÂN SỐ — UBND XÃ HÒA TIẾN'],
                  [`Ngày xuất: ${now}`],
                  [],
                  ['Chỉ số', 'Số lượng'],
                  ['Chuyển đến (Move In)',  movStats?.moveIn  ?? 0],
                  ['Chuyển đi (Move Out)', movStats?.moveOut ?? 0],
                  ['Biến động ròng (Net)', movStats?.net     ?? 0],
                ]
                downloadCsv(rows, `bao-cao-bien-dong-${now.replace(/\//g,'-')}.csv`)
              }
            },
            { title: 'Báo cáo phân loại hộ khẩu',      desc: 'Thống kê thường trú, tạm trú, tạm vắng theo thời gian', icon: BarChart3,  color: '#7c3aed', periods: ['Tháng', 'Năm'],
              onExport: () => {
                const now = new Date().toLocaleDateString('vi-VN')
                const tt = byVillage.reduce((a,v) => a + (v.byType?.THUONG_TRU??0), 0)
                const tr = byVillage.reduce((a,v) => a + (v.byType?.TAM_TRU??0), 0)
                const tv = byVillage.reduce((a,v) => a + (v.byType?.TAM_VANG??0), 0)
                const rows = [
                  ['BÁO CÁO PHÂN LOẠI HỘ KHẨU — UBND XÃ HÒA TIẾN'],
                  [`Ngày xuất: ${now}`],
                  [],
                  ['Loại hộ', 'Số hộ'],
                  ['Thường trú', tt],
                  ['Tạm trú',   tr],
                  ['Tạm vắng',  tv],
                  ['Tổng',      tt + tr + tv],
                ]
                downloadCsv(rows, `bao-cao-phan-loai-ho-khau-${now.replace(/\//g,'-')}.csv`)
              }
            },
            { title: 'Báo cáo nhân khẩu học',          desc: 'Cơ cấu giới tính, độ tuổi, phân bổ nhân khẩu',          icon: Calendar,  color: '#d97706', periods: ['Quý', 'Năm'],
              onExport: () => {
                const now = new Date().toLocaleDateString('vi-VN')
                const rows = [
                  ['BÁO CÁO NHÂN KHẨU HỌC — UBND XÃ HÒA TIẾN'],
                  [`Ngày xuất: ${now}`],
                  [],
                  ['Chỉ số', 'Giá trị'],
                  ['Tổng nhân khẩu', summary?.members   ?? 0],
                  ['Tổng hộ dân',    summary?.households ?? 0],
                  ['Số thôn',        summary?.villages  ?? 0],
                ]
                downloadCsv(rows, `bao-cao-nhan-khau-hoc-${now.replace(/\//g,'-')}.csv`)
              }
            },
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
                      onClick={r.onExport}
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
