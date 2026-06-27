import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm', className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-semibold leading-none tracking-tight text-slate-800', className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}
export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />
}
