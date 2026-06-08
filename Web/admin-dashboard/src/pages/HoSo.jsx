import '../styles/ho-so.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Filter, Home, Users, ArrowRightLeft, CheckCircle, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge, Modal, Select, FormInput } from '../components/ui'
import * as householdService from '../services/householdService'
import * as villageService from '../services/villageService'

const LOAI_HO_LABEL = {
  THUONG_TRU: { label: 'Thường trú', variant: 'green' },
  TAM_TRU:    { label: 'Tạm trú',    variant: 'amber' },
  TAM_VANG:   { label: 'Tạm vắng',  variant: 'orange' },
}

const TRANG_THAI_LABEL = {
  ACTIVE:       { label: 'Đang hoạt động', variant: 'green' },
  DA_TACH:      { label: 'Đã tách',        variant: 'amber' },
  DA_GIAI_THE:  { label: 'Đã giải thể',    variant: 'red' },
}

const TAB_FILTER = {
  'Tất cả':    {},
  'Thường trú': { loaiHo: 'THUONG_TRU' },
  'Tạm trú':   { loaiHo: 'TAM_TRU' },
  'Tạm vắng':  { loaiHo: 'TAM_VANG' },
}

const COLUMNS = ['Số HK', 'Địa chỉ', 'Thôn', 'Loại hộ', 'Nhân khẩu', 'Trạng thái', '']

const EMPTY_FORM = { soHoKhau: '', diaChi: '', villageId: '', loaiHo: 'THUONG_TRU', trangThai: 'ACTIVE' }

export default function HoSo() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [households, setHouseholds] = useState([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [stats, setStats] = useState({ all: 0, thuongTru: 0, tamTru: 0, tamVang: 0 })
  const [loading, setLoading] = useState(true)
  const [villages, setVillages] = useState([])

  // Modal state
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Detail / Edit modal
  const [showDetail, setShowDetail] = useState(false)
  const [detailHousehold, setDetailHousehold] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const searchDebounce = useRef(null)

  const loadStats = useCallback(async () => {
    try {
      const [all, tt, tr, tv] = await Promise.all([
        householdService.getAll({ page: 1, limit: 1 }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'THUONG_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_VANG' }),
      ])
      setStats({
        all:      all.data.pagination.total,
        thuongTru: tt.data.pagination.total,
        tamTru:    tr.data.pagination.total,
        tamVang:   tv.data.pagination.total,
      })
    } catch {}
  }, [])

  const loadList = useCallback(async (currentTab, currentSearch, currentPage) => {
    setLoading(true)
    try {
      let res
      if (currentSearch.trim()) {
        res = await householdService.search(currentSearch.trim())
        setHouseholds(res.data.data || [])
        setPagination({ total: res.data.data?.length ?? 0, totalPages: 1 })
      } else {
        const params = { ...TAB_FILTER[currentTab], page: currentPage, limit: 20 }
        res = await householdService.getAll(params)
        setHouseholds(res.data.data || [])
        setPagination(res.data.pagination || { total: 0, totalPages: 1 })
      }
    } catch (e) {
      console.error('HoSo load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadList(tab, search, page) }, [tab, page])

  useEffect(() => {
    villageService.getAll()
      .then(res => setVillages(res.data.data || []))
      .catch(() => {})
  }, [])

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(1)
      loadList(tab, val, 1)
    }, 400)
  }

  const handleTabChange = (t) => { setTab(t); setPage(1) }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  const handleAdd = async () => {
    if (!form.soHoKhau.trim()) { setError('Vui lòng nhập số hộ khẩu'); return }
    if (!form.diaChi.trim())   { setError('Vui lòng nhập địa chỉ'); return }
    if (!form.villageId)       { setError('Vui lòng chọn thôn'); return }
    setSaving(true)
    setError('')
    try {
      await householdService.create(form)
      setShowAdd(false)
      await Promise.all([loadStats(), loadList(tab, search, page)])
    } catch (e) {
      setError(e.response?.data?.message || 'Tạo hộ dân thất bại')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (h) => {
    try {
      const res = await householdService.getById(h.id)
      setDetailHousehold(res.data.data || h)
    } catch {
      setDetailHousehold(h)
    }
    setShowDetail(true)
  }

  const openEdit = (h) => {
    setEditId(h.id)
    setEditForm({
      soHoKhau: h.soHoKhau || '',
      diaChi:   h.diaChi   || '',
      villageId: h.village?.id || h.villageId || '',
      loaiHo:   h.loaiHo   || 'THUONG_TRU',
      trangThai: h.trangThai || 'ACTIVE',
    })
    setEditError('')
    setShowEdit(true)
  }

  const handleEdit = async () => {
    if (!editForm.soHoKhau.trim()) { setEditError('Vui lòng nhập số hộ khẩu'); return }
    if (!editForm.diaChi.trim())   { setEditError('Vui lòng nhập địa chỉ'); return }
    setEditSaving(true)
    setEditError('')
    try {
      await householdService.update(editId, editForm)
      setShowEdit(false)
      await Promise.all([loadStats(), loadList(tab, search, page)])
    } catch (e) {
      setEditError(e.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (h) => {
    if (!window.confirm(`Xóa hộ dân "${h.soHoKhau}"?`)) return
    try {
      await householdService.remove(h.id)
      await Promise.all([loadStats(), loadList(tab, search, page)])
    } catch (e) {
      alert(e.response?.data?.message || 'Xóa thất bại')
    }
  }

  const villageOptions = [
    { value: '', label: '-- Chọn thôn --' },
    ...villages.map(v => ({ value: v.id, label: v.ten })),
  ]

  const loaiHoOptions = [
    { value: 'THUONG_TRU', label: 'Thường trú' },
    { value: 'TAM_TRU',    label: 'Tạm trú' },
    { value: 'TAM_VANG',   label: 'Tạm vắng' },
  ]

  const trangThaiOptions = [
    { value: 'ACTIVE',      label: 'Đang hoạt động' },
    { value: 'DA_TACH',     label: 'Đã tách' },
    { value: 'DA_GIAI_THE', label: 'Đã giải thể' },
  ]

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
            <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm hộ dân</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs
            tabs={['Tất cả', 'Thường trú', 'Tạm trú', 'Tạm vắng']}
            active={tab}
            onChange={handleTabChange}
          />
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder="Tìm số HK, địa chỉ..."
            />
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={!loading && households.length === 0}>
          {loading ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">
                Đang tải...
              </td>
            </tr>
          ) : (
            households.map(h => {
              const loai = LOAI_HO_LABEL[h.loaiHo] || { label: h.loaiHo, variant: 'default' }
              const tt = TRANG_THAI_LABEL[h.trangThai] || { label: h.trangThai, variant: 'default' }
              return (
                <tr key={h.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{h.soHoKhau}</td>
                  <td className="px-5 py-3 text-sm text-foreground max-w-[200px] truncate">{h.diaChi}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{h.village?.ten ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={loai.variant}>{loai.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{h.members?.length ?? 0} người</td>
                  <td className="px-5 py-3">
                    <Badge variant={tt.variant}>{tt.label}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        title="Xem chi tiết"
                        onClick={() => openDetail(h)}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors"
                        title="Chỉnh sửa"
                        onClick={() => openEdit(h)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                        title="Xóa"
                        onClick={() => handleDelete(h)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">
            Hiển thị {households.length} / {pagination.total} hộ dân
          </span>
          <div className="flex gap-1">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >‹</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'page-btn-active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            })}
            <button
              className="page-btn"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >›</button>
          </div>
        </div>
      </div>

      {/* Modal Thêm hộ dân */}
      <Modal
        title="Thêm hộ dân mới"
        open={showAdd}
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={handleAdd} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Thêm hộ dân'}
            </PrimaryBtn>
          </>
        }
      >
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}
        <FormInput
          label="Số hộ khẩu"
          required
          placeholder="VD: HK-001"
          value={form.soHoKhau}
          onChange={e => setForm(f => ({ ...f, soHoKhau: e.target.value }))}
        />
        <FormInput
          label="Địa chỉ"
          required
          placeholder="Số nhà, đường, khu phố..."
          value={form.diaChi}
          onChange={e => setForm(f => ({ ...f, diaChi: e.target.value }))}
        />
        <Select
          label="Thôn"
          required
          value={form.villageId}
          onChange={val => setForm(f => ({ ...f, villageId: val }))}
          options={villageOptions}
        />
        <Select
          label="Loại hộ"
          value={form.loaiHo}
          onChange={val => setForm(f => ({ ...f, loaiHo: val }))}
          options={loaiHoOptions}
        />
      </Modal>

      {/* Modal Chi tiết hộ dân */}
      <Modal
        title={`Chi tiết hộ khẩu — ${detailHousehold?.soHoKhau ?? ''}`}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        footer={<SecondaryBtn onClick={() => setShowDetail(false)}>Đóng</SecondaryBtn>}
      >
        {detailHousehold && (
          <div className="space-y-3 text-sm">
            {[
              ['Số hộ khẩu', detailHousehold.soHoKhau],
              ['Địa chỉ',    detailHousehold.diaChi],
              ['Thôn',       detailHousehold.village?.ten ?? '—'],
              ['Loại hộ',    LOAI_HO_LABEL[detailHousehold.loaiHo]?.label ?? detailHousehold.loaiHo],
              ['Trạng thái', TRANG_THAI_LABEL[detailHousehold.trangThai]?.label ?? detailHousehold.trangThai],
              ['Số nhân khẩu', `${detailHousehold.members?.length ?? 0} người`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span className="text-muted-foreground font-medium">{k}</span>
                <span className="text-foreground font-semibold">{v}</span>
              </div>
            ))}
            {detailHousehold.members?.length > 0 && (
              <div>
                <p className="font-semibold text-foreground mb-2">Nhân khẩu:</p>
                <div className="space-y-1">
                  {detailHousehold.members.map(m => (
                    <div key={m.id} className="flex justify-between text-xs bg-secondary rounded px-3 py-1.5">
                      <span>{m.hoTen}</span>
                      <span className="text-muted-foreground">{m.quanHe ?? ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Chỉnh sửa hộ dân */}
      <Modal
        title="Chỉnh sửa hộ dân"
        open={showEdit}
        onClose={() => setShowEdit(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowEdit(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </PrimaryBtn>
          </>
        }
      >
        {editError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{editError}</p>
        )}
        <FormInput
          label="Số hộ khẩu"
          required
          value={editForm.soHoKhau}
          onChange={e => setEditForm(f => ({ ...f, soHoKhau: e.target.value }))}
        />
        <FormInput
          label="Địa chỉ"
          required
          value={editForm.diaChi}
          onChange={e => setEditForm(f => ({ ...f, diaChi: e.target.value }))}
        />
        <Select
          label="Thôn"
          value={editForm.villageId}
          onChange={val => setEditForm(f => ({ ...f, villageId: val }))}
          options={villageOptions}
        />
        <Select
          label="Loại hộ"
          value={editForm.loaiHo}
          onChange={val => setEditForm(f => ({ ...f, loaiHo: val }))}
          options={loaiHoOptions}
        />
        <Select
          label="Trạng thái"
          value={editForm.trangThai}
          onChange={val => setEditForm(f => ({ ...f, trangThai: val }))}
          options={trangThaiOptions}
        />
      </Modal>
    </div>
  )
}
