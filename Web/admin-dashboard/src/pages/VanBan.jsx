import '../styles/van-ban.css'
import { useState } from 'react'
import { Plus, Download, Filter, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge, Modal, Select, FormInput } from '../components/ui'
import { ArrowDownToLine, ArrowUpFromLine, FileText } from 'lucide-react'

const LOAI_VAN_BAN = {
  DEN:   { label: 'Văn bản đến', variant: 'blue' },
  DI:    { label: 'Văn bản đi',  variant: 'green' },
  NOI_BO: { label: 'Nội bộ',    variant: 'purple' },
}

const TINH_TRANG = {
  CHO_XU_LY: { label: 'Chờ xử lý',  variant: 'amber' },
  DA_XU_LY:  { label: 'Đã xử lý',   variant: 'green' },
  DA_BAN_HANH: { label: 'Đã ban hành', variant: 'blue' },
  LUU_TRU:   { label: 'Lưu trữ',    variant: 'default' },
}

const LOAI_OPTIONS = [
  { value: 'DEN',    label: 'Văn bản đến' },
  { value: 'DI',     label: 'Văn bản đi' },
  { value: 'NOI_BO', label: 'Nội bộ' },
]

const TINH_TRANG_OPTIONS = [
  { value: 'CHO_XU_LY',   label: 'Chờ xử lý' },
  { value: 'DA_XU_LY',    label: 'Đã xử lý' },
  { value: 'DA_BAN_HANH', label: 'Đã ban hành' },
  { value: 'LUU_TRU',     label: 'Lưu trữ' },
]

const COLUMNS = ['Số hiệu', 'Trích yếu nội dung', 'Loại văn bản', 'Ngày ban hành', 'Nơi ban hành', 'Tình trạng', '']

const EMPTY_FORM = {
  soHieu: '', trichYeu: '', loai: 'DEN',
  ngayBanHanh: '', noiBanHanh: '', tinhTrang: 'CHO_XU_LY',
}

const TAB_FILTER = {
  'Tất cả':     null,
  'Văn bản đến': 'DEN',
  'Văn bản đi':  'DI',
  'Nội bộ':      'NOI_BO',
}

export default function VanBan() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [vanBanList, setVanBanList] = useState([])

  // Modal
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const filtered = vanBanList.filter(vb => {
    const matchTab = !TAB_FILTER[tab] || vb.loai === TAB_FILTER[tab]
    const q = search.toLowerCase()
    const matchSearch = !q || vb.soHieu.toLowerCase().includes(q) || vb.trichYeu.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const stats = {
    den:   vanBanList.filter(v => v.loai === 'DEN').length,
    di:    vanBanList.filter(v => v.loai === 'DI').length,
    noiBO: vanBanList.filter(v => v.loai === 'NOI_BO').length,
    choxuly: vanBanList.filter(v => v.tinhTrang === 'CHO_XU_LY').length,
    dabanhhanh: vanBanList.filter(v => v.tinhTrang === 'DA_BAN_HANH').length,
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  const handleAdd = () => {
    if (!form.soHieu.trim())   { setError('Vui lòng nhập số hiệu văn bản'); return }
    if (!form.trichYeu.trim()) { setError('Vui lòng nhập trích yếu nội dung'); return }
    const newItem = { ...form, id: Date.now().toString() }
    setVanBanList(prev => [newItem, ...prev])
    setShowAdd(false)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Xóa văn bản này?')) return
    setVanBanList(prev => prev.filter(v => v.id !== id))
  }

  const exportCsv = () => {
    if (vanBanList.length === 0) { alert('Chưa có dữ liệu để xuất'); return }
    const headers = ['Số hiệu', 'Trích yếu nội dung', 'Loại văn bản', 'Ngày ban hành', 'Nơi ban hành', 'Tình trạng']
    const rows = vanBanList.map(v => [
      v.soHieu,
      v.trichYeu,
      LOAI_VAN_BAN[v.loai]?.label ?? v.loai,
      v.ngayBanHanh,
      v.noiBanHanh,
      TINH_TRANG[v.tinhTrang]?.label ?? v.tinhTrang,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'danh-sach-van-ban.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý văn bản"
        subtitle="Văn bản đến, đi và nội bộ của UBND Xã Hòa Tiến"
        action={
          <div className="flex gap-2">
            <SecondaryBtn onClick={exportCsv}><Download size={14} /> Xuất danh sách</SecondaryBtn>
            <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm văn bản</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Văn bản đến"    value={stats.den}   sub={`Chờ xử lý: ${stats.choxuly}`}      icon={ArrowDownToLine} iconColor="#2563eb" />
        <StatCard label="Văn bản đi"     value={stats.di}    sub={`Đã ban hành: ${stats.dabanhhanh}`} icon={ArrowUpFromLine} iconColor="#16a34a" />
        <StatCard label="Văn bản nội bộ" value={stats.noiBO} sub="Nghị quyết, QĐ…"                    icon={FileText}        iconColor="#7c3aed" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Văn bản đến', 'Văn bản đi', 'Nội bộ']} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm số hiệu, trích yếu..." />
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={filtered.length === 0}>
          {filtered.map(vb => {
            const loai = LOAI_VAN_BAN[vb.loai] || { label: vb.loai, variant: 'default' }
            const tt   = TINH_TRANG[vb.tinhTrang] || { label: vb.tinhTrang, variant: 'default' }
            return (
              <tr key={vb.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{vb.soHieu}</td>
                <td className="px-5 py-3 text-sm text-foreground max-w-[240px] truncate">{vb.trichYeu}</td>
                <td className="px-5 py-3"><Badge variant={loai.variant}>{loai.label}</Badge></td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{vb.ngayBanHanh || '—'}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{vb.noiBanHanh || '—'}</td>
                <td className="px-5 py-3"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200" title="Xem">
                      <Eye size={13} />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200" title="Sửa">
                      <Pencil size={13} />
                    </button>
                    <button
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                      title="Xóa"
                      onClick={() => handleDelete(vb.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">Hiển thị {filtered.length} / {vanBanList.length} văn bản</span>
        </div>
      </div>

      {/* Modal Thêm văn bản */}
      <Modal
        title="Thêm văn bản mới"
        open={showAdd}
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={handleAdd}>Thêm văn bản</PrimaryBtn>
          </>
        }
      >
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}
        <Select
          label="Loại văn bản"
          value={form.loai}
          onChange={val => setForm(f => ({ ...f, loai: val }))}
          options={LOAI_OPTIONS}
        />
        <FormInput
          label="Số hiệu"
          required
          placeholder="VD: 01/QĐ-UBND"
          value={form.soHieu}
          onChange={e => setForm(f => ({ ...f, soHieu: e.target.value }))}
        />
        <FormInput
          label="Trích yếu nội dung"
          required
          placeholder="Nội dung tóm tắt của văn bản..."
          value={form.trichYeu}
          onChange={e => setForm(f => ({ ...f, trichYeu: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="Ngày ban hành"
            type="date"
            value={form.ngayBanHanh}
            onChange={e => setForm(f => ({ ...f, ngayBanHanh: e.target.value }))}
          />
          <FormInput
            label="Nơi ban hành"
            placeholder="UBND Xã Hòa Tiến"
            value={form.noiBanHanh}
            onChange={e => setForm(f => ({ ...f, noiBanHanh: e.target.value }))}
          />
        </div>
        <Select
          label="Tình trạng"
          value={form.tinhTrang}
          onChange={val => setForm(f => ({ ...f, tinhTrang: val }))}
          options={TINH_TRANG_OPTIONS}
        />
      </Modal>
    </div>
  )
}
