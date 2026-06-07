import '../styles/cai-dat.css'
import { useState, useEffect } from 'react'
import { Save, Globe, Bell, Shield, Key, Users, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { PageHeader, PrimaryBtn, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import * as authService from '../services/authService'

const menu = [
  { icon: Globe,   label: 'Thông tin đơn vị',     id: 'info' },
  { icon: Bell,    label: 'Thông báo hệ thống',    id: 'notify' },
  { icon: Key,     label: 'Tài khoản & Mật khẩu', id: 'account' },
  { icon: Users,   label: 'Quản lý người dùng',    id: 'users' },
  { icon: Shield,  label: 'Bảo mật & Phân quyền', id: 'security' },
]

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
          {active === 'security' && <ComingSoon />}
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

  return (
    <>
      <p className="cd-section-title">Thông tin tài khoản</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Input label="Họ tên"        value={user?.hoTen    || ''} readOnly />
        <Input label="Tên đăng nhập" value={user?.username || ''} readOnly />
        <Input label="Phân quyền"    value={user?.role     || ''} readOnly />
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

/* ── Quản lý người dùng (xem nhanh) ── */
function UsersPanel({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!isSuperAdmin) { setLoading(false); return }
    authService.getUsers()
      .then(res => setUsers(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isSuperAdmin])

  if (!isSuperAdmin) return <div className="text-sm text-muted-foreground py-8 text-center">Cần quyền SUPER_ADMIN để xem tính năng này.</div>

  return (
    <>
      <p className="cd-section-title">Tài khoản hệ thống ({users.length})</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-secondary border border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">{u.hoTen}</p>
                <p className="text-xs text-muted-foreground">{u.username} · {u.role}</p>
              </div>
              <span className={`text-xs font-semibold ${u.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                {u.isActive ? 'Hoạt động' : 'Bị khóa'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ComingSoon() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-muted-foreground">Tính năng đang phát triển</p>
    </div>
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
