import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Search, Link2, Link2Off, Loader2, Users, CheckCircle2, XCircle, Phone,
} from 'lucide-react'

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function Avatar({ name, avatar }) {
  if (avatar) {
    return <img src={avatar} alt={name} className="h-9 w-9 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function MemberCombobox({ onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const dq = useDebounce(query, 300)
  const ref = useRef(null)

  const { data, isFetching } = useQuery({
    queryKey: ['member-search', dq],
    queryFn: () =>
      api.get(`/api/members/search?q=${encodeURIComponent(dq)}`).then(r => r.data?.data ?? []),
    enabled: dq.length >= 2,
    staleTime: 30000,
  })

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Tìm tên / SĐT nhân khẩu..."
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => dq.length >= 2 && setOpen(true)}
          className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 disabled:opacity-50"
        />
        {isFetching && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-slate-400" />
        )}
      </div>

      {open && dq.length >= 2 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {!data || data.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 text-center">Không tìm thấy</p>
          ) : (
            data.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={() => { onSelect(m); setQuery(''); setOpen(false) }}
                className="w-full flex flex-col items-start px-3 py-2 hover:bg-blue-50 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-slate-800">{m.hoTen}</span>
                <span className="text-[11px] text-slate-400">
                  {[m.sdt, m.household?.village?.ten, `Hộ ${m.household?.soHoKhau}`]
                    .filter(Boolean).join(' · ')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FollowerRow({ follower, onLink, onUnlink, onRequestInfo, linking, unlinking, requesting }) {
  const [selected, setSelected] = useState(null)
  const linked = follower.linkedMember

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors">
      <Avatar name={follower.display_name || follower.user_id} avatar={follower.avatar} />

      {/* Tên Zalo */}
      <div className="w-36 shrink-0 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {follower.display_name || (
            <span className="italic text-slate-400">Không tên</span>
          )}
        </p>
        <p className="text-[11px] text-slate-400 font-mono truncate">{follower.user_id}</p>
        {follower.phone && (
          <p className="text-[11px] text-emerald-600 font-mono truncate flex items-center gap-0.5">
            <Phone className="h-2.5 w-2.5" /> {follower.phone}
          </p>
        )}
      </div>

      {/* Khu vực link */}
      <div className="flex-1 min-w-0">
        {linked ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{linked.hoTen}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {[linked.sdt, linked.household?.village?.ten].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MemberCombobox onSelect={setSelected} disabled={linking} />
            {selected && (
              <div className="flex items-center gap-1 shrink-0 max-w-[140px] bg-blue-50 border border-blue-100 rounded-md px-2 py-1">
                <span className="text-xs font-semibold text-blue-700 truncate">{selected.hoTen}</span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-blue-300 hover:text-blue-500 shrink-0"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nút hành động */}
      <div className="shrink-0">
        {linked ? (
          <button
            type="button"
            onClick={() => onUnlink(follower.user_id)}
            disabled={unlinking}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors disabled:opacity-40"
          >
            {unlinking
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Link2Off className="h-3 w-3" />}
            Hủy
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRequestInfo(follower)}
              disabled={requesting}
              title="Gửi form Zalo xin dân chia sẻ SĐT — dân bấm đồng ý là tự động liên kết"
              className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors disabled:opacity-40"
            >
              {requesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
              Xin SĐT
            </button>
            <button
              type="button"
              onClick={() => { if (selected) onLink(follower.user_id, selected.id, () => setSelected(null)) }}
              disabled={!selected || linking}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Link2 className="h-3 w-3" />}
              Liên kết
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ZaloLinkPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [linkingId, setLinkingId] = useState(null)
  const [unlinkingId, setUnlinkingId] = useState(null)
  const [requestingId, setRequestingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['zalo-followers-linked'],
    queryFn: () => api.get('/api/broadcast/followers').then(r => r.data),
    staleTime: 30000,
  })

  const followers = data?.followers ?? []
  const linkedCount = useMemo(() => followers.filter(f => !!f.linkedMember).length, [followers])
  const pct = followers.length > 0 ? Math.round((linkedCount / followers.length) * 100) : 0

  const filtered = useMemo(() => {
    let list = followers
    if (filter === 'linked')   list = list.filter(f => !!f.linkedMember)
    if (filter === 'unlinked') list = list.filter(f => !f.linkedMember)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.display_name?.toLowerCase().includes(q) ||
        f.user_id?.includes(q) ||
        f.phone?.includes(q) ||
        f.linkedMember?.hoTen?.toLowerCase().includes(q)
      )
    }
    return list
  }, [followers, filter, search])

  const handleLink = async (userId, memberId, onSuccess) => {
    setLinkingId(userId)
    try {
      await api.post(`/api/broadcast/followers/${userId}/link`, { memberId })
      toast.success('Đã liên kết thành công')
      onSuccess?.()
      queryClient.invalidateQueries({ queryKey: ['zalo-followers-linked'] })
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Lỗi liên kết')
    } finally {
      setLinkingId(null)
    }
  }

  const handleUnlink = async (userId) => {
    setUnlinkingId(userId)
    try {
      await api.delete(`/api/broadcast/followers/${userId}/link`)
      toast.success('Đã hủy liên kết')
      queryClient.invalidateQueries({ queryKey: ['zalo-followers-linked'] })
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Lỗi hủy liên kết')
    } finally {
      setUnlinkingId(null)
    }
  }

  const handleRequestInfo = async (follower) => {
    const name = follower.display_name || follower.user_id
    if (!window.confirm(`Gửi form "Chia sẻ thông tin" tới ${name}?\nDân bấm đồng ý là hệ thống tự liên kết theo SĐT.`)) return
    setRequestingId(follower.user_id)
    try {
      await api.post(`/api/broadcast/followers/${follower.user_id}/request-info`)
      toast.success(`Đã gửi form xin SĐT tới ${name}`)
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Lỗi gửi form (chú ý luật 48h của Zalo)')
    } finally {
      setRequestingId(null)
    }
  }

  const FILTERS = [
    { val: 'all',      label: 'Tất cả',       count: followers.length },
    { val: 'unlinked', label: 'Chưa liên kết', count: followers.length - linkedCount },
    { val: 'linked',   label: 'Đã liên kết',   count: linkedCount },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[1.7rem] font-extrabold text-foreground tracking-tight">
          Liên kết Zalo ↔ Nhân khẩu
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Ghép đôi tài khoản Zalo follower với nhân khẩu để gửi thông báo theo thôn chính xác
        </p>
      </div>

      {/* Stats card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="h-4 w-4 text-slate-400" />
            <span>
              <span className="font-bold text-slate-900">{linkedCount}</span>
              <span className="text-slate-400"> / {followers.length}</span>
              <span> follower đã liên kết nhân khẩu</span>
            </span>
          </div>
          <span className={`text-sm font-bold ${pct >= 50 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {linkedCount === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Chưa có follower nào được liên kết. Hãy liên kết để tính năng "Thêm cả thôn" hoạt động chính xác.
          </p>
        )}
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {FILTERS.map(({ val, label, count }) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === val
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên Zalo hoặc tên nhân khẩu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <div className="w-9 shrink-0" />
          <div className="w-36 shrink-0">Zalo Follower</div>
          <div className="flex-1">Nhân khẩu liên kết</div>
          <div className="w-20 shrink-0 text-right">Thao tác</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <FollowerRow
                key={f.user_id}
                follower={f}
                onLink={handleLink}
                onUnlink={handleUnlink}
                onRequestInfo={handleRequestInfo}
                linking={linkingId === f.user_id}
                unlinking={unlinkingId === f.user_id}
                requesting={requestingId === f.user_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
