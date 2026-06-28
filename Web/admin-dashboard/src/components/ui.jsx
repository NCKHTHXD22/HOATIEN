// UI primitives — uses design-system tokens from tailwind.config.js
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-card text-card-foreground rounded-xl p-5 border border-border shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[1.7rem] font-extrabold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/* Hệ màu gradient riêng cho từng loại hành động — mỗi variant một "đặc trưng" màu sắc */
const BTN_GRADIENTS = {
  primary: { bg: 'linear-gradient(135deg,#2563eb,#0ea5e9)', shadow: 'shadow-blue-500/30 hover:shadow-blue-500/40' },
  danger:  { bg: 'linear-gradient(135deg,#dc2626,#e11d48)', shadow: 'shadow-red-500/30 hover:shadow-red-500/40' },
  warning: { bg: 'linear-gradient(135deg,#d97706,#facc15)', shadow: 'shadow-amber-500/30 hover:shadow-amber-500/40' },
  accent:  { bg: 'linear-gradient(135deg,#ea580c,#fb923c)', shadow: 'shadow-orange-500/30 hover:shadow-orange-500/40' },
  success: { bg: 'linear-gradient(135deg,#16a34a,#10b981)', shadow: 'shadow-emerald-500/30 hover:shadow-emerald-500/40' },
  purple:  { bg: 'linear-gradient(135deg,#7c3aed,#d946ef)', shadow: 'shadow-violet-500/30 hover:shadow-violet-500/40' },
}

function GradientBtn({ variant = 'primary', children, onClick, disabled, type }) {
  const g = BTN_GRADIENTS[variant] || BTN_GRADIENTS.primary
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ background: g.bg }}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white
        shadow-md ${g.shadow} hover:shadow-lg hover:brightness-110 hover:-translate-y-0.5
        active:translate-y-0 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
        transition-all duration-200`}
    >
      {children}
    </button>
  )
}

/** Hành động chính (lưu, thêm, xác nhận) — xanh dương */
export function PrimaryBtn(props) { return <GradientBtn variant="primary" {...props} /> }
/** Hành động phá hủy (xóa) — đỏ */
export function DangerBtn(props) { return <GradientBtn variant="danger" {...props} /> }
/** Hành động cảnh báo (khóa, đóng, từ chối) — vàng/cam đậm */
export function WarningBtn(props) { return <GradientBtn variant="warning" {...props} /> }
/** Hành động phụ nổi bật (gộp, tách, chuyển) — cam */
export function AccentBtn(props) { return <GradientBtn variant="accent" {...props} /> }
/** Hành động xác nhận tích cực (duyệt, mở khóa, kích hoạt) — xanh lá */
export function SuccessBtn(props) { return <GradientBtn variant="success" {...props} /> }
/** Hành động đặc biệt/nổi bật — tím */
export function PurpleBtn(props) { return <GradientBtn variant="purple" {...props} /> }

export function SecondaryBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-foreground bg-card
        border border-border hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:-translate-y-0.5
        active:translate-y-0 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed
        transition-all duration-200"
    >
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'default' }) {
  const cls = {
    default: 'bg-secondary text-secondary-foreground',
    blue:    'bg-gradient-to-r from-blue-500/15 to-sky-500/15 text-blue-700 ring-1 ring-blue-500/20',
    green:   'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 ring-1 ring-emerald-500/20',
    red:     'bg-gradient-to-r from-red-500/15 to-rose-500/15 text-red-700 ring-1 ring-red-500/20',
    amber:   'bg-gradient-to-r from-amber-500/15 to-yellow-500/15 text-amber-700 ring-1 ring-amber-500/20',
    orange:  'bg-gradient-to-r from-orange-500/15 to-amber-500/15 text-orange-700 ring-1 ring-orange-500/20',
    purple:  'bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-700 ring-1 ring-violet-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${cls[variant] || cls.default}`}>
      {children}
    </span>
  )
}

/* StatCard — gradient icon badge, coloured number — đồng bộ phong cách KPI card của Dashboard */
export function StatCard({ label, value, sub, icon: Icon, iconColor }) {
  return (
    <div className="bg-card text-card-foreground rounded-xl p-5 border border-border shadow-sm card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p>
          <p className="text-[2.2rem] font-black mt-2 leading-none" style={{ color: iconColor }}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-2.5">{sub}</p>}
        </div>
        {Icon && (
          <div
            className="shrink-0 rounded-2xl flex items-center justify-center"
            style={{
              width: 52, height: 52,
              background: `linear-gradient(135deg,${iconColor}26,${iconColor}12)`,
              boxShadow: `inset 0 0 0 1px ${iconColor}22`,
            }}
          >
            <Icon size={24} style={{ color: iconColor }} />
          </div>
        )}
      </div>
    </div>
  )
}

export function DataTable({ columns, children, empty = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary border-b border-border">
            {columns.map(col => (
              <th key={col} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-2xl">📭</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Chưa có dữ liệu</span>
                </div>
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={active === tab ? { background: 'linear-gradient(135deg,#2563eb,#0ea5e9)' } : undefined}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
            active === tab
              ? 'text-white font-semibold shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/70'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-input">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground shrink-0">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent text-sm flex-1 text-foreground placeholder:text-muted-foreground"
      />
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
      )}
      <input
        {...props}
        className="w-full px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
      />
    </div>
  )
}

export function ActionBtn({ icon: Icon, color = 'currentColor', onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-md hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 text-muted-foreground hover:text-foreground"
      onMouseEnter={e => { e.currentTarget.style.background = `${color}15` }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={14} style={{ color }} />
    </button>
  )
}

export function Modal({ title, open, onClose, children, footer, wide }) {
  if (!open) return null
  // Render qua portal vào document.body: nếu không, "fixed" bên trong sẽ bị
  // các ancestor có animation/transform (vd .animate-fade-in) biến thành
  // containing block riêng, khiến modal bị kẹt/che trong khung trang thay vì
  // phủ toàn viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-xl shadow-2xl w-full mx-4 max-h-[90vh] flex flex-col ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function Select({ label, value, onChange, options, required }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({ label, required, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <textarea
        {...props}
        rows={props.rows || 4}
        className="w-full px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none resize-none"
      />
    </div>
  )
}

export function FormInput({ label, required, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <input
        {...props}
        className="w-full px-3 py-2 rounded-md text-sm text-foreground bg-card border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none"
      />
    </div>
  )
}
