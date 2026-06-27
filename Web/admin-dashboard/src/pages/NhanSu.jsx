import '../styles/nhan-su.css'
import { useState, useEffect } from 'react'
import { Plus, Filter, Users, UserCheck, UserX, Eye, EyeOff, Pencil, Lock, Unlock, Bell, BellOff } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge, Modal, Select, FormInput } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import * as authService from '../services/authService'

const ROLE_LABEL = {
  SUPER_ADMIN:   { label: 'Quản trị viên', variant: 'purple' },
  ADMIN_VILLAGE: { label: 'CB thôn',       variant: 'blue' },
  VIEWER:        { label: 'Xem',           variant: 'default' },
}

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN',   label: 'Quản trị viên (Super Admin)' },
  { value: 'ADMIN_VILLAGE', label: 'Cán bộ thôn (Admin Village)' },
  { value: 'VIEWER',        label: 'Chỉ xem (Viewer)' },
]

const COLUMNS = ['Họ tên', 'Tên đăng nhập', 'Phân quyền', 'Trạng thái', 'Gửi TB', 'Ngày tạo', '']

const EMPTY_FORM = { hoTen: '', username: '', password: '', role: 'VIEWER' }

export default function NhanSu() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Add modal
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ hoTen: '', role: 'VIEWER' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const handleToggleNotify = async (u) => {
    const next = !u.canSendNotification
    try {
      await authService.updateNotifyPermission(u.id, next)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, canSendNotification: next } : x))
    } catch (e) {
      alert(e.response?.data?.message || 'Cập nhật quyền thất bại')
    }
  }

  const handleToggleActive = async (u) => {
    const next = !u.isActive
    if (!confirm(next ? `Mở khóa tài khoản "${u.hoTen}"?` : `Khóa tài khoản "${u.hoTen}"?`)) return
    try {
      await authService.updateUser(u.id, { isActive: next })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: next } : x))
    } catch (e) {
      alert(e.response?.data?.message || 'Cập nhật trạng thái thất bại')
    }
  }

  const openEdit = (u) => {
    setEditId(u.id)
    setEditForm({ hoTen: u.hoTen, role: u.role })
    setEditError('')
    setShowEdit(true)
  }

  const handleEdit = async () => {
    if (!editForm.hoTen.trim()) { setEditError('Vui lòng nhập họ tên'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await authService.updateUser(editId, editForm)
      setUsers(prev => prev.map(x => x.id === editId ? { ...x, ...res.data.data } : x))
      setShowEdit(false)
    } catch (e) {
      setEditError(e.response?.data?.message || 'Cập nhật tài khoản thất bại')
    } finally {
      setEditSaving(false)
    }
  }

  const loadUsers = () => {
    if (!isSuperAdmin) { setLoading(false); return }
    authService.getUsers()
      .then(res => setUsers(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers() }, [isSuperAdmin])

  const filtered = users.filter(u => {
    const matchTab = tab === 'Tất cả'
      ? true
      : tab === 'Đang làm việc' ? u.isActive
      : tab === 'Bị khóa'       ? !u.isActive
      : true
    const q = search.toLowerCase()
    const matchSearch = !q || u.hoTen?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const stats = {
    total:  users.length,
    active: users.filter(u => u.isActive).length,
    locked: users.filter(u => !u.isActive).length,
    super:  users.filter(u => u.role === 'SUPER_ADMIN').length,
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setError('')
    setShowPwd(false)
    setShowAdd(true)
  }

  const handleAdd = async () => {
    if (!form.hoTen.trim())    { setError('Vui lòng nhập họ tên'); return }
    if (!form.username.trim()) { setError('Vui lòng nhập tên đăng nhập'); return }
    if (form.username.length < 3) { setError('Tên đăng nhập phải có ít nhất 3 ký tự'); return }
    if (!form.password)        { setError('Vui lòng nhập mật khẩu'); return }
    if (form.password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return }
    setSaving(true)
    setError('')
    try {
      await authService.createUser(form)
      setShowAdd(false)
      setLoading(true)
      loadUsers()
    } catch (e) {
      setError(e.response?.data?.message || 'Tạo tài khoản thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cán bộ – Tài khoản hệ thống"
        subtitle="Danh sách tài khoản quản trị UBND Xã Hòa Tiến"
        action={
          isSuperAdmin && (
            <div className="flex gap-2">
              <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
              <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm tài khoản</PrimaryBtn>
            </div>
          )
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tổng tài khoản"   value={stats.total}  icon={Users}     iconColor="#2563eb" />
        <StatCard label="Đang hoạt động"   value={stats.active} icon={UserCheck}  iconColor="#16a34a" />
        <StatCard label="Bị khóa"          value={stats.locked} icon={UserX}      iconColor="#dc2626" />
        <StatCard label="Quản trị viên"    value={stats.super}  icon={Users}      iconColor="#7c3aed" />
      </div>

      {!isSuperAdmin ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Chỉ Quản trị viên (SUPER_ADMIN) mới có quyền xem danh sách tài khoản.
        </div>
      ) : (
        <div className="table-panel">
          <div className="table-toolbar">
            <Tabs tabs={['Tất cả', 'Đang làm việc', 'Bị khóa']} active={tab} onChange={setTab} />
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, tên đăng nhập..." />
          </div>

          <DataTable columns={COLUMNS} empty={!loading && filtered.length === 0}>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  Đang tải...
                </td>
              </tr>
            ) : (
              filtered.map(u => {
                const role = ROLE_LABEL[u.role] || { label: u.role, variant: 'default' }
                return (
                  <tr key={u.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-foreground">{u.hoTen}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                    <td className="px-5 py-3">
                      <Badge variant={role.variant}>{role.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={u.isActive ? 'green' : 'red'}>
                        {u.isActive ? 'Hoạt động' : 'Bị khóa'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="text-xs text-muted-foreground">Luôn có</span>
                      ) : u.role === 'VIEWER' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <button
                          onClick={() => handleToggleNotify(u)}
                          title={u.canSendNotification ? 'Thu hồi quyền gửi' : 'Cấp quyền gửi'}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            u.canSendNotification
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {u.canSendNotification ? <Bell size={11} /> : <BellOff size={11} />}
                          {u.canSendNotification ? 'Có quyền' : 'Không có'}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded hover:bg-secondary transition-colors ${u.isActive ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-green-600'}`}
                          title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                        >
                          {u.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </DataTable>

          <div className="table-footer">
            <span className="table-count">Hiển thị {filtered.length} / {users.length} tài khoản</span>
          </div>
        </div>
      )}

      {/* Modal Thêm tài khoản */}
      <Modal
        title="Thêm tài khoản mới"
        open={showAdd}
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={handleAdd} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Tạo tài khoản'}
            </PrimaryBtn>
          </>
        }
      >
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}
        <FormInput
          label="Họ và tên"
          required
          placeholder="Nguyễn Văn A"
          value={form.hoTen}
          onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))}
        />
        <FormInput
          label="Tên đăng nhập"
          required
          placeholder="nguyenvana (tối thiểu 3 ký tự)"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value.trim() }))}
        />
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Mật khẩu <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="Tối thiểu 6 ký tự"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 pr-10 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <Select
          label="Phân quyền"
          value={form.role}
          onChange={val => setForm(f => ({ ...f, role: val }))}
          options={ROLE_OPTIONS}
        />
        <div className="text-xs text-muted-foreground bg-secondary rounded-md px-3 py-2">
          <strong>Lưu ý:</strong> Tài khoản mới sẽ được kích hoạt ngay sau khi tạo.
        </div>
      </Modal>

      {/* Modal Chỉnh sửa tài khoản */}
      <Modal
        title="Chỉnh sửa tài khoản"
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
          label="Họ và tên"
          required
          value={editForm.hoTen}
          onChange={e => setEditForm(f => ({ ...f, hoTen: e.target.value }))}
        />
        <Select
          label="Phân quyền"
          value={editForm.role}
          onChange={val => setEditForm(f => ({ ...f, role: val }))}
          options={ROLE_OPTIONS}
        />
      </Modal>
    </div>
  )
}
