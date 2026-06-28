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

export function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary/25"
    >
      {children}
    </button>
  )
}

export function SecondaryBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-foreground bg-card border border-border hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'default' }) {
  const cls = {
    default: 'bg-secondary text-secondary-foreground',
    blue:    'bg-blue-100 text-blue-700',
    green:   'bg-emerald-100 text-emerald-700',
    red:     'bg-red-100 text-red-700',
    amber:   'bg-amber-100 text-amber-700',
    orange:  'bg-orange-100 text-orange-700',
    purple:  'bg-violet-100 text-violet-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls[variant] || cls.default}`}>
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
    <div className="flex items-center gap-1 p-1 bg-secondary rounded-md">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all ${
            active === tab
              ? 'bg-card text-primary font-semibold shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
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
      className="p-1.5 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      style={{ color }}
    >
      <Icon size={14} />
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
