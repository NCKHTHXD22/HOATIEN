import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, Trash2, RefreshCw, Search, X, ChevronRight,
  UserPlus,
} from 'lucide-react'
import {
  getGroups, createGroup, deleteGroup, getGroup,
  addGroupMembers, removeGroupMembers, rebuildAutoGroup,
  getMembers,
} from '../services/notificationService'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN')
}

// ── Modal tạo nhóm mới ─────────────────────────────────────
function CreateGroupModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ ten: '', moTa: '', loai: 'MANUAL' })
  const [criteria, setCriteria] = useState({ villageId: '', gioiTinh: '', tuoiMin: '', tuoiMax: '', loaiHo: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setForm({ ten: '', moTa: '', loai: 'MANUAL' }); setCriteria({ villageId: '', gioiTinh: '', tuoiMin: '', tuoiMax: '', loaiHo: '' }) }
  }, [open])

  const handleSave = async () => {
    if (!form.ten.trim()) return alert('Tên nhóm là bắt buộc')
    setLoading(true)
    try {
      const payload = { ...form }
      if (form.loai === 'AUTO') {
        const c = {}
        if (criteria.gioiTinh) c.gioiTinh = criteria.gioiTinh
        if (criteria.tuoiMin) c.tuoiMin = parseInt(criteria.tuoiMin)
        if (criteria.tuoiMax) c.tuoiMax = parseInt(criteria.tuoiMax)
        if (criteria.loaiHo) c.loaiHo = criteria.loaiHo
        payload.tieuChi = c
      }
      await createGroup(payload)
      onDone(); onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally { setLoading(false) }
  }

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Tạo nhóm người nhận</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhóm <span className="text-red-500">*</span></label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.ten}
              onChange={e => setForm(f => ({ ...f, ten: e.target.value }))}
              placeholder="Vd: Phụ nữ Thôn 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.moTa}
              onChange={e => setForm(f => ({ ...f, moTa: e.target.value }))}
              placeholder="Mô tả nhóm..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loại nhóm</label>
            <div className="flex gap-3">
              {['MANUAL', 'AUTO'].map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, loai: t }))}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium ${form.loai === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {t === 'MANUAL' ? '✋ Thủ công' : '⚡ Tự động theo tiêu chí'}
                </button>
              ))}
            </div>
          </div>

          {form.loai === 'AUTO' && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-blue-700">Tiêu chí tự động (bỏ trống = không lọc)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Giới tính</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm"
                    value={criteria.gioiTinh} onChange={e => setCriteria(c => ({ ...c, gioiTinh: e.target.value }))}>
                    <option value="">Tất cả</option>
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Loại hộ</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm"
                    value={criteria.loaiHo} onChange={e => setCriteria(c => ({ ...c, loaiHo: e.target.value }))}>
                    <option value="">Tất cả</option>
                    <option value="THUONG_TRU">Thường trú</option>
                    <option value="TAM_TRU">Tạm trú</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tuổi từ</label>
                  <input type="number" min="0" max="120" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={criteria.tuoiMin} onChange={e => setCriteria(c => ({ ...c, tuoiMin: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tuổi đến</label>
                  <input type="number" min="0" max="120" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={criteria.tuoiMax} onChange={e => setCriteria(c => ({ ...c, tuoiMax: e.target.value }))} placeholder="100" />
                </div>
              </div>
              <p className="text-xs text-blue-600">Hệ thống sẽ tự thêm thành viên phù hợp khi tạo nhóm</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading && <RefreshCw size={13} className="animate-spin" />} Tạo nhóm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Panel chi tiết nhóm ────────────────────────────────────
function GroupDetail({ groupId, onClose, onRefresh }) {
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [selectedAdd, setSelectedAdd] = useState([])
  const [rebuilding, setRebuilding] = useState(false)

  const loadGroup = useCallback(() => {
    setLoading(true)
    getGroup(groupId).then(r => setGroup(r.data)).finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => { loadGroup() }, [loadGroup])

  useEffect(() => {
    if (!addMode) return
    const t = setTimeout(() => {
      getMembers({ search: memberSearch, limit: 30 })
        .then(r => setMembers(r.data || []))
    }, 300)
    return () => clearTimeout(t)
  }, [memberSearch, addMode])

  const handleRemove = async (memberId) => {
    await removeGroupMembers(groupId, [memberId]).catch(() => {})
    loadGroup(); onRefresh()
  }

  const handleAdd = async () => {
    if (selectedAdd.length === 0) return
    await addGroupMembers(groupId, selectedAdd).catch(() => {})
    setAddMode(false); setSelectedAdd([])
    loadGroup(); onRefresh()
  }

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const res = await rebuildAutoGroup(groupId)
      alert(`Đã cập nhật ${res.data?.count} thành viên`)
      loadGroup(); onRefresh()
    } catch (e) { alert(e.response?.data?.message || 'Lỗi') }
    finally { setRebuilding(false) }
  }

  if (loading) return <div className="p-8 text-center text-gray-400"><RefreshCw size={20} className="animate-spin inline" /></div>
  if (!group) return null

  const groupMemberIds = new Set(group.members?.map(m => m.memberId))

  return (
    <div className="bg-white rounded-xl border">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div>
          <h3 className="font-semibold text-gray-800">{group.ten}</h3>
          <p className="text-xs text-gray-400">
            {group.loai === 'AUTO' ? '⚡ Tự động' : '✋ Thủ công'} · {group.members?.length || 0} thành viên
          </p>
        </div>
        <div className="flex gap-2">
          {group.loai === 'AUTO' && (
            <button onClick={handleRebuild} disabled={rebuilding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
              {rebuilding ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />} Cập nhật
            </button>
          )}
          {group.loai === 'MANUAL' && (
            <button onClick={() => setAddMode(!addMode)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
              <UserPlus size={12} /> Thêm thành viên
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
      </div>

      {addMode && (
        <div className="px-5 py-3 bg-blue-50 border-b space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Tìm nhân khẩu để thêm..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
            />
          </div>
          <div className="max-h-36 overflow-y-auto bg-white rounded-lg border divide-y">
            {members.filter(m => !groupMemberIds.has(m.id)).map(m => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox"
                  checked={selectedAdd.includes(m.id)}
                  onChange={() => setSelectedAdd(s => s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id])}
                />
                <span className="text-sm flex-1">{m.hoTen}</span>
                <span className="text-xs text-gray-400">{m.household?.village?.ten}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAddMode(false); setSelectedAdd([]) }}
              className="text-xs px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded">Hủy</button>
            <button onClick={handleAdd}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
              Thêm {selectedAdd.length > 0 ? `(${selectedAdd.length})` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y max-h-80 overflow-y-auto">
        {group.members?.length === 0
          ? <p className="text-center text-sm text-gray-400 py-6">Chưa có thành viên</p>
          : group.members?.map(gm => (
            <div key={gm.memberId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                {gm.member?.hoTen?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{gm.member?.hoTen}</p>
                <p className="text-xs text-gray-400">
                  {gm.member?.household?.village?.ten}
                  {gm.member?.sdt && ` · ${gm.member.sdt}`}
                  {gm.member?.email && ` · ${gm.member.email}`}
                  {gm.member?.zaloUserId && ' · ✓ Zalo'}
                </p>
              </div>
              {group.loai === 'MANUAL' && (
                <button onClick={() => handleRemove(gm.memberId)}
                  className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function NguoiNhan() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getGroups().then(r => setGroups(r.data || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Xóa nhóm này? Thao tác không thể hoàn tác.')) return
    await deleteGroup(id).catch(e => alert(e.response?.data?.message || 'Không thể xóa'))
    if (selectedGroup === id) setSelectedGroup(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Người nhận</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý nhóm người nhận thông báo (UC01 / UC02)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Tạo nhóm mới
        </button>
      </div>

      <div className={`grid gap-6 ${selectedGroup ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Danh sách nhóm */}
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Danh sách nhóm</h2>
            <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading
            ? <div className="py-12 text-center text-gray-400"><RefreshCw size={20} className="animate-spin inline" /></div>
            : groups.length === 0
              ? (
                <div className="py-12 text-center">
                  <Users size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">Chưa có nhóm nào</p>
                  <button onClick={() => setCreateOpen(true)}
                    className="mt-3 text-sm text-blue-600 hover:underline">Tạo nhóm đầu tiên</button>
                </div>
              )
              : (
                <div className="divide-y">
                  {groups.map(g => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroup(g.id === selectedGroup ? null : g.id)}
                      className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedGroup === g.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${g.loai === 'AUTO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {g.loai === 'AUTO' ? '⚡' : <Users size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{g.ten}</p>
                        <p className="text-xs text-gray-400">
                          {g._count?.members || 0} thành viên · Tạo bởi {g.admin?.hoTen} · {fmtDate(g.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.loai === 'AUTO' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {g.loai === 'AUTO' ? 'AUTO' : 'Thủ công'}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(g.id) }}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                        ><Trash2 size={14} /></button>
                        <ChevronRight size={14} className={`text-gray-400 transition-transform ${selectedGroup === g.id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </div>

        {/* Chi tiết nhóm */}
        {selectedGroup && (
          <GroupDetail
            groupId={selectedGroup}
            onClose={() => setSelectedGroup(null)}
            onRefresh={load}
          />
        )}
      </div>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
    </div>
  )
}
