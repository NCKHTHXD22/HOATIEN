import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Download, Send, FileText, CheckCircle2, AlertTriangle, Layers, MessageSquare } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts'
import { getReportStats } from '../services/notificationService'

const CHANNEL_COLOR = { ZALO: '#3b82f6', EMAIL: '#f97316', SMS: '#22c55e', APP: '#8b5cf6' }
const STATUS_COLOR = { SENT: '#22c55e', FAILED: '#ef4444', PENDING: '#9ca3af', READ: '#3b82f6', CONFIRMED: '#a855f7' }
const STATUS_VN = { SENT: 'Đã gửi', FAILED: 'Thất bại', PENDING: 'Chờ', READ: 'Đã đọc', CONFIRMED: 'Xác nhận' }

const SOURCE_TABS = [
  { id: 'ALL', label: 'Tất cả nguồn', icon: Layers },
  { id: 'ZALO', label: 'Gửi tin Zalo', icon: MessageSquare },
  { id: 'CONTENT', label: 'Nội dung', icon: FileText },
  { id: 'SURVEY', label: 'Khảo sát nhanh', icon: CheckCircle2 },
]

function KPICard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
      </div>
      <p className={`text-3xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1.5 font-medium">{sub}</p>}
    </div>
  )
}

export default function BaoCaoThongBao() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [source, setSource] = useState('ALL')

  const load = useCallback(() => {
    setLoading(true)
    getReportStats(days, source)
      .then(r => setStats(r.data))
      .catch(err => console.error('Failed to load report stats:', err))
      .finally(() => setLoading(false))
  }, [days, source])

  useEffect(() => { load() }, [load])

  // Tính toán số liệu từ stats
  const totalSends = stats?.sendGroups?.reduce((sum, g) => sum + g._count._all, 0) || 0
  const sentCount = stats?.sendGroups?.find(g => g.trangThai === 'SENT')?._count._all || 0
  const failedCount = stats?.sendGroups?.find(g => g.trangThai === 'FAILED')?._count._all || 0
  const readCount = stats?.sendGroups?.find(g => g.trangThai === 'READ')?._count._all || 0
  const confirmedCount = stats?.sendGroups?.find(g => g.trangThai === 'CONFIRMED')?._count._all || 0

  const sentRate = totalSends > 0 ? Math.round((sentCount + readCount + confirmedCount) / totalSends * 100) : 0
  const readRate = totalSends > 0 ? Math.round((readCount + confirmedCount) / totalSends * 100) : 0

  const channelData = (stats?.channelGroups || []).map(g => ({
    name: g.kenh,
    count: g._count._all,
    fill: CHANNEL_COLOR[g.kenh] || '#6b7280',
  }))

  const statusData = (stats?.sendGroups || []).map(g => ({
    name: STATUS_VN[g.trangThai] || g.trangThai,
    value: g._count._all,
    fill: STATUS_COLOR[g.trangThai] || '#6b7280',
  }))

  const handleExportCSV = () => {
    if (!stats) return
    const headers = ['Khoảng thời gian', 'Nguồn tin', 'Tổng thông báo phát đi', 'Tổng lượt gửi', 'Đã đọc / Xác nhận', 'Gửi thất bại']
    const row = [`${days} ngày`, source, stats.totalNotifs || 0, totalSends, readCount + confirmedCount, failedCount]
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), row.join(',')].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `bao_cao_thong_bao_${source}_${days}ngay.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Báo cáo thông báo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tỷ lệ tiếp cận và hiệu quả gửi tin từ Gửi tin Zalo, Nội dung & Khảo sát nhanh (UC14)
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <select
            className="border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>7 ngày qua</option>
            <option value={30}>30 ngày qua</option>
            <option value={90}>90 ngày qua</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white shadow-sm transition-all"
          >
            <Download size={16} /> Xuất Báo Cáo
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* Tabs Filter Nguồn Tin */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        {SOURCE_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = source === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSource(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading && !stats ? (
        <div className="py-24 text-center bg-white rounded-2xl border border-gray-100">
          <RefreshCw size={28} className="animate-spin text-blue-600 inline mb-3" />
          <p className="text-gray-500 font-medium">Đang hệ thống hóa dữ liệu báo cáo...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Thông báo phát đi"
              value={stats?.totalNotifs || 0}
              sub={`Trong ${days} ngày qua (${source === 'ALL' ? 'Tất cả nguồn' : source})`}
              color="text-blue-700"
              icon={Send}
            />
            <KPICard
              label="Tổng lượt gửi"
              value={totalSends.toLocaleString()}
              sub={`${sentRate}% thành công`}
              color="text-indigo-700"
              icon={Layers}
            />
            <KPICard
              label="Đã đọc / Xác nhận"
              value={`${readRate}%`}
              sub={`${(readCount + confirmedCount).toLocaleString()} lượt tiếp cận`}
              color="text-emerald-600"
              icon={CheckCircle2}
            />
            <KPICard
              label="Gửi thất bại"
              value={failedCount.toLocaleString()}
              sub={totalSends > 0 ? `${Math.round((failedCount / totalSends) * 100)}% tổng lượt gửi` : '—'}
              color={failedCount > 0 ? 'text-rose-600' : 'text-gray-600'}
              icon={AlertTriangle}
            />
          </div>

          {/* Biểu đồ Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Lượt gửi theo kênh */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-1">Lượt gửi theo kênh</h3>
              <p className="text-xs text-gray-500 mb-6">Thống kê số lượng phát đi qua từng kênh truyền thông</p>
              {channelData.length === 0 ? (
                <div className="text-center text-gray-400 py-12">Chưa có dữ liệu kênh truyền thông</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={channelData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }} />
                    <Bar dataKey="count" name="Lượt gửi" radius={[6, 6, 0, 0]}>
                      {channelData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart 2: Phân bố trạng thái */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-1">Phân bố trạng thái</h3>
              <p className="text-xs text-gray-500 mb-6">Tỷ lệ tương tác và phản hồi của người dân</p>
              {statusData.length === 0 ? (
                <div className="text-center text-gray-400 py-12">Chưa có dữ liệu trạng thái</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                      labelLine={false}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Khảo sát nhanh Summary Box (hiển thị khi lọc Survey hoặc Tất cả) */}
          {(source === 'SURVEY' || (source === 'ALL' && stats?.surveyStats?.totalSurveys > 0)) && (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">Thống kê Khảo sát nhanh</h3>
                  <p className="text-xs text-blue-200 mt-0.5">Ý kiến và khảo sát thu thập từ nhân khẩu Xã Hòa Tiến</p>
                </div>
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wide">
                  Tỷ lệ phản hồi: {stats?.surveyStats?.responseRate || 0}%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-200 font-medium">Tổng cuộc khảo sát</p>
                  <p className="text-2xl font-extrabold mt-1">{stats?.surveyStats?.totalSurveys || 0}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-200 font-medium">Tổng lượt người dân điền</p>
                  <p className="text-2xl font-extrabold mt-1">{(stats?.surveyStats?.totalResponses || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-200 font-medium">Khảo sát đang hoạt động</p>
                  <p className="text-2xl font-extrabold mt-1">
                    {stats?.surveyStats?.list?.filter(s => s.active).length || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chi tiết trạng thái gửi */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4">Chi tiết trạng thái gửi</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="text-left py-3 px-2">Trạng thái</th>
                    <th className="text-right py-3 px-2">Số lượng lượt gửi</th>
                    <th className="text-right py-3 px-2">Tỷ lệ đóng góp</th>
                    <th className="py-3 px-4 text-right">Biểu đồ tỷ lệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {statusData.map(s => {
                    const pct = totalSends > 0 ? Math.round((s.value / totalSends) * 100) : 0
                    return (
                      <tr key={s.name} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2.5 font-medium text-gray-800">
                            <span className="w-3 h-3 rounded-full" style={{ background: s.fill }} />
                            {s.name}
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-right font-bold text-gray-900">{s.value.toLocaleString()}</td>
                        <td className="py-3.5 px-2 text-right font-medium text-gray-600">{pct}%</td>
                        <td className="py-3.5 px-4">
                          <div className="h-2 bg-gray-100 rounded-full w-32 ml-auto overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.fill }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {statusData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-gray-400">
                        Chưa có dữ liệu trong khoảng thời gian này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lịch sử chiến dịch / Đợt phát mới nhất */}
          {stats?.campaignList && stats.campaignList.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-4">Các chiến dịch & thông báo mới phát gần đây</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                      <th className="text-left py-3 px-2">Tiêu đề thông báo / Bài viết</th>
                      <th className="text-left py-3 px-2">Phân loại</th>
                      <th className="text-left py-3 px-2">Kênh phát</th>
                      <th className="text-left py-3 px-2">Người gửi</th>
                      <th className="text-right py-3 px-2">Lượt phát</th>
                      <th className="text-right py-3 px-2">Ngày phát</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.campaignList.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 font-semibold text-gray-900">{item.tieuDe}</td>
                        <td className="py-3 px-2 text-gray-600">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">
                            {item.loai}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-medium text-blue-600">{item.kenh}</td>
                        <td className="py-3 px-2 text-gray-600">{item.nguoiTao}</td>
                        <td className="py-3 px-2 text-right font-bold text-gray-900">
                          {(item.luotGui || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500 text-xs font-medium">
                          {new Date(item.ngayGui).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
