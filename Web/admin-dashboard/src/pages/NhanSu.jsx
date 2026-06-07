import '../styles/nhan-su.css'
import { useState, useEffect } from 'react'
import { Plus, Filter, Users, UserCheck, UserX } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import * as authService from '../services/authService'

const ROLE_LABEL = {
  SUPER_ADMIN:   { label: 'Quản trị viên', variant: 'purple' },
  ADMIN_VILLAGE: { label: 'CB thôn',       variant: 'blue' },
  VIEWER:        { label: 'Xem',           variant: 'default' },
}

const COLUMNS = ['Họ tên', 'Tên đăng nhập', 'Phân quyền', 'Trạng thái', '']

export default function NhanSu() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSuperAdmin) { setLoading(false); return }
    authService.getUsers()
      .then(res => setUsers(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
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

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cán bộ – Tài khoản hệ thống"
        subtitle="Danh sách tài khoản quản trị UBND Xã Hòa Tiến"
        action={
          isSuperAdmin && (
            <div className="flex gap-2">
              <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
              <PrimaryBtn><Plus size={14} /> Thêm tài khoản</PrimaryBtn>
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
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
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
    </div>
  )
}
