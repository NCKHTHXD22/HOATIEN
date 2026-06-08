import '../styles/tin-tuc.css'
import { useState } from 'react'
import { Plus, Filter, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge, Modal, Select, FormInput, Textarea } from '../components/ui'
import { Newspaper, CheckCircle, FileText } from 'lucide-react'

const DANH_MUC_OPTIONS = [
  { value: 'Thông báo',        label: 'Thông báo' },
  { value: 'Tin tức',          label: 'Tin tức' },
  { value: 'Chính sách',       label: 'Chính sách' },
  { value: 'Văn bản pháp quy', label: 'Văn bản pháp quy' },
  { value: 'Khác',             label: 'Khác' },
]

const TRANG_THAI_OPTIONS = [
  { value: 'Nháp',    label: 'Lưu nháp' },
  { value: 'Đã đăng', label: 'Đăng ngay' },
]

const TRANG_THAI_VARIANT = {
  'Đã đăng': 'green',
  'Nháp':    'default',
}

const COLUMNS = ['Tiêu đề', 'Danh mục', 'Ngày đăng', 'Tác giả', 'Lượt xem', 'Trạng thái', '']

const EMPTY_FORM = { tieuDe: '', danhMuc: 'Thông báo', noiDung: '', tacGia: '', trangThai: 'Nháp' }

const TAB_FILTER = {
  'Tất cả':   null,
  'Đã đăng':  'Đã đăng',
  'Nháp':     'Nháp',
}

export default function TinTuc() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [baiVietList, setBaiVietList] = useState([])

  // Modal
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  // Detail modal
  const [showDetail, setShowDetail] = useState(false)
  const [detailItem, setDetailItem] = useState(null)

  const filtered = baiVietList.filter(b => {
    const matchTab = !TAB_FILTER[tab] || b.trangThai === TAB_FILTER[tab]
    const q = search.toLowerCase()
    const matchSearch = !q || b.tieuDe.toLowerCase().includes(q) || b.danhMuc.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const stats = {
    total:  baiVietList.length,
    daDang: baiVietList.filter(b => b.trangThai === 'Đã đăng').length,
    nhap:   baiVietList.filter(b => b.trangThai === 'Nháp').length,
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  const handleAdd = () => {
    if (!form.tieuDe.trim()) { setError('Vui lòng nhập tiêu đề bài viết'); return }
    const now = new Date().toLocaleDateString('vi-VN')
    const newItem = {
      ...form,
      id: Date.now().toString(),
      ngayDang: now,
      luotXem: 0,
    }
    setBaiVietList(prev => [newItem, ...prev])
    setShowAdd(false)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Xóa bài viết này?')) return
    setBaiVietList(prev => prev.filter(b => b.id !== id))
  }

  const togglePublish = (id) => {
    setBaiVietList(prev => prev.map(b =>
      b.id === id
        ? { ...b, trangThai: b.trangThai === 'Đã đăng' ? 'Nháp' : 'Đã đăng' }
        : b
    ))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Tin tức / Thông báo"
        subtitle="Quản lý bài viết, thông báo đăng lên cổng thông tin"
        action={<PrimaryBtn onClick={openAdd}><Plus size={14} /> Tạo bài viết</PrimaryBtn>}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tổng bài viết" value={stats.total}  sub="Tất cả danh mục"   icon={Newspaper}   iconColor="#2563eb" />
        <StatCard label="Đã đăng"       value={stats.daDang} sub="Hiển thị công khai" icon={CheckCircle} iconColor="#16a34a" />
        <StatCard label="Bản nháp"      value={stats.nhap}   sub="Chưa xuất bản"     icon={FileText}    iconColor="#94a3b8" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Đã đăng', 'Nháp']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tiêu đề bài viết..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={filtered.length === 0}>
          {filtered.map(b => (
            <tr key={b.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
              <td className="px-5 py-3 text-sm font-semibold text-foreground max-w-[240px] truncate">{b.tieuDe}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{b.danhMuc}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{b.ngayDang}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{b.tacGia || '—'}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{b.luotXem}</td>
              <td className="px-5 py-3">
                <Badge variant={TRANG_THAI_VARIANT[b.trangThai] ?? 'default'}>{b.trangThai}</Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                    title="Xem chi tiết"
                    onClick={() => { setDetailItem(b); setShowDetail(true) }}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-green-600 transition-colors"
                    title={b.trangThai === 'Đã đăng' ? 'Chuyển về nháp' : 'Đăng bài'}
                    onClick={() => togglePublish(b.id)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                    title="Xóa"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">Hiển thị {filtered.length} / {baiVietList.length} bài viết</span>
        </div>
      </div>

      {/* Modal Tạo bài viết */}
      <Modal
        title="Tạo bài viết mới"
        open={showAdd}
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={handleAdd}>Tạo bài viết</PrimaryBtn>
          </>
        }
      >
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}
        <FormInput
          label="Tiêu đề"
          required
          placeholder="Nhập tiêu đề bài viết..."
          value={form.tieuDe}
          onChange={e => setForm(f => ({ ...f, tieuDe: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Danh mục"
            value={form.danhMuc}
            onChange={val => setForm(f => ({ ...f, danhMuc: val }))}
            options={DANH_MUC_OPTIONS}
          />
          <FormInput
            label="Tác giả"
            placeholder="Tên tác giả..."
            value={form.tacGia}
            onChange={e => setForm(f => ({ ...f, tacGia: e.target.value }))}
          />
        </div>
        <Textarea
          label="Nội dung"
          placeholder="Nhập nội dung bài viết..."
          rows={5}
          value={form.noiDung}
          onChange={e => setForm(f => ({ ...f, noiDung: e.target.value }))}
        />
        <Select
          label="Trạng thái"
          value={form.trangThai}
          onChange={val => setForm(f => ({ ...f, trangThai: val }))}
          options={TRANG_THAI_OPTIONS}
        />
      </Modal>

      {/* Modal Chi tiết bài viết */}
      <Modal
        title={detailItem?.tieuDe ?? ''}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        footer={<SecondaryBtn onClick={() => setShowDetail(false)}>Đóng</SecondaryBtn>}
      >
        {detailItem && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="blue">{detailItem.danhMuc}</Badge>
              <Badge variant={TRANG_THAI_VARIANT[detailItem.trangThai] ?? 'default'}>{detailItem.trangThai}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {detailItem.tacGia && <span>Tác giả: <strong>{detailItem.tacGia}</strong> · </span>}
              <span>Ngày đăng: <strong>{detailItem.ngayDang}</strong></span>
            </div>
            {detailItem.noiDung ? (
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary rounded-md px-4 py-3">
                {detailItem.noiDung}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Không có nội dung</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
