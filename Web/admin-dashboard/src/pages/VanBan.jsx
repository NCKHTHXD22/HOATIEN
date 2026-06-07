import '../styles/van-ban.css'
import { useState } from 'react'
import { Plus, Download, Filter } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard } from '../components/ui'
import { ArrowDownToLine, ArrowUpFromLine, FileText } from 'lucide-react'

const COLUMNS = ['Số hiệu', 'Trích yếu nội dung', 'Loại văn bản', 'Ngày ban hành', 'Nơi ban hành', 'Tình trạng', '']

export default function VanBan() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý văn bản"
        subtitle="Văn bản đến, đi và nội bộ của UBND Xã Hòa Tiến"
        action={
          <div className="flex gap-2">
            <SecondaryBtn><Download size={14} /> Xuất danh sách</SecondaryBtn>
            <PrimaryBtn><Plus size={14} /> Thêm văn bản</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Văn bản đến"    value="0" sub="Chờ xử lý: 0"    icon={ArrowDownToLine} iconColor="#2563eb" />
        <StatCard label="Văn bản đi"     value="0" sub="Đã ban hành: 0"  icon={ArrowUpFromLine} iconColor="#16a34a" />
        <StatCard label="Văn bản nội bộ" value="0" sub="Nghị quyết, QĐ…" icon={FileText}        iconColor="#7c3aed" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Văn bản đến', 'Văn bản đi', 'Nội bộ']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm số hiệu, trích yếu..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>
        <DataTable columns={COLUMNS} empty />
        <div className="table-footer">
          <span className="table-count">Hiển thị 0 / 0 văn bản</span>
        </div>
      </div>
    </div>
  )
}
