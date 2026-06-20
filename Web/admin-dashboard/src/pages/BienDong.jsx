import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Users,
} from 'lucide-react'
import {
  PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs,
  StatCard, Badge, Modal, Select, FormInput,
} from '../components/ui'
import * as movementService from '../services/movementService'
import * as householdService from '../services/householdService'
import * as villageService from '../services/villageService'
import * as reportService from '../services/reportService'

const TAB_FILTER = {
  'Tất cả':       {},
  'Chuyển đến':   { loai: 'MOVE_IN' },
  'Chuyển đi':    { loai: 'MOVE_OUT' },
}
const COLUMNS  = ['Hộ khẩu', 'Thôn', 'Loại', 'Ngày', 'Nguồn gốc / Nơi đến', 'Ghi chú', 'Người thực hiện', '']
const EMPTY    = { householdId: '', loai: 'MOVE_IN', ngay: new Date().toISOString().slice(0, 10), nguonGoc: '', noiDen: '', ghiChu: '' }

export default function BienDong() {
  const [tab, setTab]               = useState('Tất cả')
  const [villageId, setVillageId]   = useState('')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')
  const [page, setPage]             = useState(1)
  const [movements, setMovements]   = useState([])
  const [pagination, setPag]        = useState({ total: 0, totalPages: 1 })
  const [stats, setStats]           = useState({ moveIn: 0, moveOut: 0, net: 0 })
  const [loading, setLoading]       = useState(true)
  const [villages, setVillages]     = useState([])
  const [households, setHouseholds] = useState([])

  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState(EMPTY)
  const [addErr, setAddErr]         = useState('')
  const [addSaving, setAddSaving]   = useState(false)

  const [showEdit, setShowEdit]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [editForm, setEditForm]     = useState(EMPTY)
  const [editErr, setEditErr]       = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const res = await reportService.getMovements({ fromDate: fromDate || undefined, toDate: toDate || undefined })
      setStats(res.data.data || { moveIn: 0, moveOut: 0, net: 0 })
    } catch { /* ignore */ }
  }, [fromDate, toDate])

  const loadList = useCallback(async (t, vId, fd, td, p) => {
    setLoading(true)
    try {
      const params = {
        ...TAB_FILTER[t],
        villageId: vId || undefined,
        fromDate: fd || undefined,
        toDate: td || undefined,
        page: p,
        limit: 20,
      }
      const res = await movementService.getAll(params)
      setMovements(res.data.data || [])
      setPag(res.data.pagination || { total: 0, totalPages: 1 })
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadList(tab, villageId, fromDate, toDate, page) }, [tab, villageId, fromDate, toDate, page, loadList])
  useEffect(() => {
    villageService.getAll().then(r => setVillages(r.data.data || [])).catch(() => {})
    householdService.getAll({ limit: 500 }).then(r => setHouseholds(r.data.data || [])).catch(() => {})
  }, [])

  const refresh = () => Promise.all([loadStats(), loadList(tab, villageId, fromDate, toDate, page)])

  /* ── Add ── */
  const openAdd = () => { setAddForm(EMPTY); setAddErr(''); setShowAdd(true) }
  const handleAdd = async () => {
    if (!addForm.householdId) { setAddErr('Vui lòng chọn hộ dân'); return }
    if (!addForm.ngay)        { setAddErr('Vui lòng chọn ngày'); return }
    setAddSaving(true); setAddErr('')
    try { await movementService.create(addForm); setShowAdd(false); await refresh() }
    catch (e) { setAddErr(e.response?.data?.message || 'Ghi nhận thất bại') }
    finally { setAddSaving(false) }
  }

  /* ── Edit ── */
  const openEdit = mv => {
    setEditId(mv.id)
    setEditForm({
      householdId: mv.householdId,
      loai: mv.loai,
      ngay: mv.ngay?.slice(0, 10) || '',
      nguonGoc: mv.nguonGoc || '',
      noiDen: mv.noiDen || '',
      ghiChu: mv.ghiChu || '',
    })
    setEditErr(''); setShowEdit(true)
  }
  const handleEdit = async () => {
    if (!editForm.ngay) { setEditErr('Vui lòng chọn ngày'); return }
    setEditSaving(true); setEditErr('')
    try { await movementService.update(editId, editForm); setShowEdit(false); await refresh() }
    catch (e) { setEditErr(e.response?.data?.message || 'Cập nhật thất bại') }
    finally { setEditSaving(false) }
  }

  /* ── Delete ── */
  const handleDelete = async mv => {
    if (!window.confirm(`Xóa bản ghi biến động của hộ "${mv.household?.soHoKhau}"?`)) return
    try { await movementService.remove(mv.id); await refresh() }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  const villageOpts   = [{ value: '', label: 'Tất cả thôn' }, ...villages.map(v => ({ value: v.id, label: v.ten }))]
  const householdOpts = [{ value: '', label: '-- Chọn hộ dân --' }, ...households.map(h => ({ value: h.id, label: `${h.soHoKhau} — ${h.diaChi}` }))]
  const loaiOpts      = [{ value: 'MOVE_IN', label: 'Chuyển đến (Move In)' }, { value: 'MOVE_OUT', label: 'Chuyển đi (Move Out)' }]

  const statCards = [
    { label: 'Chuyển đến',     value: stats.moveIn ?? 0,  icon: ArrowDownToLine, iconColor: '#16a34a' },
    { label: 'Chuyển đi',      value: stats.moveOut ?? 0, icon: ArrowUpFromLine, iconColor: '#dc2626' },
    { label: 'Biến động ròng', value: stats.net ?? 0,     icon: ArrowRightLeft,  iconColor: '#2563eb' },
    { label: 'Tổng bản ghi (trang này)', value: pagination.total ?? 0, icon: Users, iconColor: '#7c3aed' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Biến động dân cư"
        subtitle="Theo dõi hộ dân chuyển đến / chuyển đi toàn xã — UBND Xã Hòa Tiến"
        action={
          <PrimaryBtn onClick={openAdd}><Plus size={14} /> Ghi nhận biến động</PrimaryBtn>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="table-panel">
        <div className="table-toolbar flex-wrap gap-2">
          <Tabs tabs={['Tất cả', 'Chuyển đến', 'Chuyển đi']} active={tab} onChange={t => { setTab(t); setPage(1) }} />
          <div className="flex items-center gap-2">
            <select
              value={villageId}
              onChange={e => { setVillageId(e.target.value); setPage(1) }}
              className="px-3 py-1.5 rounded-md text-sm bg-card border border-input focus:border-ring outline-none"
            >
              {villageOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }}
              className="px-3 py-1.5 rounded-md text-sm bg-card border border-input focus:border-ring outline-none" />
            <span className="text-xs text-muted-foreground">→</span>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }}
              className="px-3 py-1.5 rounded-md text-sm bg-card border border-input focus:border-ring outline-none" />
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={!loading && movements.length === 0}>
          {loading ? (
            <tr><td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">Đang tải...</td></tr>
          ) : movements.map(mv => (
            <tr key={mv.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
              <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{mv.household?.soHoKhau ?? '—'}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{mv.household?.village?.ten ?? '—'}</td>
              <td className="px-5 py-3">
                <Badge variant={mv.loai === 'MOVE_IN' ? 'green' : 'red'}>
                  {mv.loai === 'MOVE_IN' ? 'Chuyển đến' : 'Chuyển đi'}
                </Badge>
              </td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{new Date(mv.ngay).toLocaleDateString('vi-VN')}</td>
              <td className="px-5 py-3 text-sm text-foreground max-w-[220px] truncate">
                {mv.nguonGoc ? `Từ: ${mv.nguonGoc}` : ''} {mv.noiDen ? `Đến: ${mv.noiDen}` : ''}
              </td>
              <td className="px-5 py-3 text-sm text-muted-foreground max-w-[180px] truncate">{mv.ghiChu || '—'}</td>
              <td className="px-5 py-3 text-sm text-muted-foreground">{mv.performedBy?.hoTen ?? '—'}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(mv)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa"><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(mv)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors" title="Xóa"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">Hiển thị {movements.length} / {pagination.total} bản ghi</span>
          <div className="flex gap-1">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => (
              <button key={i + 1} className={`page-btn ${i + 1 === page ? 'page-btn-active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* ══ Modal Ghi nhận biến động ══ */}
      <Modal title="Ghi nhận biến động dân cư" open={showAdd} onClose={() => setShowAdd(false)}
        footer={<><SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Đang lưu...' : 'Ghi nhận'}</PrimaryBtn></>}>
        {addErr && <ErrBox msg={addErr} />}
        <Select label="Hộ dân" required value={addForm.householdId} onChange={v => setAddForm(f => ({ ...f, householdId: v }))} options={householdOpts} />
        <Select label="Loại biến động" value={addForm.loai} onChange={v => setAddForm(f => ({ ...f, loai: v }))} options={loaiOpts} />
        <FormInput label="Ngày" type="date" required value={addForm.ngay} onChange={e => setAddForm(f => ({ ...f, ngay: e.target.value }))} />
        <FormInput label="Nơi chuyển từ (nguồn gốc)" placeholder="Quận Hải Châu, Đà Nẵng..." value={addForm.nguonGoc} onChange={e => setAddForm(f => ({ ...f, nguonGoc: e.target.value }))} />
        <FormInput label="Nơi chuyển đến" placeholder="Phường Hòa Thọ Đông..." value={addForm.noiDen} onChange={e => setAddForm(f => ({ ...f, noiDen: e.target.value }))} />
        <FormInput label="Ghi chú" placeholder="Thông tin bổ sung..." value={addForm.ghiChu} onChange={e => setAddForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>

      {/* ══ Modal Chỉnh sửa biến động ══ */}
      <Modal title="Chỉnh sửa biến động" open={showEdit} onClose={() => setShowEdit(false)}
        footer={<><SecondaryBtn onClick={() => setShowEdit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</PrimaryBtn></>}>
        {editErr && <ErrBox msg={editErr} />}
        <p className="text-xs text-muted-foreground">
          Hộ dân: <span className="font-semibold text-foreground">{householdOpts.find(o => o.value === editForm.householdId)?.label ?? '—'}</span>
        </p>
        <Select label="Loại biến động" value={editForm.loai} onChange={v => setEditForm(f => ({ ...f, loai: v }))} options={loaiOpts} />
        <FormInput label="Ngày" type="date" required value={editForm.ngay} onChange={e => setEditForm(f => ({ ...f, ngay: e.target.value }))} />
        <FormInput label="Nơi chuyển từ (nguồn gốc)" value={editForm.nguonGoc} onChange={e => setEditForm(f => ({ ...f, nguonGoc: e.target.value }))} />
        <FormInput label="Nơi chuyển đến" value={editForm.noiDen} onChange={e => setEditForm(f => ({ ...f, noiDen: e.target.value }))} />
        <FormInput label="Ghi chú" value={editForm.ghiChu} onChange={e => setEditForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>
    </div>
  )
}

function ErrBox({ msg }) {
  return <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">{msg}</p>
}
