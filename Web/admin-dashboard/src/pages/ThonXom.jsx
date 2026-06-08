import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import {
  PageHeader, PrimaryBtn, SecondaryBtn, DataTable,
  SearchInput, StatCard, Modal, FormInput,
} from '../components/ui'
import * as villageService from '../services/villageService'

const COLUMNS = ['Tên thôn', 'Mã thôn', 'Số hộ', 'Dân số', '']
const EMPTY = { ten: '', ma: '', moTa: '' }

export default function ThonXom() {
  const [villages, setVillages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState(EMPTY)
  const [addErr, setAddErr]     = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState(EMPTY)
  const [editErr, setEditErr]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const load = () => {
    setLoading(true)
    villageService.getAll()
      .then(r => setVillages(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = villages.filter(v => {
    const q = search.toLowerCase()
    return !q || v.ten?.toLowerCase().includes(q) || v.ma?.toLowerCase().includes(q)
  })

  const totalHo   = villages.reduce((s, v) => s + (v._count?.households ?? v.soHo ?? 0), 0)
  const totalDan  = villages.reduce((s, v) => s + (v._count?.members  ?? v.soDan  ?? 0), 0)

  /* Add */
  const openAdd = () => { setAddForm(EMPTY); setAddErr(''); setShowAdd(true) }
  const handleAdd = async () => {
    if (!addForm.ten.trim()) { setAddErr('Vui lòng nhập tên thôn'); return }
    setAddSaving(true); setAddErr('')
    try { await villageService.create(addForm); setShowAdd(false); load() }
    catch (e) { setAddErr(e.response?.data?.message || 'Tạo thất bại') }
    finally { setAddSaving(false) }
  }

  /* Edit */
  const openEdit = v => {
    setEditId(v.id)
    setEditForm({ ten: v.ten || '', ma: v.ma || '', moTa: v.moTa || '' })
    setEditErr(''); setShowEdit(true)
  }
  const handleEdit = async () => {
    if (!editForm.ten.trim()) { setEditErr('Vui lòng nhập tên thôn'); return }
    setEditSaving(true); setEditErr('')
    try { await villageService.update(editId, editForm); setShowEdit(false); load() }
    catch (e) { setEditErr(e.response?.data?.message || 'Cập nhật thất bại') }
    finally { setEditSaving(false) }
  }

  /* Delete */
  const handleDelete = async v => {
    if (!window.confirm(`Xóa thôn "${v.ten}"? Hành động này không thể hoàn tác.`)) return
    try { await villageService.remove(v.id); load() }
    catch (e) { alert(e.response?.data?.message || 'Xóa thất bại') }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý Thôn / Địa bàn"
        subtitle="Danh sách các thôn thuộc UBND Xã Hòa Tiến"
        action={
          <div className="flex gap-2">
            <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm thôn</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Tổng số thôn" value={villages.length} icon={MapPin} iconColor="#2563eb" />
        <StatCard label="Tổng hộ"      value={totalHo}          icon={MapPin} iconColor="#16a34a" />
        <StatCard label="Tổng dân số"  value={totalDan}         icon={MapPin} iconColor="#7c3aed" />
        <StatCard label="TB nhân khẩu/hộ" value={totalHo ? Math.round(totalDan / totalHo) : 0} icon={MapPin} iconColor="#d97706" />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div />
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên thôn, mã thôn..." />
        </div>

        <DataTable columns={COLUMNS} empty={!loading && filtered.length === 0}>
          {loading ? (
            <tr><td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">Đang tải...</td></tr>
          ) : filtered.map(v => (
            <tr key={v.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
              <td className="px-5 py-3 text-sm font-semibold text-foreground">{v.ten}</td>
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{v.ma ?? '—'}</td>
              <td className="px-5 py-3 text-sm">{v._count?.households ?? v.soHo ?? 0} hộ</td>
              <td className="px-5 py-3 text-sm">{v._count?.members ?? v.soDan ?? 0} người</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa"><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(v)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors" title="Xóa"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">Hiển thị {filtered.length} / {villages.length} thôn</span>
        </div>
      </div>

      {/* Modal Thêm thôn */}
      <Modal title="Thêm thôn mới" open={showAdd} onClose={() => setShowAdd(false)}
        footer={<><SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Đang lưu...' : 'Thêm thôn'}</PrimaryBtn></>}>
        {addErr && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{addErr}</p>}
        <FormInput label="Tên thôn" required placeholder="Thôn Hòa Mỹ..." value={addForm.ten} onChange={e => setAddForm(f => ({ ...f, ten: e.target.value }))} />
        <FormInput label="Mã thôn" placeholder="VD: HM01" value={addForm.ma} onChange={e => setAddForm(f => ({ ...f, ma: e.target.value }))} />
        <FormInput label="Mô tả" placeholder="Thông tin bổ sung..." value={addForm.moTa} onChange={e => setAddForm(f => ({ ...f, moTa: e.target.value }))} />
      </Modal>

      {/* Modal Chỉnh sửa thôn */}
      <Modal title="Chỉnh sửa thôn" open={showEdit} onClose={() => setShowEdit(false)}
        footer={<><SecondaryBtn onClick={() => setShowEdit(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</PrimaryBtn></>}>
        {editErr && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{editErr}</p>}
        <FormInput label="Tên thôn" required value={editForm.ten} onChange={e => setEditForm(f => ({ ...f, ten: e.target.value }))} />
        <FormInput label="Mã thôn" value={editForm.ma} onChange={e => setEditForm(f => ({ ...f, ma: e.target.value }))} />
        <FormInput label="Mô tả" value={editForm.moTa} onChange={e => setEditForm(f => ({ ...f, moTa: e.target.value }))} />
      </Modal>
    </div>
  )
}
