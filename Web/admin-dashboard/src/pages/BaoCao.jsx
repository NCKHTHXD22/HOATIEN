import '../styles/bao-cao.css'
import { Download, BarChart3, TrendingUp, FileText, Calendar } from 'lucide-react'
import { PageHeader, PrimaryBtn, StatCard } from '../components/ui'

const reportTypes = [
  {
    title: 'Báo cáo hồ sơ hành chính',
    desc:  'Thống kê tiếp nhận, xử lý, hoàn thành và quá hạn theo kỳ',
    icon: FileText,   color: '#2563eb',
    periods: ['Tuần', 'Tháng', 'Quý', 'Năm'],
  },
  {
    title: 'Báo cáo dịch vụ công trực tuyến',
    desc:  'Số lượng hồ sơ nộp online, tỷ lệ xử lý, mức độ hài lòng',
    icon: TrendingUp, color: '#16a34a',
    periods: ['Tháng', 'Quý', 'Năm'],
  },
  {
    title: 'Báo cáo phản ánh kiến nghị',
    desc:  'Số phản ánh tiếp nhận, đã xử lý, thời gian phản hồi trung bình',
    icon: BarChart3,  color: '#7c3aed',
    periods: ['Tháng', 'Năm'],
  },
  {
    title: 'Báo cáo lịch làm việc & tiếp dân',
    desc:  'Lịch tiếp dân, số lượt tiếp, kết quả giải quyết kiến nghị',
    icon: Calendar,   color: '#d97706',
    periods: ['Tháng', 'Quý'],
  },
]

export default function BaoCao() {
  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Báo cáo – Thống kê"
        subtitle="Tổng hợp số liệu và xuất báo cáo theo kỳ"
        action={<PrimaryBtn><Download size={14} /> Xuất báo cáo tổng hợp</PrimaryBtn>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Hồ sơ tháng này"    value="0" sub="Chưa có dữ liệu" icon={FileText}   iconColor="#2563eb" />
        <StatCard label="Tỷ lệ hoàn thành"   value="—" sub="Chưa có dữ liệu" icon={TrendingUp} iconColor="#16a34a" />
        <StatCard label="Phản ánh tháng này" value="0" sub="Chưa có dữ liệu" icon={BarChart3}  iconColor="#7c3aed" />
        <StatCard label="Thời gian xử lý TB" value="—" sub="Chưa có dữ liệu" icon={Calendar}   iconColor="#d97706" />
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bc-chart-box">
          <p className="bc-chart-title">Xu hướng hồ sơ theo tháng</p>
          <p className="bc-chart-sub">Tiếp nhận và hoàn thành trong năm</p>
          <div className="bc-chart-empty">
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
          </div>
        </div>
        <div className="bc-chart-box">
          <p className="bc-chart-title">Phân bổ hồ sơ theo lĩnh vực</p>
          <p className="bc-chart-sub">Đất đai, hộ khẩu, khai sinh…</p>
          <div className="bc-chart-empty">
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div>
        <p className="bc-section-title">Xuất báo cáo theo loại</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reportTypes.map(r => (
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
