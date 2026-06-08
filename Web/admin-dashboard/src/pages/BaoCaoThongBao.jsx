import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts'
import { getReportStats } from '../services/notificationService'

const CHANNEL_COLOR = { ZALO: '#3b82f6', EMAIL: '#f97316', SMS: '#22c55e' }
const STATUS_COLOR = { SENT: '#22c55e', FAILED: '#ef4444', PENDING: '#9ca3af', READ: '#3b82f6', CONFIRMED: '#a855f7' }
const STATUS_VN = { SENT: 'Đã gửi', FAILED: 'Thất bại', PENDING: 'Chờ', READ: 'Đã đọc', CONFIRMED: 'Xác nhận' }

function KPICard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function BaoCaoThongBao() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)

  const load = useCallback(() => {
    setLoading(true)
    getReportStats(days)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false))
  }, [days])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo thông báo</h1>
          <p className="text-sm text-gray-500 mt-1">Tỷ lệ tiếp cận và hiệu quả gửi tin (UC14)</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {loading && !stats
        ? (
          <div className="py-20 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin inline mr-2" /> Đang tải dữ liệu...
          </div>
        )
        : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Thông báo đã gửi"
                value={stats?.totalNotifs || 0}
                sub={`Trong ${days} ngày qua`}
                color="text-blue-700"
              />
              <KPICard
                label="Tổng lượt gửi"
                value={totalSends.toLocaleString()}
                sub={`${sentRate}% thành công`}
              />
              <KPICard
                label="Đã đọc / Xác nhận"
                value={`${readRate}%`}
                sub={`${readCount + confirmedCount} lượt`}
                color="text-green-700"
              />
              <KPICard
                label="Gửi thất bại"
                value={failedCount.toLocaleString()}
                sub={totalSends > 0 ? `${Math.round(failedCount / totalSends * 100)}% tổng` : '—'}
                color={failedCount > 0 ? 'text-red-600' : 'text-gray-600'}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Theo kênh gửi */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Lượt gửi theo kênh</h3>
                {channelData.length === 0
                  ? <p className="text-center text-gray-400 py-8">Chưa có dữ liệu</p>
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={channelData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Lượt gửi" radius={[4, 4, 0, 0]}>
                          {channelData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

              {/* Theo trạng thái */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Phân bố trạng thái</h3>
                {statusData.length === 0
                  ? <p className="text-center text-gray-400 py-8">Chưa có dữ liệu</p>
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                }
              </div>
            </div>

            {/* Chi tiết bảng */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Chi tiết trạng thái gửi</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-gray-600">Trạng thái</th>
                      <th className="text-right py-2 font-medium text-gray-600">Số lượng</th>
                      <th className="text-right py-2 font-medium text-gray-600">Tỷ lệ</th>
                      <th className="py-2 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statusData.map(s => {
                      const pct = totalSends > 0 ? Math.round(s.value / totalSends * 100) : 0
                      return (
                        <tr key={s.name} className="hover:bg-gray-50">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
                              {s.name}
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-medium">{s.value.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-gray-500">{pct}%</td>
                          <td className="py-2.5 px-4">
                            <div className="h-1.5 bg-gray-100 rounded-full w-24 ml-auto overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.fill }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {statusData.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-gray-400">Chưa có dữ liệu trong khoảng thời gian này</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }
    </div>
  )
}
