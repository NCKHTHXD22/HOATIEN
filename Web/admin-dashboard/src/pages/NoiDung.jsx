import { useState, useMemo, useRef } from 'react'
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
              ) : items.map((a, i) => {
                const st = ZALO_ST[a.status] || { label: a.status, cls: 'bg-slate-100 text-slate-500' }
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
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
        <div className="px-4 py-2.5 border-t border-slate-50 text-[11px] text-slate-400">Dữ liệu thật lấy trực tiếp từ Zalo OA Manager · {items.length} broadcast</div>
      </div>
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
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('UBND xã Hòa Tiến')
  const [description, setDescription] = useState('')
  const [cover, setCover] = useState('') // url
  const [coverUploading, setCoverUploading] = useState(false)
  const [blocks, setBlocks] = useState([{ id: uid(), type: 'text', content: '' }])
  const [status, setStatus] = useState('show')
  const [allowComment, setAllowComment] = useState(true)
  const [publishing, setPublishing] = useState(false)

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
    catch (e) { toast.error(e.response?.data?.error || 'Lỗi tải ảnh bìa') }
    finally { setCoverUploading(false) }
  }
  const onBlockImage = async (id, file) => {
    if (!file) return
    setBlock(id, { uploading: true })
    try { setBlock(id, { url: await uploadArticleImage(file), uploading: false }) }
    catch (e) { toast.error(e.response?.data?.error || 'Lỗi tải ảnh'); setBlock(id, { uploading: false }) }
  }

  const publish = async () => {
    if (!title.trim()) return toast.error('Nhập tiêu đề')
    if (!cover) return toast.error('Cần ảnh bìa')
    const clean = blocks
      .map((b) => (b.type === 'image' ? (b.url ? { type: 'image', url: b.url, caption: b.caption } : null) : (b.content.trim() ? { type: 'text', content: b.content } : null)))
      .filter(Boolean)
    if (!clean.length) return toast.error('Cần ít nhất một đoạn văn hoặc ảnh')

    setPublishing(true)
    try {
      await api.post('/api/broadcast/articles', {
        title, author, description, coverUrl: cover, blocks: clean,
        status, comment: allowComment ? 'show' : 'hide',
      })
      toast.success(status === 'show' ? 'Đã đăng bài lên OA Zalo' : 'Đã lưu bài (ẩn) trên OA')
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['zalo-articles'] }), 1500)
      onDone()
    } catch (e) { toast.error(e.response?.data?.error || 'Lỗi đăng bài') }
    finally { setPublishing(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold text-slate-800">Tạo broadcast</h2>
        <span className="text-xs text-slate-400">— đăng bài viết lên Zalo OA</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Form soạn */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <Field label="Tiêu đề *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thông báo lịch tiếp công dân tháng 8"
              className="w-full h-10 px-3 text-sm font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
          </Field>

          <Field label="Ảnh bìa *">
            {cover ? (
              <div className="relative w-full max-w-sm">
                <img src={cover} alt="" className="w-full aspect-video rounded-lg object-cover border border-slate-100" />
                <button onClick={() => setCover('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 w-full max-w-sm aspect-video rounded-lg border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500">
                {coverUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><ImageIcon className="h-7 w-7" /><span className="text-xs">Tải ảnh bìa</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={(e) => onCover(e.target.files?.[0])} />
              </label>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tác giả"><input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30" /></Field>
            <Field label="Trạng thái">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700">
                <option value="show">Hiện ngay trên OA</option>
                <option value="hide">Lưu ẩn (nháp)</option>
              </select>
            </Field>
          </div>

          <Field label="Mô tả ngắn (hiện ở danh sách)">
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tóm tắt nội dung bài..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
          </Field>

          {/* Nội dung: khối văn bản + ảnh */}
          <Field label="Nội dung bài viết">
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

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allowComment} onChange={(e) => setAllowComment(e.target.checked)} className="rounded" /> Cho phép bình luận
          </label>

          <div className="flex justify-end pt-1 border-t border-slate-100">
            <button onClick={publish} disabled={publishing}
              className="mt-3 flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {status === 'show' ? 'Đăng lên OA' : 'Lưu nháp'}
            </button>
          </div>
        </div>

        {/* Xem trước */}
        <div className="lg:w-80 shrink-0">
          <div className="sticky top-4">
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Xem trước</p>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {cover ? <img src={cover} alt="" className="w-full aspect-video object-cover" /> : <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-slate-300"><ImageIcon className="h-8 w-8" /></div>}
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-slate-800 leading-snug">{title || 'Tiêu đề bài viết'}</h3>
                {author && <p className="text-[11px] text-slate-400">{author}</p>}
                {description && <p className="text-xs text-slate-500 italic">{description}</p>}
                <div className="space-y-2 pt-1">
                  {blocks.map((b) => b.type === 'text'
                    ? (b.content.trim() && <p key={b.id} className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{b.content}</p>)
                    : (b.url && <figure key={b.id}><img src={b.url} alt="" className="w-full rounded" />{b.caption && <figcaption className="text-[11px] text-slate-400 text-center mt-1">{b.caption}</figcaption>}</figure>)
                  )}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Bài sẽ xuất hiện trong <b>Quản lý broadcast → Trên Zalo OA</b> sau vài giây.</p>
          </div>
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
