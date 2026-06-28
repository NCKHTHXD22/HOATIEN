import '../styles/nhan-su.css'
import { useState, useEffect } from 'react'
import { Plus, Filter, Users, UserCheck, UserX, Eye, EyeOff, Pencil, Lock, Unlock, Bell, BellOff } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge, Modal, Select, FormInput } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import * as authService from '../services/authService'
import { api } from '../lib/api'

const ROLE_LABEL = {
  SUPER_ADMIN:   { label: 'Quản trị viên', variant: 'purple' },
  DEPT_LEADER:   { label: 'Lãnh đạo phòng', variant: 'orange' },
  OFFICER:       { label: 'Cán bộ thụ lý', variant: 'green' },
  ADMIN_VILLAGE: { label: 'CB thôn',       variant: 'blue' },
  VIEWER:        { label: 'Xem',           variant: 'default' },
}

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN',   label: 'Quản trị viên (Super Admin)' },
  { value: 'DEPT_LEADER',   label: 'Lãnh đạo phòng (Dept Leader)' },
  { value: 'OFFICER',       label: 'Cán bộ thụ lý (Officer)' },
  { value: 'ADMIN_VILLAGE', label: 'Cán bộ thôn (Admin Village)' },
  { value: 'VIEWER',        label: 'Chỉ xem (Viewer)' },
]

const COLUMNS = ['Họ tên', 'Tên đăng nhập', 'Phân quyền', 'Lĩnh vực', 'Trạng thái', 'Gửi TB', 'Ngày tạo', '']

const EMPTY_FORM = { hoTen: '', username: '', password: '', role: 'VIEWER', categoryIds: [] }

export default function NhanSu() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Add/Edit modal state
  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    const actionText = next ? 'Mở khóa' : 'Khóa'
    if (!window.confirm(`Xác nhận ${actionText.toLowerCase()} tài khoản này?`)) return
    try {
      await authService.updateUser(u.id, { isActive: next })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: next } : x))
    } catch (e) {
      alert(e.response?.data?.message || `${actionText} thất bại`)
    }
  }

  const loadUsers = () => {
    if (!isSuperAdmin) { setLoading(false); return }
    authService.getUsers()
      .then(res => setUsers(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const loadCategories = () => {
    api.get('/api/categories')
      .then(res => setCategories(res.data.categories || []))
      .catch(console.error)
  }

  useEffect(() => {
    loadUsers()
    if (isSuperAdmin) {
      loadCategories()
    }
  }, [isSuperAdmin])

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
    setEditingUser(null)
    setError('')
    setShowPwd(false)
    setShowAdd(true)
  }

  const openEdit = (u) => {
    setForm({
      hoTen: u.hoTen || '',
      username: u.username || '',
      password: '',
      role: u.role || 'VIEWER',
      categoryIds: u.categoryIds || []
    })
    setEditingUser(u)
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

  const handleEdit = async () => {
    if (!form.hoTen.trim()) { setError('Vui lòng nhập họ tên'); return }
    setSaving(true)
    setError('')
    try {
      await authService.updateUser(editingUser.id, {
        hoTen: form.hoTen,
        role: form.role,
        categoryIds: form.categoryIds || []
      })
      setShowAdd(false)
      setLoading(true)
      loadUsers()
    } catch (e) {
      setError(e.response?.data?.message || 'Cập nhật tài khoản thất bại')
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
                const userCats = u.categoryIds || []
                const catNames = userCats.map(cid => {
                  const found = categories.find(c => c._id === cid)
                  return found ? `${found.icon} ${found.name}` : ''
                }).filter(Boolean).join(', ')

                return (
                  <tr key={u.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-foreground">{u.hoTen}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                    <td className="px-5 py-3">
                      <Badge variant={role.variant}>{role.label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={catNames}>
                      {catNames || '—'}
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
                          className="p-1.5 rounded-md hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded-md hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer ${u.isActive ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-green-600 hover:bg-green-600/10'}`}
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

      {/* Modal Thêm/Sửa tài khoản */}
      <Modal
        title={editingUser ? "Chỉnh sửa tài khoản" : "Thêm tài khoản mới"}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn>
            <PrimaryBtn onClick={editingUser ? handleEdit : handleAdd} disabled={saving}>
              {saving ? 'Đang lưu...' : (editingUser ? 'Cập nhật' : 'Tạo tài khoản')}
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
        {!editingUser && (
          <>
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </>
        )}
        <Select
          label="Phân quyền"
          value={form.role}
          onChange={val => setForm(f => ({ ...f, role: val }))}
          options={ROLE_OPTIONS}
        />

        {(form.role === 'DEPT_LEADER' || form.role === 'OFFICER') && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Lĩnh vực phụ trách
            </label>
            <div className="grid grid-cols-2 gap-2 bg-secondary/35 p-3 rounded-lg border border-border">
              {categories.map(c => {
                const checked = form.categoryIds?.includes(c._id)
                return (
                  <label key={c._id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(form.categoryIds || []), c._id]
                          : (form.categoryIds || []).filter(x => x !== c._id)
                        setForm(f => ({ ...f, categoryIds: next }))
                      }}
                      className="rounded border-slate-300"
                    />
                    <span>{c.icon} {c.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-secondary rounded-md px-3 py-2">
          <strong>Lưu ý:</strong> Tài khoản mới sẽ được kích hoạt ngay sau khi tạo.
        </div>
      </Modal>
    </div>
  )
}
