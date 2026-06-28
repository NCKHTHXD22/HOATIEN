import { cn } from '@/lib/utils'

/* Gradient riêng cho từng variant — đồng bộ phong cách nút màu của toàn hệ thống */
const GRADIENTS = {
  default:     'linear-gradient(135deg,#2563eb,#0ea5e9)',
  destructive: 'linear-gradient(135deg,#dc2626,#e11d48)',
  warning:     'linear-gradient(135deg,#d97706,#facc15)',
  success:     'linear-gradient(135deg,#16a34a,#10b981)',
  accent:      'linear-gradient(135deg,#ea580c,#fb923c)',
}
const VARIANTS = {
  default:     'text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  destructive: 'text-white shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  warning:     'text-white shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  success:     'text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  accent:      'text-white shadow-md shadow-orange-500/30 hover:shadow-lg hover:shadow-orange-500/40 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  outline:     'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 hover:-translate-y-0.5',
  secondary:   'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:-translate-y-0.5',
  ghost:       'hover:bg-slate-100 text-slate-700',
  link:        'text-blue-600 underline-offset-4 hover:underline',
}
const SIZES = {
  default: 'h-10 px-4 py-2',
  sm:      'h-9 rounded-md px-3 text-xs',
  lg:      'h-11 rounded-md px-8',
  icon:    'h-10 w-10',
}

export function Button({ className, variant = 'default', size = 'default', style, ...props }) {
  const gradient = GRADIENTS[variant]
  return (
    <button
      style={gradient ? { background: gradient, ...style } : style}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.default,
        className
      )}
      {...props}
    />
  )
}
