import '../styles/ho-so.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Filter, Home, Users, ArrowRightLeft, CheckCircle,
  Eye, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, History, Scissors, GitMerge,
} from 'lucide-react'
import {
  PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs,
  SearchInput, StatCard, Badge, Modal, Select, FormInput,
} from '../components/ui'
import * as householdService from '../services/householdService'
import * as memberService    from '../services/memberService'
import * as movementService  from '../services/movementService'
import * as villageService   from '../services/villageService'

/* ── Lookups ── */
const LOAI_HO_LABEL = {
  THUONG_TRU: { label: 'Thường trú', variant: 'green' },
  TAM_TRU:    { label: 'Tạm trú',    variant: 'amber' },
  TAM_VANG:   { label: 'Tạm vắng',  variant: 'orange' },
}
const TRANG_THAI_LABEL = {
  ACTIVE:      { label: 'Đang hoạt động', variant: 'green' },
  DA_TACH:     { label: 'Đã tách',        variant: 'amber' },
  DA_GIAI_THE: { label: 'Đã giải thể',    variant: 'red' },
}
const TAB_FILTER = {
  'Tất cả':     {},
  'Thường trú': { loaiHo: 'THUONG_TRU' },
  'Tạm trú':    { loaiHo: 'TAM_TRU' },
  'Tạm vắng':  { loaiHo: 'TAM_VANG' },
}
const COLUMNS    = ['Số HK', 'Địa chỉ', 'Thôn', 'Tổ', 'Loại hộ', 'Nhân khẩu', 'Trạng thái', '']
const EMPTY_HH   = { soHoKhau: '', diaChi: '', to: '', villageId: '', loaiHo: 'THUONG_TRU', trangThai: 'ACTIVE' }
const EMPTY_MEM  = { hoTen: '', ngaySinh: '', gioiTinh: 'NAM', cccd: '', sdt: '', quanHeChuHo: '', laChuHo: false }
const NO_INFO    = 'Không có thông tin'
const GENDER_LABEL = { NAM: 'Nam', NU: 'Nữ', KHAC: 'Khác' }

/* ══════════════════════════════════════════════════════════════ */
export default function HoSo() {
  const [tab, setTab]           = useState('Tất cả')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [households, setHH]     = useState([])
  const [pagination, setPag]    = useState({ total: 0, totalPages: 1 })
  const [stats, setStats]       = useState({ all: 0, thuongTru: 0, tamTru: 0, tamVang: 0 })
  const [loading, setLoading]   = useState(true)
  const [villages, setVillages] = useState([])
  const [villageFilter, setVillageFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [toOptions, setToOptions] = useState([])
  const debounce = useRef(null)

  /* Add modal */
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState(EMPTY_HH)
  const [addErr, setAddErr]     = useState('')
  const [addSaving, setAddSaving] = useState(false)

  /* Edit modal */
  const [showEdit, setShowEdit] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_HH)
  const [editErr, setEditErr]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  /* Detail modal */
  const [showDetail, setShowDetail]   = useState(false)
  const [detailHH, setDetailHH]       = useState(null)
  const [detailTab, setDetailTab]     = useState('Tổng quan')
  const [movements, setMovements]     = useState([])
  const [history, setHistory]         = useState([])
  const [detailLoading, setDL]        = useState(false)

  /* Add member modal (inside detail) */
  const [showAddMem, setShowAddMem]   = useState(false)
  const [memForm, setMemForm]         = useState(EMPTY_MEM)
  const [memErr, setMemErr]           = useState('')
  const [memSaving, setMemSaving]     = useState(false)

  /* Movement modal (UC08/09) */
  const [showMov, setShowMov]     = useState(false)
  const [movForm, setMovForm]     = useState({ loai: 'MOVE_IN', ngay: new Date().toISOString().slice(0,10), nguonGoc: '', noiDen: '', ghiChu: '' })
  const [movErr, setMovErr]       = useState('')
  const [movSaving, setMovSaving] = useState(false)

  /* Movement edit modal (UC08/09) */
  const [showMovEdit, setShowMovEdit]   = useState(false)
  const [editMovId, setEditMovId]       = useState(null)
  const [editMovForm, setEditMovForm]   = useState({ loai: 'MOVE_IN', ngay: '', nguonGoc: '', noiDen: '', ghiChu: '' })
  const [editMovErr, setEditMovErr]     = useState('')
  const [editMovSaving, setEditMovSaving] = useState(false)

  /* Split modal (UC05) */
  const [showSplit, setShowSplit]       = useState(false)
  const [splitSelected, setSplitSel]   = useState([])
  const [splitErr, setSplitErr]         = useState('')
  const [splitSaving, setSplitSaving]   = useState(false)

  /* Merge modal (UC06) */
  const [showMerge, setShowMerge]         = useState(false)
  const [mergeAll, setMergeAll]           = useState([])
  const [mergeLoading, setMergeLoading]   = useState(false)
  const [mergeTarget, setMergeTarget]     = useState('')
  const [mergeSources, setMergeSources]   = useState(new Set())
  const [mergeSearchT, setMergeSearchT]   = useState('')
  const [mergeSearchS, setMergeSearchS]   = useState('')
  const [mergeNote, setMergeNote]         = useState('')
  const [mergeErr, setMergeErr]           = useState('')
  const [mergeSaving, setMergeSaving]     = useState(false)

  /* ── Loaders ── */
  const loadStats = useCallback(async () => {
    try {
      const [all, tt, tr, tv] = await Promise.all([
        householdService.getAll({ page: 1, limit: 1 }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'THUONG_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_VANG' }),
      ])
      setStats({ all: all.data.pagination.total, thuongTru: tt.data.pagination.total, tamTru: tr.data.pagination.total, tamVang: tv.data.pagination.total })
    } catch { /* ignore */ }
  }, [])

  const loadList = useCallback(async (t, s, p, vId, toVal) => {
    setLoading(true)
    try {
      let res
      if (s.trim()) {
        res = await householdService.search(s.trim())
        setHH(res.data.data || [])
        setPag({ total: res.data.data?.length ?? 0, totalPages: 1 })
      } else {
        res = await householdService.getAll({
          ...TAB_FILTER[t],
          ...(vId && { villageId: vId }),
          ...(toVal && { to: toVal }),
          page: p, limit: 20,
        })
        setHH(res.data.data || [])
        setPag(res.data.pagination || { total: 0, totalPages: 1 })
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(tab, search, page, villageFilter, toFilter) }, [tab, page, villageFilter, toFilter])
  useEffect(() => {
    villageService.getAll().then(r => setVillages(r.data.data || [])).catch(() => {})
  }, [])
  useEffect(() => {
    householdService.getToList(villageFilter || undefined)
      .then(r => setToOptions(r.data.data || []))
      .catch(() => setToOptions([]))
  }, [villageFilter])

  const handleSearch = v => {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setPage(1); loadList(tab, v, 1, villageFilter, toFilter) }, 400)
  }
  const handleVillageFilter = v => { setVillageFilter(v); setToFilter(''); setPage(1) }
  const handleToFilter = v => { setToFilter(v); setPage(1) }
  const refresh = () => Promise.all([loadStats(), loadList(tab, search, page, villageFilter, toFilter)])

  /* ── Household CRUD ── */
  const openAdd = () => { setAddForm(EMPTY_HH); setAddErr(''); setShowAdd(true) }
  const handleAdd = async () => {
    if (!addForm.soHoKhau.trim()) { setAddErr('Vui lòng nhập số hộ khẩu'); return }
    if (!addForm.diaChi.trim())   { setAddErr('Vui lòng nhập địa chỉ'); return }
    if (!addForm.villageId)       { setAddErr('Vui lòng chọn thôn'); return }
    setAddSaving(true); setAddErr('')
    try { await householdService.create(addForm); setShowAdd(false); await refresh() }
    catch (e) { setAddErr(e.response?.data?.message || 'Tạo thất bại') }
    finally { setAddSaving(false) }
  }

  const openEdit = h => {
    setEditId(h.id)
    setEditForm({ soHoKhau: h.soHoKhau, diaChi: h.diaChi, to: h.to || '', villageId: h.village?.id || h.villageId, loaiHo: h.loaiHo, trangThai: h.trangThai })
    setEditErr(''); setShowEdit(true)
  }
  const handleEdit = async () => {
    if (!editForm.soHoKhau.trim()) { setEditErr('Vui lòng nhập số hộ khẩu'); return }
    if (!editForm.diaChi.trim())   { setEditErr('Vui lòng nhập địa chỉ'); return }
    setEditSaving(true); setEditErr('')
    try { await householdService.update(editId, editForm); setShowEdit(false); await refresh() }
    catch (e) { setEditErr(e.response?.data?.message || 'Cập nhật thất bại') }
    finally { setEditSaving(false) }
  }

  const handleDelete = async h => {
    if (!window.confirm(`Xóa hộ "${h.soHoKhau}"? Hành động này không thể hoàn tác.`)) return
    try { await householdService.remove(h.id); await refresh() }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  /* ── Detail modal ── */
  const openDetail = async h => {
    setDetailHH(h); setDetailTab('Tổng quan'); setShowDetail(true)
    setDL(true)
    try {
      const [full, mov, hist] = await Promise.all([
        householdService.getById(h.id),
        movementService.getAll({ householdId: h.id, limit: 50 }),
        householdService.getHistory(h.id),
      ])
      setDetailHH(full.data.data || h)
      setMovements(mov.data.data || [])
      setHistory(hist.data.data || [])
    } catch { /* ignore */ } finally { setDL(false) }
  }
  const reloadDetail = async () => {
    if (!detailHH) return
    setDL(true)
    try {
      const [full, mov, hist] = await Promise.all([
        householdService.getById(detailHH.id),
        movementService.getAll({ householdId: detailHH.id, limit: 50 }),
        householdService.getHistory(detailHH.id),
      ])
      setDetailHH(full.data.data)
      setMovements(mov.data.data || [])
      setHistory(hist.data.data || [])
    } catch { /* ignore */ } finally { setDL(false) }
  }

  /* ── Member CRUD (UC04) ── */
  const openAddMem = () => { setMemForm(EMPTY_MEM); setMemErr(''); setShowAddMem(true) }
  const handleAddMem = async () => {
    if (!memForm.hoTen.trim())                            { setMemErr('Vui lòng nhập họ tên'); return }
    if (!memForm.laChuHo && !memForm.quanHeChuHo.trim())  { setMemErr('Vui lòng nhập quan hệ chủ hộ'); return }
    setMemSaving(true); setMemErr('')
    try {
      const payload = {
        ...memForm,
        householdId: detailHH.id,
        ngaySinh: memForm.ngaySinh ? new Date(memForm.ngaySinh).toISOString() : null,
        cccd: memForm.cccd.trim() || null,
        sdt: memForm.sdt.trim() || null,
      }
      await memberService.create(payload)
      setShowAddMem(false)
      await Promise.all([reloadDetail(), refresh()])
    } catch (e) { setMemErr(e.response?.data?.message || 'Thêm thất bại') }
    finally { setMemSaving(false) }
  }
  const handleDeleteMem = async m => {
    if (!window.confirm(`Xóa thành viên "${m.hoTen}"?`)) return
    try { await memberService.remove(m.id); await Promise.all([reloadDetail(), refresh()]) }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  /* ── Movement (UC08/09) ── */
  const openMov = () => { setMovForm({ loai: 'MOVE_IN', ngay: new Date().toISOString().slice(0,10), nguonGoc: '', noiDen: '', ghiChu: '' }); setMovErr(''); setShowMov(true) }
  const handleMov = async () => {
    setMovSaving(true); setMovErr('')
    try {
      await movementService.create({ ...movForm, householdId: detailHH.id })
      setShowMov(false)
      await reloadDetail()
    } catch (e) { setMovErr(e.response?.data?.message || 'Ghi nhận thất bại') }
    finally { setMovSaving(false) }
  }

  const openMovEdit = mv => {
    setEditMovId(mv.id)
    setEditMovForm({
      loai: mv.loai,
      ngay: mv.ngay?.slice(0, 10) || '',
      nguonGoc: mv.nguonGoc || '',
      noiDen: mv.noiDen || '',
      ghiChu: mv.ghiChu || '',
    })
    setEditMovErr(''); setShowMovEdit(true)
  }
  const handleMovEdit = async () => {
    setEditMovSaving(true); setEditMovErr('')
    try {
      await movementService.update(editMovId, editMovForm)
      setShowMovEdit(false)
      await reloadDetail()
    } catch (e) { setEditMovErr(e.response?.data?.message || 'Cập nhật thất bại') }
    finally { setEditMovSaving(false) }
  }
  const handleDeleteMov = async mv => {
    if (!window.confirm('Xóa bản ghi biến động này?')) return
    try { await movementService.remove(mv.id); await reloadDetail() }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  /* ── Split (UC05) ── */
  const openSplit = () => { setSplitSel([]); setSplitErr(''); setShowSplit(true) }
  const toggleSplitMem = id => setSplitSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const handleSplit = async () => {
    if (splitSelected.length === 0) { setSplitErr('Chọn ít nhất 1 thành viên để tách'); return }
    setSplitSaving(true); setSplitErr('')
    try {
      await householdService.split(detailHH.id, { memberIds: splitSelected })
      setShowSplit(false); setShowDetail(false)
      await refresh()
      alert('Tách hộ thành công!')
    } catch (e) { setSplitErr(e.response?.data?.message || 'Tách hộ thất bại') }
    finally { setSplitSaving(false) }
  }

  /* ── Merge (UC06) ── */
  const openMerge = async () => {
    setMergeTarget(''); setMergeSources(new Set())
    setMergeSearchT(''); setMergeSearchS('')
    setMergeNote(''); setMergeErr('')
    setShowMerge(true); setMergeLoading(true)
    try {
      const res = await householdService.getAll({ limit: 500 })
      setMergeAll(res.data.data || [])
    } catch { /* ignore */ } finally { setMergeLoading(false) }
  }
  const toggleMergeSource = id => setMergeSources(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const handleMerge = async () => {
    if (!mergeTarget)           { setMergeErr('Vui lòng chọn hộ nhận'); return }
    if (mergeSources.size === 0){ setMergeErr('Vui lòng chọn ít nhất 1 hộ để gộp vào'); return }
    setMergeSaving(true); setMergeErr('')
    try {
      const res = await householdService.merge({ targetId: mergeTarget, sourceIds: [...mergeSources], ghiChu: mergeNote })
      setShowMerge(false)
      await refresh()
      alert(res.data.message || 'Gộp hộ thành công!')
    } catch (e) { setMergeErr(e.response?.data?.message || 'Gộp hộ thất bại') }
    finally { setMergeSaving(false) }
  }
  const mergeTargetHH  = mergeAll.find(h => h.id === mergeTarget)
  const filteredTargets = mergeAll.filter(h => {
    const q = mergeSearchT.toLowerCase()
    return !q || h.soHoKhau.toLowerCase().includes(q) || h.diaChi.toLowerCase().includes(q)
  })
  const filteredSources = mergeAll.filter(h => {
    if (h.id === mergeTarget) return false
    const q = mergeSearchS.toLowerCase()
    return !q || h.soHoKhau.toLowerCase().includes(q) || h.diaChi.toLowerCase().includes(q)
  })
  const totalMergeMembers = [...mergeSources].reduce((s, id) => {
    const h = mergeAll.find(x => x.id === id)
    return s + (h?.members?.length ?? 0)
  }, 0)

  /* ── Options ── */
  const villageOpts  = [{ value: '', label: '-- Chọn thôn --' }, ...villages.map(v => ({ value: v.id, label: v.ten }))]
  const loaiHoOpts   = [{ value: 'THUONG_TRU', label: 'Thường trú' }, { value: 'TAM_TRU', label: 'Tạm trú' }, { value: 'TAM_VANG', label: 'Tạm vắng' }]
  const trangThaiOpts = [{ value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'DA_TACH', label: 'Đã tách' }, { value: 'DA_GIAI_THE', label: 'Đã giải thể' }]
  const gioiTinhOpts = [{ value: 'NAM', label: 'Nam' }, { value: 'NU', label: 'Nữ' }, { value: 'KHAC', label: 'Khác' }]

  const statCards = [
    { label: 'Tổng hộ dân', value: stats.all,      icon: Home,           iconColor: '#2563eb' },
    { label: 'Thường trú',  value: stats.thuongTru, icon: CheckCircle,    iconColor: '#16a34a' },
    { label: 'Tạm trú',     value: stats.tamTru,    icon: Users,          iconColor: '#d97706' },
    { label: 'Tạm vắng',   value: stats.tamVang,   icon: ArrowRightLeft, iconColor: '#7c3aed' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý hộ dân"
        subtitle="Danh sách hộ khẩu — UBND Xã Hòa Tiến"
        action={
          <div className="flex items-center gap-2">
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
            <SecondaryBtn onClick={openMerge}><GitMerge size={14} /> Gộp hộ</SecondaryBtn>
            <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm hộ dân</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs tabs={['Tất cả', 'Thường trú', 'Tạm trú', 'Tạm vắng']} active={tab} onChange={t => { setTab(t); setPage(1) }} />
          <div className="flex items-center gap-2">
            <select value={villageFilter} onChange={e => handleVillageFilter(e.target.value)}
              className="px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring outline-none">
              <option value="">Tất cả thôn</option>
              {villages.map(v => <option key={v.id} value={v.id}>{v.ten}</option>)}
            </select>
            <select value={toFilter} onChange={e => handleToFilter(e.target.value)}
              disabled={toOptions.length === 0}
              className="px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring outline-none disabled:opacity-50">
              <option value="">Tất cả tổ</option>
              {toOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <SearchInput value={search} onChange={handleSearch} placeholder="Tìm số HK, địa chỉ..." />
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={!loading && households.length === 0}>
          {loading ? (
            <tr><td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">Đang tải...</td></tr>
          ) : households.map(h => {
            const loai = LOAI_HO_LABEL[h.loaiHo] || { label: h.loaiHo, variant: 'default' }
            const tt   = TRANG_THAI_LABEL[h.trangThai] || { label: h.trangThai, variant: 'default' }
            return (
              <tr key={h.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{h.soHoKhau}</td>
                <td className="px-5 py-3 text-sm text-foreground max-w-[200px] truncate">{h.diaChi}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{h.village?.ten ?? '—'}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{h.to ?? '—'}</td>
                <td className="px-5 py-3"><Badge variant={loai.variant}>{loai.label}</Badge></td>
                <td className="px-5 py-3 text-sm">{h.members?.length ?? 0} người</td>
                <td className="px-5 py-3"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openDetail(h)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors" title="Xem chi tiết"><Eye size={13} /></button>
                    <button onClick={() => openEdit(h)}   className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(h)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors" title="Xóa"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">Hiển thị {households.length} / {pagination.total} hộ dân</span>
          <div className="flex gap-1">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => (
              <button key={i+1} className={`page-btn ${i+1 === page ? 'page-btn-active' : ''}`} onClick={() => setPage(i+1)}>{i+1}</button>
            ))}
            <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* ══ Modal Thêm hộ ══ */}
      <Modal title="Thêm hộ dân mới" open={showAdd} onClose={() => setShowAdd(false)}
        footer={<><SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Đang lưu...' : 'Thêm hộ dân'}</PrimaryBtn></>}>
        {addErr && <ErrBox msg={addErr} />}
        <FormInput label="Số hộ khẩu" required placeholder="VD: HK-001" value={addForm.soHoKhau} onChange={e => setAddForm(f => ({ ...f, soHoKhau: e.target.value }))} />
        <FormInput label="Địa chỉ" required placeholder="Số nhà, đường, thôn..." value={addForm.diaChi} onChange={e => setAddForm(f => ({ ...f, diaChi: e.target.value }))} />
        <FormInput label="Tổ" placeholder="VD: Tổ 1" value={addForm.to} onChange={e => setAddForm(f => ({ ...f, to: e.target.value }))} />
        <Select label="Thôn" required value={addForm.villageId} onChange={v => setAddForm(f => ({ ...f, villageId: v }))} options={villageOpts} />
        <Select label="Loại hộ" value={addForm.loaiHo} onChange={v => setAddForm(f => ({ ...f, loaiHo: v }))} options={loaiHoOpts} />
      </Modal>

      {/* ══ Modal Chỉnh sửa ══ */}
      <Modal title="Chỉnh sửa hộ dân" open={showEdit} onClose={() => setShowEdit(false)}
        footer={<><SecondaryBtn onClick={() => setShowEdit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</PrimaryBtn></>}>
        {editErr && <ErrBox msg={editErr} />}
        <FormInput label="Số hộ khẩu" required value={editForm.soHoKhau} onChange={e => setEditForm(f => ({ ...f, soHoKhau: e.target.value }))} />
        <FormInput label="Địa chỉ" required value={editForm.diaChi} onChange={e => setEditForm(f => ({ ...f, diaChi: e.target.value }))} />
        <FormInput label="Tổ" placeholder="VD: Tổ 1" value={editForm.to} onChange={e => setEditForm(f => ({ ...f, to: e.target.value }))} />
        <Select label="Thôn" value={editForm.villageId} onChange={v => setEditForm(f => ({ ...f, villageId: v }))} options={villageOpts} />
        <Select label="Loại hộ" value={editForm.loaiHo} onChange={v => setEditForm(f => ({ ...f, loaiHo: v }))} options={loaiHoOpts} />
        <Select label="Trạng thái" value={editForm.trangThai} onChange={v => setEditForm(f => ({ ...f, trangThai: v }))} options={trangThaiOpts} />
      </Modal>

      {/* ══ Modal Chi tiết (4 tabs) ══ */}
      <Modal title={`Hộ khẩu — ${detailHH?.soHoKhau ?? ''}`} open={showDetail} onClose={() => setShowDetail(false)}
        footer={
          <div className="flex items-center justify-between w-full">
            <button onClick={openSplit} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors">
              <Scissors size={13} /> Tách hộ (UC05)
            </button>
            <SecondaryBtn onClick={() => setShowDetail(false)}>Đóng</SecondaryBtn>
          </div>
        }>
        {detailHH && (
          <>
            <Tabs tabs={['Tổng quan', 'Nhân khẩu', 'Biến động', 'Lịch sử']} active={detailTab} onChange={setDetailTab} />
            <div className="mt-3">
              {detailLoading && <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>}

              {/* Tab Tổng quan */}
              {!detailLoading && detailTab === 'Tổng quan' && (
                <div className="space-y-2 text-sm">
                  {[
                    ['Số hộ khẩu', detailHH.soHoKhau],
                    ['Địa chỉ', detailHH.diaChi],
                    ['Thôn', detailHH.village?.ten ?? '—'],
                    ['Tổ', detailHH.to ?? '—'],
                    ['Loại hộ', LOAI_HO_LABEL[detailHH.loaiHo]?.label ?? detailHH.loaiHo],
                    ['Trạng thái', TRANG_THAI_LABEL[detailHH.trangThai]?.label ?? detailHH.trangThai],
                    ['Số nhân khẩu', `${detailHH.members?.length ?? 0} người`],
                    ['Ngày tạo', new Date(detailHH.createdAt).toLocaleDateString('vi-VN')],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Nhân khẩu (UC04) */}
              {!detailLoading && detailTab === 'Nhân khẩu' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <PrimaryBtn onClick={openAddMem}><Plus size={13} /> Thêm thành viên</PrimaryBtn>
                  </div>
                  {(detailHH.members?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có nhân khẩu</p>
                  ) : detailHH.members.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-secondary border border-border">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.hoTen} {m.laChuHo && <span className="ml-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Chủ hộ</span>}</p>
                        <p className="text-xs text-muted-foreground">{m.quanHeChuHo} · {m.gioiTinh ? GENDER_LABEL[m.gioiTinh] : NO_INFO} · {m.ngaySinh ? new Date(m.ngaySinh).toLocaleDateString('vi-VN') : NO_INFO}</p>
                        <p className="text-xs text-muted-foreground">CCCD: {m.cccd || NO_INFO}</p>
                        <p className="text-xs text-muted-foreground">SĐT: {m.sdt || NO_INFO}</p>
                      </div>
                      <button onClick={() => handleDeleteMem(m)} className="p-1.5 rounded hover:bg-card text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Biến động (UC08/09) */}
              {!detailLoading && detailTab === 'Biến động' && (
                <div className="space-y-2">
                  <div className="flex justify-end gap-2">
                    <PrimaryBtn onClick={openMov}><Plus size={13} /> Ghi nhận biến động</PrimaryBtn>
                  </div>
                  {movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có biến động nào</p>
                  ) : movements.map(mv => (
                    <div key={mv.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary border border-border">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${mv.loai === 'MOVE_IN' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {mv.loai === 'MOVE_IN' ? <ArrowDownToLine size={13} className="text-emerald-600" /> : <ArrowUpFromLine size={13} className="text-red-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground">{mv.loai === 'MOVE_IN' ? 'Chuyển đến' : 'Chuyển đi'}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(mv.ngay).toLocaleDateString('vi-VN')} {mv.nguonGoc ? `· Từ: ${mv.nguonGoc}` : ''} {mv.noiDen ? `· Đến: ${mv.noiDen}` : ''}</p>
                        {mv.ghiChu && <p className="text-[11px] text-muted-foreground">{mv.ghiChu}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openMovEdit(mv)} className="p-1.5 rounded hover:bg-card text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa"><Pencil size={12} /></button>
                        <button onClick={() => handleDeleteMov(mv)} className="p-1.5 rounded hover:bg-card text-muted-foreground hover:text-destructive transition-colors" title="Xóa"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Lịch sử (UC15) */}
              {!detailLoading && detailTab === 'Lịch sử' && (
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có lịch sử thay đổi</p>
                  ) : history.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-secondary border border-border">
                      <History size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{h.action}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(h.createdAt).toLocaleString('vi-VN')}</p>
                        {h.performedBy && <p className="text-[11px] text-muted-foreground">Bởi: {h.performedBy}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ══ Modal Thêm thành viên (UC04) ══ */}
      <Modal title="Thêm thành viên" open={showAddMem} onClose={() => setShowAddMem(false)}
        footer={<><SecondaryBtn onClick={() => setShowAddMem(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAddMem} disabled={memSaving}>{memSaving ? 'Đang lưu...' : 'Thêm'}</PrimaryBtn></>}>
        {memErr && <ErrBox msg={memErr} />}
        <FormInput label="Họ và tên" required placeholder="Nguyễn Văn A" value={memForm.hoTen} onChange={e => setMemForm(f => ({ ...f, hoTen: e.target.value }))} />
        <FormInput label="Ngày sinh" type="date" value={memForm.ngaySinh} onChange={e => setMemForm(f => ({ ...f, ngaySinh: e.target.value }))} />
        <Select label="Giới tính" value={memForm.gioiTinh} onChange={v => setMemForm(f => ({ ...f, gioiTinh: v }))} options={gioiTinhOpts} />
        <FormInput label="CCCD" placeholder="012345678910" value={memForm.cccd} onChange={e => setMemForm(f => ({ ...f, cccd: e.target.value }))} />
        <FormInput label="Số điện thoại" placeholder="0901234567" value={memForm.sdt} onChange={e => setMemForm(f => ({ ...f, sdt: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={memForm.laChuHo} onChange={e => setMemForm(f => ({ ...f, laChuHo: e.target.checked }))} className="rounded" />
          Là chủ hộ
        </label>
        <FormInput
          label="Quan hệ với chủ hộ"
          required={!memForm.laChuHo}
          disabled={memForm.laChuHo}
          placeholder={memForm.laChuHo ? 'Chủ hộ' : 'Vợ, Con, Bố, Mẹ...'}
          value={memForm.quanHeChuHo}
          onChange={e => setMemForm(f => ({ ...f, quanHeChuHo: e.target.value }))}
        />
      </Modal>

      {/* ══ Modal Biến động (UC08/09) ══ */}
      <Modal title="Ghi nhận biến động dân cư" open={showMov} onClose={() => setShowMov(false)}
        footer={<><SecondaryBtn onClick={() => setShowMov(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleMov} disabled={movSaving}>{movSaving ? 'Đang lưu...' : 'Ghi nhận'}</PrimaryBtn></>}>
        {movErr && <ErrBox msg={movErr} />}
        <Select label="Loại biến động" value={movForm.loai} onChange={v => setMovForm(f => ({ ...f, loai: v }))}
          options={[{ value: 'MOVE_IN', label: 'Chuyển đến (Move In)' }, { value: 'MOVE_OUT', label: 'Chuyển đi (Move Out)' }]} />
        <FormInput label="Ngày" type="date" required value={movForm.ngay} onChange={e => setMovForm(f => ({ ...f, ngay: e.target.value }))} />
        <FormInput label="Nơi chuyển từ (nguồn gốc)" placeholder="Quận Hải Châu, Đà Nẵng..." value={movForm.nguonGoc} onChange={e => setMovForm(f => ({ ...f, nguonGoc: e.target.value }))} />
        <FormInput label="Nơi chuyển đến" placeholder="Phường Hòa Thọ Đông..." value={movForm.noiDen} onChange={e => setMovForm(f => ({ ...f, noiDen: e.target.value }))} />
        <FormInput label="Ghi chú" placeholder="Thông tin bổ sung..." value={movForm.ghiChu} onChange={e => setMovForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>

      {/* ══ Modal Sửa biến động (UC08/09) ══ */}
      <Modal title="Chỉnh sửa biến động" open={showMovEdit} onClose={() => setShowMovEdit(false)}
        footer={<><SecondaryBtn onClick={() => setShowMovEdit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleMovEdit} disabled={editMovSaving}>{editMovSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</PrimaryBtn></>}>
        {editMovErr && <ErrBox msg={editMovErr} />}
        <Select label="Loại biến động" value={editMovForm.loai} onChange={v => setEditMovForm(f => ({ ...f, loai: v }))}
          options={[{ value: 'MOVE_IN', label: 'Chuyển đến (Move In)' }, { value: 'MOVE_OUT', label: 'Chuyển đi (Move Out)' }]} />
        <FormInput label="Ngày" type="date" required value={editMovForm.ngay} onChange={e => setEditMovForm(f => ({ ...f, ngay: e.target.value }))} />
        <FormInput label="Nơi chuyển từ (nguồn gốc)" value={editMovForm.nguonGoc} onChange={e => setEditMovForm(f => ({ ...f, nguonGoc: e.target.value }))} />
        <FormInput label="Nơi chuyển đến" value={editMovForm.noiDen} onChange={e => setEditMovForm(f => ({ ...f, noiDen: e.target.value }))} />
        <FormInput label="Ghi chú" value={editMovForm.ghiChu} onChange={e => setEditMovForm(f => ({ ...f, ghiChu: e.target.value }))} />
      </Modal>

      {/* ══ Modal Tách hộ (UC05) ══ */}
      <Modal title={`Tách hộ — ${detailHH?.soHoKhau ?? ''}`} open={showSplit} onClose={() => setShowSplit(false)}
        footer={<><SecondaryBtn onClick={() => setShowSplit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleSplit} disabled={splitSaving}>{splitSaving ? 'Đang xử lý...' : 'Xác nhận tách hộ'}</PrimaryBtn></>}>
        {splitErr && <ErrBox msg={splitErr} />}
        <p className="text-xs text-muted-foreground">Chọn các thành viên sẽ chuyển sang hộ mới:</p>
        {(detailHH?.members?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Hộ chưa có thành viên nào</p>
        ) : detailHH.members.map(m => (
          <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary border border-border cursor-pointer hover:border-primary/30 transition-colors">
            <input type="checkbox" checked={splitSelected.includes(m.id)} onChange={() => toggleSplitMem(m.id)} className="rounded" />
            <div>
              <p className="text-sm font-semibold text-foreground">{m.hoTen} {m.laChuHo && <span className="text-[10px] text-primary">(Chủ hộ)</span>}</p>
              <p className="text-xs text-muted-foreground">{m.quanHeChuHo}</p>
            </div>
          </label>
        ))}
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Hộ mới sẽ được tạo với số HK tự động. Hộ cũ sẽ được đánh dấu "Đã tách" nếu không còn thành viên.
        </p>
      </Modal>

      {/* ══ Modal Gộp hộ (UC06) ══ */}
      <Modal wide title="Gộp hộ dân" open={showMerge} onClose={() => setShowMerge(false)}
        footer={
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              {mergeTarget && mergeSources.size > 0
                ? `Gộp ${mergeSources.size} hộ → ${mergeTargetHH?.soHoKhau} · ~${totalMergeMembers} nhân khẩu chuyển đến`
                : 'Chọn hộ nhận và các hộ cần gộp'}
            </p>
            <div className="flex gap-2">
              <SecondaryBtn onClick={() => setShowMerge(false)}>Hủy</SecondaryBtn>
              <PrimaryBtn onClick={handleMerge} disabled={mergeSaving}>
                {mergeSaving ? 'Đang gộp...' : <><GitMerge size={14} /> Xác nhận gộp hộ</>}
              </PrimaryBtn>
            </div>
          </div>
        }>
        {mergeErr && <ErrBox msg={mergeErr} />}

        <div className="grid grid-cols-2 gap-4">
          {/* Cột trái — Hộ nhận */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">
              Hộ nhận <span className="text-destructive">*</span>
              <span className="ml-1 text-muted-foreground font-normal normal-case">(chọn 1)</span>
            </p>
            <input
              value={mergeSearchT}
              onChange={e => setMergeSearchT(e.target.value)}
              placeholder="Tìm số HK, địa chỉ..."
              className="w-full px-3 py-1.5 rounded-md text-xs bg-card border border-input focus:border-ring outline-none"
            />
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {mergeLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Đang tải...</p>
              ) : filteredTargets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Không tìm thấy</p>
              ) : filteredTargets.map(h => (
                <label key={h.id}
                  className={`flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                    mergeTarget === h.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-secondary hover:border-primary/30'
                  }`}>
                  <input type="radio" name="mergeTarget" checked={mergeTarget === h.id}
                    onChange={() => { setMergeTarget(h.id); setMergeSources(s => { const n = new Set(s); n.delete(h.id); return n }) }}
                    className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{h.soHoKhau}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{h.diaChi}</p>
                    <p className="text-[11px] text-muted-foreground">{h.village?.ten} · {h.members?.length ?? 0} người</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cột phải — Hộ bị gộp */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">
              Hộ bị gộp <span className="text-destructive">*</span>
              <span className="ml-1 text-muted-foreground font-normal normal-case">(chọn nhiều)</span>
            </p>
            <input
              value={mergeSearchS}
              onChange={e => setMergeSearchS(e.target.value)}
              placeholder="Tìm số HK, địa chỉ..."
              className="w-full px-3 py-1.5 rounded-md text-xs bg-card border border-input focus:border-ring outline-none"
            />
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {mergeLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Đang tải...</p>
              ) : filteredSources.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {!mergeTarget ? 'Chọn hộ nhận trước' : 'Không tìm thấy'}
                </p>
              ) : filteredSources.map(h => (
                <label key={h.id}
                  className={`flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                    mergeSources.has(h.id)
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-border bg-secondary hover:border-amber-300'
                  }`}>
                  <input type="checkbox" checked={mergeSources.has(h.id)}
                    onChange={() => toggleMergeSource(h.id)}
                    className="mt-0.5 shrink-0 rounded" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {h.soHoKhau}
                      {h.trangThai === 'DA_GIAI_THE' && <span className="ml-1 text-[10px] text-red-500">(Đã giải thể)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{h.diaChi}</p>
                    <p className="text-[11px] text-muted-foreground">{h.village?.ten} · {h.members?.length ?? 0} người</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Ghi chú */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Ghi chú</label>
          <input value={mergeNote} onChange={e => setMergeNote(e.target.value)}
            placeholder="Lý do gộp hộ, quyết định số..."
            className="w-full px-3 py-2 rounded-md text-sm bg-card border border-input focus:border-ring outline-none" />
        </div>

        {/* Preview */}
        {mergeTarget && mergeSources.size > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <GitMerge size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-0.5">
              <p className="font-semibold">Xem trước kết quả gộp hộ:</p>
              <p>· {mergeSources.size} hộ sẽ được đánh dấu <strong>Đã giải thể</strong></p>
              <p>· ~{totalMergeMembers} nhân khẩu chuyển sang hộ <strong>{mergeTargetHH?.soHoKhau}</strong></p>
              <p>· Lịch sử gộp hộ được ghi vào audit log</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ErrBox({ msg }) {
  return <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">{msg}</p>
}
