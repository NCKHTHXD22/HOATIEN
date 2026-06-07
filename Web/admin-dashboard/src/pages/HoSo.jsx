import '../styles/ho-so.css'
import { useState } from 'react'
import { Plus, Filter, Download } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard } from '../components/ui'
import { FolderOpen, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

const COLUMNS = ['Mã hồ sơ', 'Công dân', 'Lĩnh vực', 'Ngày nộp', 'Hạn xử lý', 'Cán bộ phụ trách', 'Trạng thái', '']

export default function HoSo() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Hồ sơ hành chính"
        subtitle="Tiếp nhận, theo dõi và xử lý hồ sơ công dân"
        action={
          <div className="flex items-center gap-2">
            <SecondaryBtn><Download size={14} /> Xuất Excel</SecondaryBtn>
            <PrimaryBtn><Plus size={14} /> Tiếp nhận hồ sơ</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Tổng hồ sơ"  value="0" sub="Toàn bộ"       icon={FolderOpen}    iconColor="#2563eb" />
        <StatCard label="Đang xử lý"  value="0" sub="Trong hạn"      icon={Clock}         iconColor="#d97706" />
        <StatCard label="Hoàn thành"  value="0" sub="Tháng này"      icon={CheckCircle}   iconColor="#16a34a" />
        <StatCard label="Quá hạn"     value="0" sub="Cần xử lý ngay" icon={AlertTriangle} iconColor="#dc2626" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Đang xử lý', 'Hoàn thành', 'Quá hạn']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã hồ sơ, tên công dân..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>

        <DataTable columns={COLUMNS} empty />

        <div className="table-footer">
          <span className="table-count">Hiển thị 0 / 0 hồ sơ</span>
          <div className="flex gap-1">
            {['‹', '1', '›'].map(p => (
              <button key={p} className={`page-btn ${p === '1' ? 'page-btn-active' : ''}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
