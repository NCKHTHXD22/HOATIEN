import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Pencil, Trash2, Phone, Crown, Users2, ShieldCheck } from 'lucide-react'
import {
  PageHeader, PrimaryBtn, SecondaryBtn, StatCard, Badge, Tabs,
  SearchInput, Modal, FormInput, Select,
} from '../components/ui'
import * as officialService from '../services/villageOfficialService'
import * as villageService from '../services/villageService'

const VAI_TRO_LABEL = {
  TO_TRUONG: { label: 'Tổ trưởng', variant: 'blue' },
  TO_PHO:    { label: 'Tổ phó',    variant: 'amber' },
  THANH_VIEN:{ label: 'Thành viên', variant: 'default' },
}
const VAI_TRO_TABS = ['Tất cả', 'Tổ trưởng', 'Tổ phó', 'Thành viên']
const VAI_TRO_BY_TAB = { 'Tổ trưởng': 'TO_TRUONG', 'Tổ phó': 'TO_PHO', 'Thành viên': 'THANH_VIEN' }
const EMPTY = { villageId: '', hoTen: '', chucDanh: '', vaiTro: 'THANH_VIEN', sdt: '', ghiChu: '' }

export default function LanhDaoThon() {
  const [officials, setOfficials] = useState([])
  const [villages, setVillages]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [tab, setTab]             = useState('Tất cả')
  const [villageFilter, setVillageFilter] = useState('')

  const [showAdd, setShowAdd]     = useState(false)
  const [addForm, setAddForm]     = useState(EMPTY)
  const [addErr, setAddErr]       = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [showEdit, setShowEdit]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState(EMPTY)
  const [editErr, setEditErr]     = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([officialService.getAll(), villageService.getAll()])
      .then(([o, v]) => { setOfficials(o.data.data || []); setVillages(v.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const vaiTro = VAI_TRO_BY_TAB[tab]
    return officials.filter(o => {
      if (vaiTro && o.vaiTro !== vaiTro) return false
      if (villageFilter && o.villageId !== villageFilter) return false
      if (!q) return true
      return o.hoTen?.toLowerCase().includes(q) || o.chucDanh?.toLowerCase().includes(q) || o.sdt?.includes(q)
    })
  }, [officials, search, tab, villageFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    villages.forEach(v => map.set(v.id, { village: v, items: [] }))
    filtered.forEach(o => {
      if (!map.has(o.villageId)) map.set(o.villageId, { village: o.village, items: [] })
      map.get(o.villageId).items.push(o)
    })
    return [...map.values()]
      .filter(g => g.items.length > 0 || (!search && !villageFilter && tab === 'Tất cả'))
      .sort((a, b) => (a.village?.ma || '').localeCompare(b.village?.ma || ''))
  }, [villages, filtered, search, villageFilter, tab])

  const truongThonCount = officials.filter(o => o.vaiTro === 'TO_TRUONG').length
  const toPhoCount      = officials.filter(o => o.vaiTro === 'TO_PHO').length
  const villageCovered  = new Set(officials.map(o => o.villageId)).size

  /* Add */
  const openAdd = (villageId = '') => { setAddForm({ ...EMPTY, villageId }); setAddErr(''); setShowAdd(true) }
  const handleAdd = async () => {
    if (!addForm.villageId)      { setAddErr('Vui lòng chọn thôn'); return }
    if (!addForm.hoTen.trim())   { setAddErr('Vui lòng nhập họ tên'); return }
    if (!addForm.chucDanh.trim()){ setAddErr('Vui lòng nhập chức danh'); return }
    setAddSaving(true); setAddErr('')
    try { await officialService.create(addForm); setShowAdd(false); load() }
    catch (e) { setAddErr(e.response?.data?.message || 'Thêm thất bại') }
    finally { setAddSaving(false) }
  }

  /* Edit */
  const openEdit = o => {
    setEditId(o.id)
    setEditForm({ villageId: o.villageId, hoTen: o.hoTen, chucDanh: o.chucDanh, vaiTro: o.vaiTro, sdt: o.sdt || '', ghiChu: o.ghiChu || '' })
    setEditErr(''); setShowEdit(true)
  }
  const handleEdit = async () => {
    if (!editForm.hoTen.trim())   { setEditErr('Vui lòng nhập họ tên'); return }
    if (!editForm.chucDanh.trim()){ setEditErr('Vui lòng nhập chức danh'); return }
    setEditSaving(true); setEditErr('')
    try { await officialService.update(editId, editForm); setShowEdit(false); load() }
    catch (e) { setEditErr(e.response?.data?.message || 'Cập nhật thất bại') }
    finally { setEditSaving(false) }
  }

  /* Delete */
  const handleDelete = async o => {
    if (!window.confirm(`Xóa "${o.hoTen}" (${o.chucDanh}) khỏi danh sách cán bộ thôn?`)) return
    try { await officialService.remove(o.id); load() }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  const villageOpts = [{ value: '', label: '-- Chọn thôn --' }, ...villages.map(v => ({ value: v.id, label: v.ten }))]
  const vaiTroOpts = [
    { value: 'TO_TRUONG', label: 'Tổ trưởng' },
    { value: 'TO_PHO', label: 'Tổ phó' },
    { value: 'THANH_VIEN', label: 'Thành viên' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Lãnh đạo thôn"
        subtitle="Ban lãnh đạo & Tổ Công nghệ số cộng đồng (CNSCĐ) theo từng thôn"
        action={<PrimaryBtn onClick={() => openAdd()}><Plus size={14} /> Thêm cán bộ</PrimaryBtn>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Thôn có dữ liệu" value={villageCovered} icon={ShieldCheck} iconColor="#2563eb" />
        <StatCard label="Tổng số cán bộ"  value={officials.length} icon={Users2}      iconColor="#7c3aed" />
        <StatCard label="Trưởng thôn"     value={truongThonCount}  icon={Crown}       iconColor="#16a34a" />
        <StatCard label="Tổ phó"          value={toPhoCount}       icon={Users2}      iconColor="#d97706" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={VAI_TRO_TABS} active={tab} onChange={setTab} />
          <div className="flex items-center gap-2">
            <select value={villageFilter} onChange={e => setVillageFilter(e.target.value)}
              className="px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring outline-none">
              <option value="">Tất cả thôn</option>
              {villages.map(v => <option key={v.id} value={v.id}>{v.ten}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, chức danh, SĐT..." />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-16">Đang tải...</p>
      ) : grouped.length === 0 ? (
        <div className="table-panel">
          <p className="text-sm text-muted-foreground text-center py-16">Không tìm thấy cán bộ phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {grouped.map(g => (
            <VillageCard key={g.village?.id} village={g.village} items={g.items} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal Thêm cán bộ */}
      <Modal title="Thêm cán bộ thôn" open={showAdd} onClose={() => setShowAdd(false)}
        footer={<><SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Đang lưu...' : 'Thêm'}</PrimaryBtn></>}>
        {addErr && <ErrBox msg={addErr} />}
        <Select label="Thôn" required value={addForm.villageId} onChange={v => setAddForm(f => ({ ...f, villageId: v }))} options={villageOpts} />
        <FormInput label="Họ và tên" required placeholder="Nguyễn Văn A" value={addForm.hoTen} onChange={e => setAddForm(f => ({ ...f, hoTen: e.target.value }))} />
        <FormInput label="Chức danh" required placeholder="Trưởng thôn, Bí thư Chi đoàn..." value={addForm.chucDanh} onChange={e => setAddForm(f => ({ ...f, chucDanh: e.target.value }))} />
        <Select label="Vai trò trong Tổ CNSCĐ" value={addForm.vaiTro} onChange={v => setAddForm(f => ({ ...f, vaiTro: v }))} options={vaiTroOpts} />
        <FormInput label="Số điện thoại" placeholder="0901234567" value={addForm.sdt} onChange={e => setAddForm(f => ({ ...f, sdt: e.target.value }))} />
        <FormInput label="Ghi chú" placeholder="Thông tin bổ sung..." value={addForm.ghiChu} onChange={e => setAddForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>

      {/* Modal Chỉnh sửa */}
      <Modal title="Chỉnh sửa cán bộ thôn" open={showEdit} onClose={() => setShowEdit(false)}
        footer={<><SecondaryBtn onClick={() => setShowEdit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</PrimaryBtn></>}>
        {editErr && <ErrBox msg={editErr} />}
        <Select label="Thôn" value={editForm.villageId} onChange={v => setEditForm(f => ({ ...f, villageId: v }))} options={villageOpts} />
        <FormInput label="Họ và tên" required value={editForm.hoTen} onChange={e => setEditForm(f => ({ ...f, hoTen: e.target.value }))} />
        <FormInput label="Chức danh" required value={editForm.chucDanh} onChange={e => setEditForm(f => ({ ...f, chucDanh: e.target.value }))} />
        <Select label="Vai trò trong Tổ CNSCĐ" value={editForm.vaiTro} onChange={v => setEditForm(f => ({ ...f, vaiTro: v }))} options={vaiTroOpts} />
        <FormInput label="Số điện thoại" value={editForm.sdt} onChange={e => setEditForm(f => ({ ...f, sdt: e.target.value }))} />
        <FormInput label="Ghi chú" value={editForm.ghiChu} onChange={e => setEditForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>
    </div>
  )
}

function VillageCard({ village, items, onAdd, onEdit, onDelete }) {
  const truongThon = items.find(o => o.vaiTro === 'TO_TRUONG')
  const sorted = [...items].sort((a, b) => {
    const order = { TO_TRUONG: 0, TO_PHO: 1, THANH_VIEN: 2 }
    return (order[a.vaiTro] ?? 3) - (order[b.vaiTro] ?? 3) || (a.thuTu ?? 0) - (b.thuTu ?? 0)
  })

  return (
    <div className="table-panel">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{village?.ten ?? '—'}</p>
          <p className="text-xs text-muted-foreground truncate">
            {truongThon ? `Trưởng thôn: ${truongThon.hoTen}` : 'Chưa có trưởng thôn'}
            {truongThon?.sdt && ` · ${truongThon.sdt}`}
          </p>
        </div>
        <button onClick={() => onAdd(village?.id)}
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 shrink-0"
          title="Thêm cán bộ vào thôn này">
          <Plus size={14} />
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chưa có cán bộ nào</p>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map(o => {
            const vt = VAI_TRO_LABEL[o.vaiTro] || VAI_TRO_LABEL.THANH_VIEN
            return (
              <div key={o.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{o.hoTen}</p>
                    <Badge variant={vt.variant}>{vt.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{o.chucDanh}</p>
                </div>
                {o.sdt && (
                  <a href={`tel:${o.sdt}`} className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary shrink-0">
                    <Phone size={12} /> {o.sdt}
                  </a>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(o)} className="p-1.5 rounded-md hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa"><Pencil size={13} /></button>
                  <button onClick={() => onDelete(o)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Xóa"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ErrBox({ msg }) {
  return <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">{msg}</p>
}
