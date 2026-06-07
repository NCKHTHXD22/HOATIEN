import '../styles/phan-anh.css'
import { useState } from 'react'
import { Filter } from 'lucide-react'
import { PageHeader, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard } from '../components/ui'
import { MessageSquareWarning, Clock, CheckCircle } from 'lucide-react'

const COLUMNS = ['Mã phản ánh', 'Công dân', 'Nội dung', 'Lĩnh vực', 'Ngày gửi', 'Trạng thái', 'Phân công', '']

export default function PhanAnh() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Phản ánh kiến nghị"
        subtitle="Tiếp nhận và xử lý ý kiến, phản ánh của công dân"
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Chưa xử lý" value="0" sub="Cần phân công" icon={MessageSquareWarning} iconColor="#dc2626" />
        <StatCard label="Đang xử lý" value="0" sub="Đã phân công"  icon={Clock}                iconColor="#d97706" />
        <StatCard label="Đã xử lý"   value="0" sub="Tháng này"     icon={CheckCircle}          iconColor="#16a34a" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Chưa xử lý', 'Đang xử lý', 'Đã xử lý']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên công dân, nội dung..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>
        <DataTable columns={COLUMNS} empty />
        <div className="table-footer">
          <span className="table-count">Hiển thị 0 / 0 phản ánh</span>
        </div>
      </div>
    </div>
  )
}
