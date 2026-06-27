import { cn } from '@/lib/utils'

const VARIANTS = {
  default:     'bg-blue-600 text-white hover:bg-blue-700',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  outline:     'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  secondary:   'bg-slate-100 text-slate-700 hover:bg-slate-200',
  ghost:       'hover:bg-slate-100 text-slate-700',
  link:        'text-blue-600 underline-offset-4 hover:underline',
}
const SIZES = {
  default: 'h-10 px-4 py-2',
  sm:      'h-9 rounded-md px-3 text-xs',
  lg:      'h-11 rounded-md px-8',
  icon:    'h-10 w-10',
}

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.default,
        className
      )}
      {...props}
    />
  )
}
