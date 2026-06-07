import '../styles/cai-dat.css'
import { useState } from 'react'
import { Save, Globe, Bell, Shield, Database, Key, Users } from 'lucide-react'
import { PageHeader, PrimaryBtn, Input } from '../components/ui'

const menu = [
  { icon: Globe,    label: 'Thông tin đơn vị',     id: 'info' },
  { icon: Bell,     label: 'Thông báo hệ thống',    id: 'notify' },
  { icon: Shield,   label: 'Bảo mật & Phân quyền', id: 'security' },
  { icon: Key,      label: 'Tài khoản & Mật khẩu', id: 'account' },
  { icon: Users,    label: 'Quản lý người dùng',    id: 'users' },
  { icon: Database, label: 'Sao lưu & Khôi phục',  id: 'backup' },
]

export default function CaiDat() {
  const [active, setActive] = useState('info')

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cài đặt hệ thống" subtitle="Cấu hình thông tin và hoạt động của UBND Xã Hòa Tiến" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Side nav */}
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

        {/* Panel */}
        <div className="cd-panel">
          {active === 'info' && (
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
          )}

          {active === 'notify' && (
            <>
              <p className="cd-section-title">Cài đặt thông báo</p>
              {[
                'Thông báo khi có hồ sơ mới',
                'Thông báo hồ sơ sắp quá hạn',
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
          )}

          {active !== 'info' && active !== 'notify' && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">Tính năng đang phát triển</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Toggle() {
  const [on, setOn] = useState(false)
  return (
    <button
      onClick={() => setOn(o => !o)}
      className={`cd-toggle ${on ? 'cd-toggle-on' : 'cd-toggle-off'}`}
    >
      <span className={`cd-toggle-thumb ${on ? 'cd-toggle-thumb-on' : ''}`} />
    </button>
  )
}
