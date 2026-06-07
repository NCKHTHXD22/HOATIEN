import '../styles/tin-tuc.css'
import { useState } from 'react'
import { Plus, Filter } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard } from '../components/ui'
import { Newspaper, CheckCircle, FileText } from 'lucide-react'

const COLUMNS = ['Tiêu đề', 'Danh mục', 'Ngày đăng', 'Tác giả', 'Lượt xem', 'Trạng thái', '']

export default function TinTuc() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Tin tức / Thông báo"
        subtitle="Quản lý bài viết, thông báo đăng lên cổng thông tin"
        action={<PrimaryBtn><Plus size={14} /> Tạo bài viết</PrimaryBtn>}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tổng bài viết" value="0" sub="Tất cả danh mục"   icon={Newspaper}   iconColor="#2563eb" />
        <StatCard label="Đã đăng"       value="0" sub="Hiển thị công khai" icon={CheckCircle} iconColor="#16a34a" />
        <StatCard label="Bản nháp"      value="0" sub="Chưa xuất bản"     icon={FileText}    iconColor="#94a3b8" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Đã đăng', 'Nháp']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tiêu đề bài viết..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>
        <DataTable columns={COLUMNS} empty />
        <div className="table-footer">
          <span className="table-count">Hiển thị 0 / 0 bài viết</span>
        </div>
      </div>
    </div>
  )
}
