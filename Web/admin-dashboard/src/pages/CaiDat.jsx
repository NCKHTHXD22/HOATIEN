import '../styles/cai-dat.css'
import { useState, useEffect } from 'react'
import { Save, Globe, Bell, Shield, Key, Users, Eye, EyeOff, CheckCircle, Plus, Lock } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, Input, Modal, Select, FormInput, Badge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import * as authService from '../services/authService'

const menu = [
  { icon: Globe,   label: 'Thông tin đơn vị',     id: 'info' },
  { icon: Bell,    label: 'Thông báo hệ thống',    id: 'notify' },
  { icon: Key,     label: 'Tài khoản & Mật khẩu', id: 'account' },
  { icon: Users,   label: 'Quản lý người dùng',    id: 'users' },
  { icon: Shield,  label: 'Bảo mật & Phân quyền', id: 'security' },
]

const ROLE_LABEL = {
  SUPER_ADMIN:   { label: 'Quản trị viên', desc: 'Toàn quyền hệ thống', variant: 'purple' },
  ADMIN_VILLAGE: { label: 'Cán bộ thôn',   desc: 'Quản lý hộ dân & thông báo', variant: 'blue' },
  VIEWER:        { label: 'Chỉ xem',       desc: 'Chỉ xem, không chỉnh sửa', variant: 'default' },
}
const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN',   label: 'Quản trị viên (Super Admin)' },
  { value: 'ADMIN_VILLAGE', label: 'Cán bộ thôn (Admin Village)' },
  { value: 'VIEWER',        label: 'Chỉ xem (Viewer)' },
]
const EMPTY_FORM = { hoTen: '', username: '', password: '', role: 'VIEWER' }

export default function CaiDat() {
  const { user: currentUser } = useAuth()
  const [active, setActive] = useState('info')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cài đặt hệ thống" subtitle="Cấu hình thông tin và hoạt động của UBND Xã Hòa Tiến" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="cd-nav">
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`cd-nav-item ${active === item.id ? 'cd-nav-item-on' : ''}`}
            >
              <item.icon size={15} className="shrink-0" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="cd-panel">
          {active === 'info'    && <InfoPanel />}
          {active === 'notify'  && <NotifyPanel />}
          {active === 'account' && <AccountPanel user={currentUser} />}
          {active === 'users'   && <UsersPanel currentUser={currentUser} />}
          {active === 'security' && <SecurityPanel />}
        </div>
      </div>
    </div>
  )
}

/* ── Thông tin đơn vị ── */
function InfoPanel() {
  return (
    <>
      <p className="cd-section-title">Thông tin đơn vị</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input label="Tên đơn vị" defaultValue="UBND Xã Hòa Tiến" />
        </div>
        <Input label="Mã đơn vị"     defaultValue="501140101" />
        <Input label="Điện thoại"    placeholder="0236 3xxx xxx" />
        <Input label="Email công vụ" placeholder="hoatien@danang.gov.vn" />
        <Input label="Mã số thuế"    placeholder="" />
        <div className="sm:col-span-2">
          <Input label="Địa chỉ" defaultValue="Xã Hòa Tiến, Huyện Hòa Vang, Tp. Đà Nẵng" />
        </div>
        <div className="sm:col-span-2">
          <Input label="Website cổng thông tin" placeholder="https://hoatien.danang.gov.vn" />
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <PrimaryBtn><Save size={14} /> Lưu thay đổi</PrimaryBtn>
      </div>
    </>
  )
}

/* ── Thông báo ── */
function NotifyPanel() {
  return (
    <>
      <p className="cd-section-title">Cài đặt thông báo</p>
      {[
        'Thông báo khi có hộ dân mới',
        'Thông báo biến động dân số',
        'Thông báo phản ánh mới từ công dân',
        'Thông báo văn bản đến',
        'Email tóm tắt hoạt động hàng ngày',
      ].map(item => (
        <div key={item} className="cd-row">
          <span className="cd-row-label">{item}</span>
          <Toggle />
        </div>
      ))}
      <div className="flex justify-end mt-6">
        <PrimaryBtn><Save size={14} /> Lưu thay đổi</PrimaryBtn>
      </div>
    </>
  )
}

/* ── Tài khoản & Mật khẩu ── */
function AccountPanel({ user }) {
  const [pw, setPw] = useState({ old: '', new: '', confirm: '' })
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok'|'err', text }

  const handleChangePw = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (pw.new !== pw.confirm) { setMsg({ type: 'err', text: 'Mật khẩu mới không khớp' }); return }
    if (pw.new.length < 6)     { setMsg({ type: 'err', text: 'Mật khẩu mới phải ít nhất 6 ký tự' }); return }
    setLoading(true)
    try {
      await authService.changePassword(pw.old, pw.new)
      setMsg({ type: 'ok', text: 'Đổi mật khẩu thành công' })
      setPw({ old: '', new: '', confirm: '' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Đổi mật khẩu thất bại' })
    } finally {
      setLoading(false)
    }
  }

  const role = ROLE_LABEL[user?.role] || { label: user?.role || '', desc: '', variant: 'default' }

  return (
    <>
      <p className="cd-section-title">Thông tin tài khoản</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Input label="Họ tên"        value={user?.hoTen    || ''} readOnly />
        <Input label="Tên đăng nhập" value={user?.username || ''} readOnly />
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Phân quyền</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-input">
            <Badge variant={role.variant}>{role.label}</Badge>
            <span className="text-xs text-muted-foreground">{role.desc}</span>
          </div>
        </div>
      </div>

      <p className="cd-section-title mt-6">Đổi mật khẩu</p>
      <form onSubmit={handleChangePw} className="space-y-4 max-w-sm">
        {msg && (
          <div className={`text-xs rounded-md px-3 py-2 flex items-center gap-2 ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.type === 'ok' && <CheckCircle size={12} />}
            {msg.text}
          </div>
        )}
        <PasswordField label="Mật khẩu hiện tại" value={pw.old}     show={showOld} onToggle={() => setShowOld(v => !v)} onChange={v => setPw(p => ({ ...p, old: v }))} />
        <PasswordField label="Mật khẩu mới"      value={pw.new}     show={showNew} onToggle={() => setShowNew(v => !v)} onChange={v => setPw(p => ({ ...p, new: v }))} />
        <PasswordField label="Xác nhận mật khẩu" value={pw.confirm} show={showNew} onToggle={() => setShowNew(v => !v)} onChange={v => setPw(p => ({ ...p, confirm: v }))} />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          <Save size={14} />
          {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </>
  )
}

/* ── Quản lý người dùng (xem + thêm tài khoản) ── */
function UsersPanel({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = () => {
    if (!isSuperAdmin) { setLoading(false); return }
    authService.getUsers()
      .then(res => setUsers(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers() }, [isSuperAdmin])

  if (!isSuperAdmin) return <div className="text-sm text-muted-foreground py-8 text-center">Cần quyền SUPER_ADMIN để xem tính năng này.</div>

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setShowPwd(false); setShowAdd(true) }
  const handleAdd = async () => {
    if (!form.hoTen.trim())       { setError('Vui lòng nhập họ tên'); return }
    if (!form.username.trim())    { setError('Vui lòng nhập tên đăng nhập'); return }
    if (form.username.length < 3) { setError('Tên đăng nhập phải có ít nhất 3 ký tự'); return }
    if (!form.password)           { setError('Vui lòng nhập mật khẩu'); return }
    if (form.password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return }
    setSaving(true); setError('')
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
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="cd-section-title !mb-0">Tài khoản hệ thống ({users.length})</p>
        <PrimaryBtn onClick={openAdd}><Plus size={14} /> Thêm tài khoản</PrimaryBtn>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const role = ROLE_LABEL[u.role] || { label: u.role, desc: '', variant: 'default' }
            return (
              <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-secondary border border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">{u.hoTen}</p>
                  <p className="text-xs text-muted-foreground">{u.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={role.variant}>{role.label}</Badge>
                  <span className={`text-xs font-semibold ${u.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {u.isActive ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal title="Thêm tài khoản mới" open={showAdd} onClose={() => setShowAdd(false)}
        footer={<><SecondaryBtn onClick={() => setShowAdd(false)}>Hủy</SecondaryBtn><PrimaryBtn onClick={handleAdd} disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo tài khoản'}</PrimaryBtn></>}>
        {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
        <FormInput label="Họ và tên" required placeholder="Nguyễn Văn A" value={form.hoTen} onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))} />
        <FormInput label="Tên đăng nhập" required placeholder="nguyenvana (tối thiểu 3 ký tự)" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.trim() }))} />
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Mật khẩu <span className="text-destructive">*</span></label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="Tối thiểu 6 ký tự"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 pr-10 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <Select label="Phân quyền" value={form.role} onChange={val => setForm(f => ({ ...f, role: val }))} options={ROLE_OPTIONS} />
        <div className="text-xs text-muted-foreground bg-secondary rounded-md px-3 py-2">
          <strong>Lưu ý:</strong> Tài khoản mới sẽ được kích hoạt ngay sau khi tạo.
        </div>
      </Modal>
    </>
  )
}

/* ── Bảo mật & Phân quyền (ma trận quyền hệ thống, chỉ xem) ── */
const PERMISSION_MATRIX = [
  { module: 'Hộ dân / Nhân khẩu / Biến động', SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Thêm, sửa (không xóa hộ)', VIEWER: 'Chỉ xem' },
  { module: 'Thôn / Địa bàn',                  SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Sửa (không thêm/xóa)',     VIEWER: 'Chỉ xem' },
  { module: 'Thông báo & Khảo sát',            SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Soạn, gửi (nếu được cấp quyền gửi)', VIEWER: 'Chỉ xem' },
  { module: 'Zalo OA (followers, cấu hình)',   SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Xem, đồng bộ, gửi (nếu được cấp quyền)', VIEWER: 'Không truy cập' },
  { module: 'Báo cáo & Xuất file',             SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Xem, xuất',                 VIEWER: 'Xem, xuất' },
  { module: 'Quản lý tài khoản',               SUPER_ADMIN: 'Toàn quyền', ADMIN_VILLAGE: 'Không truy cập',           VIEWER: 'Không truy cập' },
]

function SecurityPanel() {
  return (
    <>
      <p className="cd-section-title">Ma trận phân quyền hệ thống</p>
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
        <Lock size={12} /> Đây là bảng tổng hợp chỉ xem, phản ánh đúng quyền hạn đang áp dụng trong hệ thống theo 3 vai trò.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary text-left">
              <th className="px-3 py-2.5 font-semibold text-foreground">Module</th>
              <th className="px-3 py-2.5 font-semibold text-foreground">Quản trị viên</th>
              <th className="px-3 py-2.5 font-semibold text-foreground">Cán bộ thôn</th>
              <th className="px-3 py-2.5 font-semibold text-foreground">Chỉ xem</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.map(row => (
              <tr key={row.module} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium text-foreground">{row.module}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.SUPER_ADMIN}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.ADMIN_VILLAGE}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.VIEWER}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ── Helpers ── */
function Toggle() {
  const [on, setOn] = useState(false)
  return (
    <button onClick={() => setOn(o => !o)} className={`cd-toggle ${on ? 'cd-toggle-on' : 'cd-toggle-off'}`}>
      <span className={`cd-toggle-thumb ${on ? 'cd-toggle-thumb-on' : ''}`} />
    </button>
  )
}

function PasswordField({ label, value, show, onToggle, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          required
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-9 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
        />
        <button type="button" onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  )
}
