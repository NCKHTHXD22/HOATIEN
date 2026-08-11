import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Megaphone, Plus, Search, Loader2, Trash2, Image as ImageIcon, X, Download,
  Send, Eye, Share2, ThumbsUp, MessageCircle, ExternalLink, RefreshCw, Video,
  Type, FileText, ArrowUp, ArrowDown,
} from 'lucide-react'

const STATUS = {
  success: { label: 'Thành công', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Không gửi được', cls: 'bg-red-100 text-red-600' },
  sending: { label: 'Đang gửi', cls: 'bg-amber-100 text-amber-700' },
}
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

/* ══ Quản lý broadcast ══ */
function ManageTab({ onCreate }) {
  const [source, setSource] = useState('zalo') // zalo | web
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">Quản lý broadcast</h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {[['zalo', 'Trên Zalo OA'], ['web', 'Tin gửi từ web']].map(([v, l]) => (
              <button key={v} onClick={() => setSource(v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${source === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={onCreate} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Tạo broadcast
        </button>
      </div>
      {source === 'zalo' ? <ZaloArticles /> : <WebPosts />}
    </div>
  )
}

/* ── Bài viết/broadcast THẬT trên OA Manager (Zalo Article API) ── */
const ZALO_ST = {
  show: { label: 'Đang hiển thị', cls: 'bg-emerald-100 text-emerald-700' },
  hide: { label: 'Đã ẩn', cls: 'bg-slate-100 text-slate-500' },
}
function ZaloArticles() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['zalo-articles'],
    queryFn: () => api.get('/api/broadcast/zalo-articles').then((r) => r.data),
  })

  const items = useMemo(() => {
    const s = q.toLowerCase()
    return (data?.items ?? []).filter((a) => {
      if (s && !a.title?.toLowerCase().includes(s)) return false
      if (status && a.status !== status) return false
      if (type && a.type !== type) return false
      if (from && a.createDate < new Date(from).getTime()) return false
      if (to && a.createDate > new Date(to + 'T23:59:59').getTime()) return false
      return true
    })
  }, [data, q, status, type, from, to])

  const [page, setPage] = useState(1)
  const perPage = 10
  useEffect(() => { setPage(1) }, [q, status, type, from, to])
  const paged = items.slice((page - 1) * perPage, page * perPage)

  const exportCsv = () => {
    const head = ['STT', 'Thời gian xuất bản', 'Tên broadcast', 'Loại', 'Lượt xem', 'Chia sẻ', 'Thích', 'Bình luận', 'Trạng thái']
    const rows = items.map((a, i) => [i + 1, fmt(a.createDate), `"${(a.title || '').replace(/"/g, '""')}"`, a.type === 'video' ? 'Video' : 'Bài viết', a.totalView, a.totalShare, a.totalLike, a.totalComment, ZALO_ST[a.status]?.label || a.status])
    const csv = '﻿' + [head, ...rows].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'broadcast-oa-zalo.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm broadcast"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700">
          <option value="">Tất cả loại</option>
          <option value="normal">Bài viết</option>
          <option value="video">Video</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700">
          <option value="">Chọn trạng thái</option>
          <option value="show">Đang hiển thị</option>
          <option value="hide">Đã ẩn</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700" />
        <span className="text-slate-400 text-sm">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700" />
        <button onClick={() => refetch()} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Làm mới</button>
        <button onClick={exportCsv} className="ml-auto flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"><Download className="h-3.5 w-3.5" /> Xuất thống kê</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400 text-left">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-40">Thời gian xuất bản</th>
                <th className="px-4 py-3">Tên broadcast</th>
                <th className="px-3 py-3 w-16 text-center">Lượt xem</th>
                <th className="px-3 py-3 w-14 text-center">Chia sẻ</th>
                <th className="px-3 py-3 w-14 text-center">Thích</th>
                <th className="px-3 py-3 w-16 text-center">Bình luận</th>
                <th className="px-4 py-3 w-32">Trạng thái</th>
                <th className="px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400">Không có broadcast nào trên OA</td></tr>
              ) : paged.map((a, i) => {
                const st = ZALO_ST[a.status] || { label: a.status, cls: 'bg-slate-100 text-slate-500' }
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{(page - 1) * perPage + i + 1}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(a.createDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {a.thumb
                            ? <img src={a.thumb} alt="" className="h-10 w-14 rounded object-cover border border-slate-100" />
                            : <div className="h-10 w-14 rounded bg-slate-100 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-slate-300" /></div>}
                          {a.type === 'video' && <span className="absolute inset-0 flex items-center justify-center"><Video className="h-4 w-4 text-white drop-shadow" /></span>}
                        </div>
                        <span className="font-medium text-slate-700 line-clamp-2">{a.title || '(Không tiêu đề)'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700"><span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-slate-300" />{a.totalView}</span></td>
                    <td className="px-3 py-3 text-center text-slate-500"><span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3 text-slate-300" />{a.totalShare}</span></td>
                    <td className="px-3 py-3 text-center text-slate-500"><span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-slate-300" />{a.totalLike}</span></td>
                    <td className="px-3 py-3 text-center text-slate-500"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-slate-300" />{a.totalComment}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                    <td className="px-3 py-3">
                      {a.linkView && <a href={a.linkView} target="_blank" rel="noreferrer" className="p-1.5 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 inline-flex"><ExternalLink className="h-3.5 w-3.5" /></a>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} perPage={perPage} total={items.length} onPage={setPage} />
      </div>
      <p className="text-[11px] text-slate-400">Dữ liệu thật lấy trực tiếp từ Zalo OA Manager.</p>
    </>
  )
}

/* ── Tin gửi từ web (message/cs) ── */
function WebPosts() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const debounce = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['broadcast-posts', q, status, from, to, page],
    queryFn: () => api.get('/api/broadcast/posts', { params: { q, status, from, to, page } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  const onSearch = (v) => { setQ(v); clearTimeout(debounce.current); debounce.current = setTimeout(() => setPage(1), 300) }
  const del = async (id) => {
    if (!window.confirm('Xóa broadcast này khỏi danh sách?')) return
    try { await api.delete(`/api/broadcast/posts/${id}`); queryClient.invalidateQueries({ queryKey: ['broadcast-posts'] }) }
    catch { toast.error('Lỗi xóa') }
  }
  const exportCsv = async () => {
    try {
      const res = await api.get('/api/broadcast/posts/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'broadcast-thong-ke.csv'; a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('Lỗi xuất thống kê') }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Tìm kiếm broadcast"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700">
          <option value="">Chọn trạng thái</option>
          <option value="success">Thành công</option>
          <option value="failed">Không gửi được</option>
          <option value="sending">Đang gửi</option>
        </select>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700" />
        <span className="text-slate-400 text-sm">→</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700" />
        <button onClick={exportCsv} className="ml-auto flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          <Download className="h-3.5 w-3.5" /> Xuất thống kê
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400 text-left">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-40">Thời gian xuất bản</th>
                <th className="px-4 py-3">Tên broadcast</th>
                <th className="px-4 py-3 w-20 text-center">Đã gửi</th>
                <th className="px-4 py-3 w-20 text-center">Lượt xem</th>
                <th className="px-4 py-3 w-32">Trạng thái</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">Chưa gửi tin nào từ web</td></tr>
              ) : items.map((b, i) => {
                const st = STATUS[b.status] || STATUS.sending
                return (
                  <tr key={b._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{(page - 1) * 20 + i + 1}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(b.publishedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {b.thumbnail
                          ? <img src={b.thumbnail} alt="" className="h-10 w-14 rounded object-cover shrink-0 border border-slate-100" />
                          : <div className="h-10 w-14 rounded bg-slate-100 flex items-center justify-center shrink-0"><ImageIcon className="h-4 w-4 text-slate-300" /></div>}
                        <span className="font-medium text-slate-700 line-clamp-2">{b.name || '(Không tên)'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{b.sent}{b.failed ? <span className="text-red-400 font-normal">/{b.failed} lỗi</span> : null}</td>
                    <td className="px-4 py-3 text-center text-slate-600"><span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-slate-300" />{b.views}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => del(b._id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-slate-50">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="text-xs text-slate-500 px-2">{page} / {totalPages}</span>
            <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        )}
      </div>
    </>
  )
}

/* ══ Tạo broadcast — soạn bài viết đăng THẬT lên OA (article/create) ══ */
const uid = () => Date.now() + '_' + Math.random().toString(36).slice(2, 7)
async function uploadArticleImage(file) {
  const fd = new FormData(); fd.append('image', file)
  const r = await api.post('/api/broadcast/articles/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
  return r.data.url
}

function CreateTab({ onDone }) {
  const [view, setView] = useState('broadcast') // broadcast | compose
  return view === 'compose'
    ? <ArticleComposer onBack={() => setView('broadcast')} onPublished={() => setView('broadcast')} />
    : <BroadcastSetup onCompose={() => setView('compose')} onSent={onDone} />
}

/* ── Ảnh 1: "Tạo broadcast" — chọn bài đã có → đối tượng gửi → gửi ── */
function BroadcastSetup({ onCompose, onSent }) {
  const [type, setType] = useState('normal')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState([]) // [{id,title,thumb,linkView}]
  const [aud, setAud] = useState('all')
  const [selGroups, setSelGroups] = useState(new Set())
  const [selFollowers, setSelFollowers] = useState(new Set())
  const [fSearch, setFSearch] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['zalo-articles'], queryFn: () => api.get('/api/broadcast/zalo-articles').then((r) => r.data) })
  const { data: fData } = useQuery({ queryKey: ['bc-followers'], queryFn: () => api.get('/api/broadcast/followers').then((r) => r.data) })
  const { data: gData } = useQuery({ queryKey: ['bc-groups'], queryFn: () => api.get('/api/broadcast/groups').then((r) => r.data) })
  const followers = fData?.followers ?? []
  const groups = gData?.groups ?? []

  const items = useMemo(() => {
    const s = q.toLowerCase()
    return (data?.items ?? []).filter((a) => a.type === type && (!s || a.title?.toLowerCase().includes(s)))
  }, [data, type, q])
  const [page, setPage] = useState(1)
  const perPage = 10
  useEffect(() => { setPage(1) }, [type, q])
  const paged = items.slice((page - 1) * perPage, page * perPage)
  const filteredFollowers = useMemo(() => {
    const s = fSearch.toLowerCase()
    return followers.filter((f) => !s || f.display_name?.toLowerCase().includes(s)).slice(0, 100)
  }, [followers, fSearch])

  const isSel = (id) => selected.some((x) => x.id === id)
  const toggleArt = (a) => setSelected((sel) => {
    if (sel.some((x) => x.id === a.id)) return sel.filter((x) => x.id !== a.id)
    if (sel.length >= 5) { toast.error('Tối đa 5 nội dung / broadcast'); return sel }
    return [...sel, { id: a.id, title: a.title, thumb: a.thumb, linkView: a.linkView }]
  })
  const toggleSet = (set, setSet, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setSet(n) }
  const preview = selected[selected.length - 1]

  const send = async () => {
    if (!selected.length) return toast.error('Chọn ít nhất 1 bài viết')
    let userIds = [], groupIds = []
    if (aud === 'all') userIds = followers.map((f) => f.user_id)
    else if (aud === 'groups') groupIds = [...selGroups]
    else userIds = [...selFollowers]
    if (!userIds.length && !groupIds.length) return toast.error('Chọn đối tượng gửi')
    const content = selected.map((a) => `📰 ${a.title}\n${a.linkView}`).join('\n\n')
    setSending(true)
    try {
      const { data: r } = await api.post('/api/broadcast/posts', {
        name: name.trim() || `Broadcast ${new Date().toLocaleDateString('vi-VN')}`,
        content, userIds, groupIds,
      })
      toast.success(`Đang gửi broadcast tới ${r.total} đối tượng (người tương tác 48h sẽ nhận)`)
      onSent()
    } catch (e) { toast.error(e.response?.data?.error || 'Lỗi gửi broadcast') }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Tạo broadcast</h2>
        <button onClick={onCompose} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
          <Plus className="h-4 w-4" /> Soạn bài viết mới
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Danh sách bài để chọn */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-4 border-b border-slate-200">
            {[['normal', 'Bài viết'], ['video', 'Video']].map(([v, l]) => (
              <button key={v} onClick={() => setType(v)}
                className={`pb-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${type === v ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{l}</button>
            ))}
            <div className="relative ml-auto mb-2 w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm bài viết"
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400 text-left">
                    <th className="px-4 py-3 w-10">#</th>
                    <th className="px-4 py-3 w-36">Thời gian tạo</th>
                    <th className="px-4 py-3 w-16">Hình</th>
                    <th className="px-4 py-3">Tên bài viết</th>
                    <th className="px-4 py-3 w-20">Trạng thái</th>
                    <th className="px-4 py-3 w-24 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">Không có {type === 'video' ? 'video' : 'bài viết'} nào</td></tr>
                  ) : paged.map((a, i) => {
                    const sel = isSel(a.id)
                    return (
                      <tr key={a.id} className={`hover:bg-slate-50/60 ${sel ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-4 py-3 text-slate-400">{(page - 1) * perPage + i + 1}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(a.createDate)}</td>
                        <td className="px-4 py-3">
                          {a.thumb ? <img src={a.thumb} alt="" className="h-9 w-12 rounded object-cover border border-slate-100" /> : <div className="h-9 w-12 rounded bg-slate-100" />}
                        </td>
                        <td className="px-4 py-3"><span className="font-medium text-slate-700 line-clamp-2">{a.title || '(Không tiêu đề)'}</span></td>
                        <td className="px-4 py-3"><span className={`text-xs font-semibold ${a.status === 'show' ? 'text-emerald-600' : 'text-slate-400'}`}>{a.status === 'show' ? 'Hiện' : 'Ẩn'}</span></td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleArt(a)}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${sel ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 text-blue-600 hover:bg-blue-50'}`}>
                            {sel ? 'Bỏ chọn' : 'Chọn'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} perPage={perPage} total={items.length} onPage={setPage} />
          </div>
        </div>

        {/* Panel "Giao diện" bên phải */}
        <div className="lg:w-80 shrink-0">
          <div className="sticky top-4 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Giao diện</p>
            {preview ? (
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                {preview.thumb && <img src={preview.thumb} alt="" className="w-full aspect-video object-cover" />}
                <p className="p-2 text-sm font-semibold text-slate-700 line-clamp-2">{preview.title}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Chọn bài viết để xem</div>
            )}
            <p className="text-xs text-slate-500">Đã chọn <b className="text-blue-600">{selected.length}/5</b> nội dung</p>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Chọn đối tượng gửi</p>
              <select value={aud} onChange={(e) => setAud(e.target.value)} className="w-full h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700">
                <option value="all">Tất cả follower ({followers.length})</option>
                <option value="groups">Nhóm Zalo</option>
                <option value="followers">Follower cụ thể</option>
              </select>
              {aud === 'all' && <p className="text-[11px] text-amber-600 mt-1.5">Chỉ người tương tác OA trong 48h thực nhận (luật Zalo).</p>}
              {aud === 'groups' && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5 border border-slate-100 rounded-lg p-1.5">
                  {groups.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-2">Chưa có nhóm</p> : groups.map((g) => (
                    <label key={g.group_id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input type="checkbox" checked={selGroups.has(g.group_id)} onChange={() => toggleSet(selGroups, setSelGroups, g.group_id)} className="rounded" />
                      <span className="truncate">{g.icon} {g.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {aud === 'followers' && (
                <div className="mt-2 border border-slate-100 rounded-lg p-1.5 space-y-1.5">
                  <input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Tìm follower..." className="w-full h-7 px-2 text-xs rounded border border-slate-200" />
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {filteredFollowers.map((f) => (
                      <label key={f.user_id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                        <input type="checkbox" checked={selFollowers.has(f.user_id)} onChange={() => toggleSet(selFollowers, setSelFollowers, f.user_id)} className="rounded" />
                        <span className="truncate">{f.display_name || f.user_id}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">Đã chọn {selFollowers.size}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Đặt tên broadcast (không bắt buộc)</p>
              <input value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="Tên để quản lý"
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
            </div>

            <button onClick={send} disabled={sending || !selected.length}
              className="w-full flex items-center justify-center gap-1.5 h-11 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Gửi broadcast
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Ảnh 2: "Soạn bài viết mới" — tạo bài đăng thật lên OA ── */
function ArticleComposer({ onBack, onPublished }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('UBND xã Hòa Tiến')
  const [description, setDescription] = useState('')
  const [cover, setCover] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [blocks, setBlocks] = useState([{ id: uid(), type: 'text', content: '' }])
  const [allowComment, setAllowComment] = useState(true)
  const [publishing, setPublishing] = useState('') // '' | 'show' | 'hide'
  const [preview, setPreview] = useState(false)

  const setBlock = (id, patch) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const removeBlock = (id) => setBlocks((bs) => bs.filter((b) => b.id !== id))
  const moveBlock = (id, dir) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= bs.length) return bs
    const n = [...bs];[n[i], n[j]] = [n[j], n[i]]; return n
  })
  const addText = () => setBlocks((bs) => [...bs, { id: uid(), type: 'text', content: '' }])
  const addImage = () => setBlocks((bs) => [...bs, { id: uid(), type: 'image', url: '', caption: '', uploading: false }])

  const onCover = async (file) => {
    if (!file) return
    setCoverUploading(true)
    try { setCover(await uploadArticleImage(file)) }
    catch (e) { toast.error(e.response?.data?.error || 'Lỗi tải ảnh đại diện') }
    finally { setCoverUploading(false) }
  }
  const onBlockImage = async (id, file) => {
    if (!file) return
    setBlock(id, { uploading: true })
    try { setBlock(id, { url: await uploadArticleImage(file), uploading: false }) }
    catch (e) { toast.error(e.response?.data?.error || 'Lỗi tải ảnh'); setBlock(id, { uploading: false }) }
  }

  const cleanBlocks = () => blocks
    .map((b) => (b.type === 'image' ? (b.url ? { type: 'image', url: b.url, caption: b.caption } : null) : (b.content.trim() ? { type: 'text', content: b.content } : null)))
    .filter(Boolean)

  const publish = async (st) => {
    if (!title.trim()) return toast.error('Nhập tiêu đề')
    if (!description.trim()) return toast.error('Nhập trích dẫn')
    if (!cover) return toast.error('Cần ảnh đại diện')
    const clean = cleanBlocks()
    if (!clean.length) return toast.error('Cần nội dung (đoạn văn hoặc ảnh)')
    setPublishing(st)
    try {
      await api.post('/api/broadcast/articles', {
        title, author, description, coverUrl: cover, blocks: clean,
        status: st, comment: allowComment ? 'show' : 'hide',
      })
      toast.success(st === 'show' ? 'Đã xuất bản lên OA Zalo' : 'Đã lưu nháp (ẩn) trên OA')
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['zalo-articles'] }), 1500)
      onPublished()
    } catch (e) { toast.error(e.response?.data?.error || 'Lỗi đăng bài') }
    finally { setPublishing('') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        <h2 className="text-xl font-bold text-slate-800">Soạn bài viết mới</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Cột trái: nội dung bài */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <Field label="Tiêu đề *">
            <input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề bài viết"
              className="w-full h-10 px-3 text-sm font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
          </Field>

          <Field label="Trích dẫn *">
            <textarea rows={2} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập trích dẫn (tóm tắt, hiện ở danh sách)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
          </Field>

          <Field label="Tác giả">
            <input value={author} maxLength={50} onChange={(e) => setAuthor(e.target.value)} placeholder="Nhập tên tác giả"
              className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
          </Field>

          <Field label="Nội dung *">
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <div key={b.id} className="group relative border border-slate-150 rounded-lg p-2.5 bg-slate-50/40">
                  <div className="absolute -top-2.5 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0} className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => moveBlock(b.id, 1)} disabled={i === blocks.length - 1} className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    <button onClick={() => removeBlock(b.id)} className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  {b.type === 'text' ? (
                    <textarea rows={3} value={b.content} onChange={(e) => setBlock(b.id, { content: e.target.value })} placeholder="Nhập đoạn văn bản..."
                      className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400/40" />
                  ) : b.url ? (
                    <div className="space-y-1.5">
                      <img src={b.url} alt="" className="max-h-48 rounded object-contain border border-slate-100 bg-white" />
                      <input value={b.caption} onChange={(e) => setBlock(b.id, { caption: e.target.value })} placeholder="Chú thích ảnh (tùy chọn)"
                        className="w-full h-8 px-2 text-xs rounded border border-slate-200" />
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 h-20 rounded border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 text-sm">
                      {b.uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImageIcon className="h-5 w-5" /> Tải ảnh</>}
                      <input type="file" accept="image/*" className="hidden" disabled={b.uploading} onChange={(e) => onBlockImage(b.id, e.target.files?.[0])} />
                    </label>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={addText} className="flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"><Type className="h-3.5 w-3.5" /> Thêm đoạn văn</button>
                <button onClick={addImage} className="flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"><ImageIcon className="h-3.5 w-3.5" /> Thêm ảnh</button>
              </div>
            </div>
          </Field>
        </div>

        {/* Cột phải: ảnh đại diện + tùy chọn */}
        <div className="lg:w-72 shrink-0 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500">Ảnh đại diện <span className="text-red-500">*</span></p>
            {cover ? (
              <div className="relative">
                <img src={cover} alt="" className="w-full aspect-video rounded-lg object-cover border border-slate-100" />
                <button onClick={() => setCover('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 w-full aspect-video rounded-lg border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500">
                {coverUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><ImageIcon className="h-7 w-7" /><span className="text-xs">Tải ảnh</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={(e) => onCover(e.target.files?.[0])} />
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <input type="checkbox" checked={allowComment} onChange={(e) => setAllowComment(e.target.checked)} className="rounded" /> Cho phép bình luận
            </label>
          </div>
        </div>
      </div>

      {/* Thanh nút dưới */}
      <div className="flex items-center justify-end gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <button onClick={onBack} className="h-10 px-4 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">Hủy</button>
        <button onClick={() => setPreview(true)} className="h-10 px-4 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Eye className="h-4 w-4" /> Xem trước</button>
        <button onClick={() => publish('hide')} disabled={!!publishing} className="h-10 px-4 rounded-lg text-sm font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
          {publishing === 'hide' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Lưu nháp
        </button>
        <button onClick={() => publish('show')} disabled={!!publishing} className="h-10 px-5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
          {publishing === 'show' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Xuất bản
        </button>
      </div>

      {/* Modal xem trước */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
              <p className="text-sm font-bold text-slate-700">Xem trước bài viết</p>
              <button onClick={() => setPreview(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            {cover && <img src={cover} alt="" className="w-full aspect-video object-cover" />}
            <div className="p-5 space-y-3">
              <h1 className="text-xl font-bold text-slate-800 leading-snug">{title || 'Tiêu đề bài viết'}</h1>
              {author && <p className="text-xs text-slate-400">{author}</p>}
              {description && <p className="text-sm text-slate-500 italic border-l-2 border-slate-200 pl-3">{description}</p>}
              <div className="space-y-3 pt-1">
                {blocks.map((b) => b.type === 'text'
                  ? (b.content.trim() && <p key={b.id} className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{b.content}</p>)
                  : (b.url && <figure key={b.id}><img src={b.url} alt="" className="w-full rounded-lg" />{b.caption && <figcaption className="text-xs text-slate-400 text-center mt-1">{b.caption}</figcaption>}</figure>)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Pager({ page, perPage, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 text-xs text-slate-500">
      <span>{total} mục · {perPage}/trang</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button className="h-7 w-7 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
          <span className="px-2 font-medium text-slate-600">{page}/{totalPages}</span>
          <button className="h-7 w-7 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</button>
        </div>
      )}
    </div>
  )
}

export default function NoiDung() {
  const [tab, setTab] = useState('manage')
  const nav = [
    { id: 'manage', label: 'Quản lý broadcast', icon: Megaphone },
    { id: 'create', label: 'Tạo broadcast', icon: Plus },
  ]
  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <h1 className="text-[1.7rem] font-extrabold text-foreground tracking-tight flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-blue-600" /> Nội dung
      </h1>
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0 flex md:flex-col gap-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-left transition-colors ${tab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          {tab === 'manage' ? <ManageTab onCreate={() => setTab('create')} /> : <CreateTab onDone={() => setTab('manage')} />}
        </div>
      </div>
    </div>
  )
}
