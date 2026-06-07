import '../styles/nhan-su.css'
import { useState } from 'react'
import { Plus, Filter, Users } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard } from '../components/ui'

const COLUMNS = ['Họ tên', 'Chức vụ', 'Phòng ban', 'Điện thoại', 'Email', 'Trạng thái', '']

export default function NhanSu() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('table')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cán bộ – Nhân sự"
        subtitle="Danh sách cán bộ, công chức UBND Xã Hòa Tiến"
        action={
          <div className="flex gap-2">
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
            <PrimaryBtn><Plus size={14} /> Thêm cán bộ</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tổng cán bộ"   value="0" sub="Biên chế"         icon={Users} iconColor="#2563eb" />
        <StatCard label="Đang làm việc" value="0" sub="Hiện tại"          icon={Users} iconColor="#16a34a" />
        <StatCard label="Nghỉ phép"     value="0" sub="Tháng này"         icon={Users} iconColor="#d97706" />
        <StatCard label="Hợp đồng"      value="0" sub="Lao động hợp đồng" icon={Users} iconColor="#7c3aed" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Đang làm việc', 'Nghỉ phép', 'Nghỉ việc']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, chức vụ, phòng ban..." />
            <div className="ns-view-toggle">
              {[['table', '☰'], ['grid', '⊞']].map(([v, icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`ns-view-btn ${view === v ? 'ns-view-btn-on' : ''}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <>
            <DataTable columns={COLUMNS} empty />
            <div className="table-footer">
              <span className="table-count">Hiển thị 0 / 0 cán bộ</span>
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="ns-grid-empty">
              <p className="text-sm text-muted-foreground">Chưa có cán bộ nào</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
