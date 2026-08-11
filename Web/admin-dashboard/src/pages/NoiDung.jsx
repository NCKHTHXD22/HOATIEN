import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Megaphone, Plus, Search, Loader2, Trash2, Image as ImageIcon, X, Download,
  Send, Eye,
} from 'lucide-react'

const STATUS = {
  success: { label: 'Thành công', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Không gửi được', cls: 'bg-red-100 text-red-600' },
  sending: { label: 'Đang gửi', cls: 'bg-amber-100 text-amber-700' },
}
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

/* ══ Quản lý broadcast ══ */
function ManageTab({ onCreate }) {
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

  const onSearch = (v) => {
    setQ(v); clearTimeout(debounce.current)
    debounce.current = setTimeout(() => setPage(1), 300)
  }

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Quản lý broadcast</h2>
        <button onClick={onCreate} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Tạo broadcast
        </button>
      </div>

      {/* Toolbar */}
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

      {/* Table */}
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
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">Chưa có broadcast nào</td></tr>
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
    </div>
  )
}

/* ══ Tạo broadcast ══ */
function CreateTab({ onDone }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [image, setImage] = useState(null) // { imageAttachmentId, thumbnail }
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState('all') // all | groups | followers
  const [selGroups, setSelGroups] = useState(new Set())
  const [selFollowers, setSelFollowers] = useState(new Set())
  const [fSearch, setFSearch] = useState('')
  const [sending, setSending] = useState(false)

  const { data: fData } = useQuery({ queryKey: ['bc-followers'], queryFn: () => api.get('/api/broadcast/followers').then((r) => r.data) })
  const { data: gData } = useQuery({ queryKey: ['bc-groups'], queryFn: () => api.get('/api/broadcast/groups').then((r) => r.data) })
  const followers = fData?.followers ?? []
  const groups = gData?.groups ?? []

  const filteredFollowers = useMemo(() => {
    const s = fSearch.toLowerCase()
    return followers.filter((f) => !s || f.display_name?.toLowerCase().includes(s) || f.user_id?.includes(s)).slice(0, 100)
  }, [followers, fSearch])

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('image', file)
      const r = await api.post('/api/broadcast/posts/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
      setImage(r.data)
    } catch (e) { toast.error(e.response?.data?.error || 'Lỗi tải ảnh') }
    finally { setUploading(false) }
  }

  const pollStatus = (jobId) => new Promise((resolve) => {
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/broadcast/posts/status/${jobId}`)
        if (data.done) { clearInterval(iv); resolve(data) }
      } catch { clearInterval(iv); resolve(null) }
    }, 1500)
    setTimeout(() => { clearInterval(iv); resolve(null) }, 10 * 60 * 1000)
  })

  const submit = async () => {
    if (!name.trim()) return toast.error('Nhập tên broadcast')
    if (!content.trim() && !image && !linkUrl.trim()) return toast.error('Cần nội dung, ảnh hoặc link')
    let userIds = [], groupIds = []
    if (mode === 'all') userIds = followers.map((f) => f.user_id)
    else if (mode === 'groups') groupIds = [...selGroups]
    else userIds = [...selFollowers]
    if (!userIds.length && !groupIds.length) return toast.error('Chọn đối tượng nhận')

    setSending(true)
    try {
      const { data } = await api.post('/api/broadcast/posts', {
        name, content, thumbnail: image?.thumbnail, imageAttachmentId: image?.imageAttachmentId,
        linkUrl, linkTitle, userIds, groupIds,
      })
      toast.info(`Đang gửi tới ${data.total} đối tượng...`)
      const res = await pollStatus(data.jobId)
      if (res) toast.success(`Xong: gửi ${res.sent}${res.failed ? `, ${res.failed} lỗi (48h)` : ''}`)
      queryClient.invalidateQueries({ queryKey: ['broadcast-posts'] })
      onDone()
    } catch (e) { toast.error(e.response?.data?.error || 'Lỗi gửi broadcast') }
    finally { setSending(false) }
  }

  const toggle = (set, setSet, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setSet(n) }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800">Tạo broadcast</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <Field label="Tên broadcast">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Thông báo lịch tiếp công dân tháng 8"
            className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
        </Field>

        <Field label="Nội dung">
          <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung gửi tới người dân..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
        </Field>

        <Field label="Ảnh (tùy chọn)">
          {image ? (
            <div className="flex items-center gap-3">
              <img src={image.thumbnail} alt="" className="h-16 w-24 rounded object-cover border border-slate-100" />
              <button onClick={() => setImage(null)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="h-3 w-3" /> Bỏ ảnh</button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-500">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Tải ảnh
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Link kèm (tùy chọn)"><input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30" /></Field>
          <Field label="Tiêu đề link"><input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="VD: Xem chi tiết" className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30" /></Field>
        </div>

        {/* Đối tượng nhận */}
        <Field label="Đối tượng nhận">
          <div className="flex gap-2 mb-2">
            {[['all', `Tất cả follower (${followers.length})`], ['groups', 'Theo nhóm Zalo'], ['followers', 'Chọn follower']].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${mode === v ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{l}</button>
            ))}
          </div>

          {mode === 'all' && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Chỉ người đã tương tác OA trong 48h mới nhận được (luật Zalo). Còn lại sẽ vào phần "lỗi".</p>}

          {mode === 'groups' && (
            <div className="max-h-52 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
              {groups.length === 0 ? <p className="text-xs text-slate-400 text-center py-3">Chưa có nhóm Zalo nào</p> : groups.map((g) => (
                <label key={g.group_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selGroups.has(g.group_id)} onChange={() => toggle(selGroups, setSelGroups, g.group_id)} className="rounded" />
                  <span>{g.icon} {g.name}</span>
                  <span className="text-[11px] text-slate-400 ml-auto">{g.memberCount || 0} tv</span>
                </label>
              ))}
            </div>
          )}

          {mode === 'followers' && (
            <div className="border border-slate-100 rounded-lg p-2 space-y-2">
              <input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Tìm follower..." className="w-full h-8 px-2 text-xs rounded border border-slate-200" />
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {filteredFollowers.map((f) => (
                  <label key={f.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selFollowers.has(f.user_id)} onChange={() => toggle(selFollowers, setSelFollowers, f.user_id)} className="rounded" />
                    <span className="truncate">{f.display_name || f.user_id}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Đã chọn {selFollowers.size}</p>
            </div>
          )}
        </Field>

        <div className="flex justify-end pt-1">
          <button onClick={submit} disabled={sending}
            className="flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Gửi broadcast
          </button>
        </div>
      </div>
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
