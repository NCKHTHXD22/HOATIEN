import { useState, useEffect, useCallback } from 'react'
import { MessageSquareWarning, Clock, CheckCircle, FileEdit, RefreshCw, X, Send, Search } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STATUS = {
  pending:    { label: 'Chưa xử lý', cls: 'bg-red-100 text-red-700' },
  processing: { label: 'Đang xử lý', cls: 'bg-amber-100 text-amber-700' },
  draft:      { label: 'Dự thảo chờ duyệt', cls: 'bg-blue-100 text-blue-700' },
  resolved:   { label: 'Đã xử lý', cls: 'bg-green-100 text-green-700' },
  done:       { label: 'Đã xử lý', cls: 'bg-green-100 text-green-700' },
}
const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chưa xử lý' },
  { key: 'processing', label: 'Đang xử lý' },
  { key: 'draft', label: 'Dự thảo' },
  { key: 'resolved', label: 'Đã xử lý' },
]
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

// ── Modal chi tiết + xử lý ──
function DetailModal({ id, open, onClose, onChanged, isLeader }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [draft, setDraft] = useState('')
  const [finalResp, setFinalResp] = useState('')
  const [reject, setReject] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    api.get(`/api/feedbacks/${id}`).then(r => {
      setData(r.data)
      setDraft(r.data.feedback?.draftResponse || '')
      setFinalResp(r.data.feedback?.draftResponse || '')
      setAssignTo(r.data.feedback?.assignedTo?._id || '')
    }).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { if (open) load() }, [open, load])

  const act = async (fn, msg) => {
    setBusy(true)
    try { await fn(); onChanged() } catch (e) { alert(e.response?.data?.error || 'Lỗi') } finally { setBusy(false) }
  }

  if (!open) return null
  const fb = data?.feedback
  const admins = data?.admins || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Chi tiết phản ánh {fb ? `#${fb._id.slice(-5).toUpperCase()}` : ''}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading || !fb ? (
            <div className="py-8 text-center text-gray-400"><RefreshCw size={20} className="animate-spin inline" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS[fb.status]?.cls}`}>{STATUS[fb.status]?.label}</span>
                {fb.categoryId?.name && <span className="text-xs text-gray-500">· {fb.categoryId.name}</span>}
              </div>
              <div className="text-sm space-y-1">
                <p><b>Người gửi:</b> {fb.displayName || '(Chưa có tên)'} · {fb.contact}</p>
                <p><b>Ngày gửi:</b> {fmt(fb.createdAt)}{fb.deadline && ` · Hạn: ${fmt(fb.deadline)}`}</p>
                <p><b>Nội dung:</b></p>
                <p className="bg-gray-50 rounded p-3 whitespace-pre-wrap">{fb.content}</p>
              </div>
              {fb.imageUrls?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fb.imageUrls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-20 w-20 object-cover rounded-lg border" /></a>
                  ))}
                </div>
              )}
              {fb.assignedTo && <p className="text-xs text-gray-500">Phân công: <b>{fb.assignedTo.fullName}</b>{fb.assignNote && ` — ${fb.assignNote}`}</p>}
              {fb.rejectedReason && <p className="text-xs text-red-600">Bị từ chối: {fb.rejectedReason}</p>}
              {fb.finalResponse && <div className="text-sm bg-green-50 rounded p-3"><b>Đã phản hồi:</b> {fb.finalResponse}</div>}

              {/* ── Hành động ── */}
              {fb.status !== 'resolved' && fb.status !== 'done' && (
                <div className="border-t pt-4 space-y-4">
                  {isLeader && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">Phân công cán bộ</p>
                      <div className="flex gap-2">
                        <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                          <option value="">— Chọn cán bộ —</option>
                          {admins.map(a => <option key={a._id} value={a._id}>{a.fullName} ({a.role})</option>)}
                        </select>
                        <button disabled={busy || !assignTo} onClick={() => act(() => api.post(`/api/feedbacks/${id}/assign`, { assignedTo: assignTo, note: assignNote }))}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">Giao</button>
                      </div>
                      <input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="Ghi chú phân công (tuỳ chọn)" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}

                  {/* Cán bộ (hoặc lãnh đạo) soạn dự thảo */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Soạn dự thảo phản hồi</p>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Nội dung dự thảo gửi lãnh đạo duyệt..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                    <button disabled={busy || !draft.trim()} onClick={() => act(() => api.post(`/api/feedbacks/${id}/draft`, { draftResponse: draft }))}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg disabled:opacity-50"><FileEdit size={14} /> Lưu dự thảo</button>
                  </div>

                  {/* Lãnh đạo duyệt dự thảo */}
                  {isLeader && fb.status === 'draft' && (
                    <div className="space-y-2 bg-blue-50/50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-blue-700">Duyệt & gửi dân (có thể sửa nội dung)</p>
                      <textarea value={finalResp} onChange={e => setFinalResp(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <button disabled={busy || !finalResp.trim()} onClick={() => act(() => api.post(`/api/feedbacks/${id}/approve`, { finalResponse: finalResp }))}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-50"><Send size={14} /> Duyệt & gửi</button>
                        <input value={reject} onChange={e => setReject(e.target.value)} placeholder="Lý do từ chối" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                        <button disabled={busy} onClick={() => act(() => api.post(`/api/feedbacks/${id}/reject`, { rejectedReason: reject }))}
                          className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">Từ chối</button>
                      </div>
                    </div>
                  )}

                  {/* Lãnh đạo phản hồi nhanh */}
                  {isLeader && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500">Phản hồi nhanh (gửi dân ngay, bỏ qua quy trình)</summary>
                      <div className="flex gap-2 mt-2">
                        <input value={finalResp} onChange={e => setFinalResp(e.target.value)} placeholder="Nội dung phản hồi" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                        <button disabled={busy || !finalResp.trim()} onClick={() => act(() => api.post(`/api/feedbacks/${id}/reply`, { response: finalResp }))}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-50">Gửi</button>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-3 border-t text-right">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Đóng</button>
        </div>
      </div>
    </div>
  )
}

export default function PhanAnh() {
  const { user } = useAuth()
  const isLeader = user?.role === 'SUPER_ADMIN'
  const [stats, setStats] = useState({ pending: 0, processing: 0, draft: 0, resolved: 0 })
  const [list, setList] = useState([])
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/feedbacks', { params: { status: tab || undefined, q: search || undefined } }),
      api.get('/api/feedbacks/stats'),
    ]).then(([l, s]) => { setList(l.data.feedbacks || []); setStats(s.data) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [tab, search])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phản ánh kiến nghị</h1>
        <p className="text-sm text-gray-500 mt-1">Tiếp nhận và xử lý ý kiến, phản ánh của công dân qua Zalo</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Chưa xử lý', val: stats.pending, icon: MessageSquareWarning, color: '#dc2626' },
          { label: 'Đang xử lý', val: stats.processing, icon: Clock, color: '#d97706' },
          { label: 'Dự thảo chờ duyệt', val: stats.draft, icon: FileEdit, color: '#2563eb' },
          { label: 'Đã xử lý', val: stats.resolved, icon: CheckCircle, color: '#16a34a' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-4 flex items-center justify-between">
            <div><p className="text-xs text-gray-500">{c.label}</p><p className="text-2xl font-bold" style={{ color: c.color }}>{c.val}</p></div>
            <c.icon size={28} style={{ color: c.color }} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{t.label}</button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, nội dung, mã..." className="border rounded-lg pl-8 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b text-left text-gray-600">
            <th className="px-4 py-2.5 font-medium">Mã</th>
            <th className="px-4 py-2.5 font-medium">Công dân</th>
            <th className="px-4 py-2.5 font-medium">Nội dung</th>
            <th className="px-4 py-2.5 font-medium hidden md:table-cell">Lĩnh vực</th>
            <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            <th className="px-4 py-2.5 font-medium hidden md:table-cell">Phân công</th>
          </tr></thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={6} className="text-center py-10 text-gray-400"><RefreshCw size={18} className="animate-spin inline mr-2" />Đang tải...</td></tr>
              : list.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có phản ánh nào</td></tr>
              : list.map(f => (
                <tr key={f._id} onClick={() => setDetail(f._id)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-mono text-xs">#{f._id.slice(-5).toUpperCase()}</td>
                  <td className="px-4 py-2.5">{f.displayName || '(Chưa tên)'}<div className="text-xs text-gray-400">{f.contact}</div></td>
                  <td className="px-4 py-2.5 max-w-xs truncate">{f.content}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-gray-500 text-xs">{f.categoryId?.name || '—'}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS[f.status]?.cls}`}>{STATUS[f.status]?.label}</span></td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500">{f.assignedTo?.fullName || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <DetailModal id={detail} open={!!detail} onClose={() => setDetail(null)} onChanged={() => { load(); }} isLeader={isLeader} />
    </div>
  )
}
