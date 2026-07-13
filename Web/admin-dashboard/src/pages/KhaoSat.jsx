import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardList, Plus, Trash2, RefreshCw, X, Lock, Pencil,
  PlusCircle, MinusCircle, BarChart3, Send, Copy, Search,
} from 'lucide-react'
import { getSurveys, createSurvey, getSurvey, updateSurvey, deleteSurvey, closeSurvey, getSurveyResults } from '../services/notificationService'
import { api } from '../lib/api'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN')
}

function getSurveyStatus(s) {
  if (!s.isActive) return { label: 'Đã đóng', color: 'bg-gray-100 text-gray-500' }
  if (s.deadline && new Date(s.deadline) < new Date()) return { label: 'Đã hết hạn', color: 'bg-red-100 text-red-600' }
  return { label: 'Đang mở', color: 'bg-green-100 text-green-700' }
}

const QTYPE_LABEL = { SINGLE: 'Một lựa chọn', MULTIPLE: 'Nhiều lựa chọn', TEXT: 'Văn bản tự do' }

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Modal tạo / sửa khảo sát ────────────────────────────────
function SurveyFormModal({ open, onClose, onDone, survey }) {
  const isEdit = !!survey
  const [tieuDe, setTieuDe] = useState('')
  const [deadline, setDeadline] = useState('')
  const [questions, setQuestions] = useState([
    { cauHoi: '', loai: 'SINGLE', luaChon: ['', ''] },
  ])
  const [loading, setLoading] = useState(false)
  const [loadingSurvey, setLoadingSurvey] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit) {
      setLoadingSurvey(true)
      getSurvey(survey.id).then(r => {
        const s = r.data
        setTieuDe(s.tieuDe || '')
        setDeadline(toDatetimeLocal(s.deadline))
        setQuestions(
          (s.questions || []).map(q => ({
            cauHoi: q.cauHoi,
            loai: q.loai || 'SINGLE',
            luaChon: q.luaChon?.length ? q.luaChon : ['', ''],
          }))
        )
      }).finally(() => setLoadingSurvey(false))
    } else {
      setTieuDe(''); setDeadline('')
      setQuestions([{ cauHoi: '', loai: 'SINGLE', luaChon: ['', ''] }])
    }
  }, [open, isEdit, survey])

  const addQuestion = () =>
    setQuestions(q => [...q, { cauHoi: '', loai: 'SINGLE', luaChon: ['', ''] }])

  const removeQuestion = (i) =>
    setQuestions(q => q.filter((_, idx) => idx !== i))

  const updateQuestion = (i, field, value) =>
    setQuestions(q => q.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const addChoice = (i) =>
    setQuestions(q => q.map((item, idx) => idx === i ? { ...item, luaChon: [...item.luaChon, ''] } : item))

  const removeChoice = (i, ci) =>
    setQuestions(q => q.map((item, idx) =>
      idx === i ? { ...item, luaChon: item.luaChon.filter((_, cidx) => cidx !== ci) } : item
    ))

  const updateChoice = (i, ci, value) =>
    setQuestions(q => q.map((item, idx) =>
      idx === i ? { ...item, luaChon: item.luaChon.map((c, cidx) => cidx === ci ? value : c) } : item
    ))

  const handleSave = async () => {
    if (!tieuDe.trim()) return alert('Nhập tiêu đề khảo sát')
    if (questions.some(q => !q.cauHoi.trim())) return alert('Nhập nội dung cho tất cả câu hỏi')
    setLoading(true)
    try {
      const payload = {
        tieuDe,
        deadline: deadline || null,
        questions: questions.map(q => ({
          ...q,
          luaChon: q.loai !== 'TEXT' ? q.luaChon.filter(c => c.trim()) : [],
        })),
      }
      if (isEdit) await updateSurvey(survey.id, payload)
      else await createSurvey(payload)
      onDone(); onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally { setLoading(false) }
  }

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? 'Sửa khảo sát' : 'Tạo khảo sát nhanh'}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        {loadingSurvey ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề khảo sát <span className="text-red-500">*</span></label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={tieuDe}
              onChange={e => setTieuDe(e.target.value)}
              placeholder="Vd: Khảo sát ý kiến về dự án đường thôn"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hạn chót (tùy chọn)</label>
            <input
              type="datetime-local"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Câu hỏi <span className="text-red-500">*</span></label>
              <button onClick={addQuestion}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                <PlusCircle size={14} /> Thêm câu hỏi
              </button>
            </div>

            {questions.map((q, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-gray-500 mt-2">#{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Nội dung câu hỏi..."
                      value={q.cauHoi}
                      onChange={e => updateQuestion(i, 'cauHoi', e.target.value)}
                    />
                    <select
                      className="border rounded px-2 py-1.5 text-sm bg-white"
                      value={q.loai}
                      onChange={e => updateQuestion(i, 'loai', e.target.value)}
                    >
                      {Object.entries(QTYPE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    {q.loai !== 'TEXT' && (
                      <div className="space-y-1.5">
                        {q.luaChon.map((c, ci) => (
                          <div key={ci} className="flex gap-2">
                            <input
                              className="flex-1 border rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder={`Lựa chọn ${ci + 1}`}
                              value={c}
                              onChange={e => updateChoice(i, ci, e.target.value)}
                            />
                            {q.luaChon.length > 2 && (
                              <button onClick={() => removeChoice(i, ci)}
                                className="text-red-400 hover:text-red-600"><MinusCircle size={16} /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addChoice(i)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <PlusCircle size={12} /> Thêm lựa chọn
                        </button>
                      </div>
                    )}
                  </div>
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-600 mt-1">
                      <MinusCircle size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
          <button onClick={handleSave} disabled={loading || loadingSurvey}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading && <RefreshCw size={13} className="animate-spin" />} {isEdit ? 'Lưu thay đổi' : 'Tạo khảo sát'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Modal xem kết quả ──────────────────────────────────────
function ResultsModal({ surveyId, open, onClose }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !surveyId) return
    setLoading(true)
    getSurveyResults(surveyId).then(r => setResults(r.data)).finally(() => setLoading(false))
  }, [open, surveyId])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Kết quả khảo sát</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading
            ? <div className="py-8 text-center text-gray-400"><RefreshCw size={20} className="animate-spin inline" /></div>
            : !results
              ? <p className="text-center text-gray-400 py-8">Không có dữ liệu</p>
              : (
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800">{results.survey?.tieuDe}</p>
                    <p className="text-xs text-blue-600 mt-1">Tổng phản hồi: {results.totalResponses} người</p>
                  </div>
                  {results.summary?.map((q, i) => (
                    <div key={q.questionId} className="space-y-2">
                      <p className="text-sm font-medium text-gray-800">
                        #{i + 1}. {q.cauHoi}
                      </p>
                      {q.loai === 'TEXT'
                        ? <p className="text-xs text-gray-400 italic">Câu hỏi văn bản tự do</p>
                        : (
                          <div className="space-y-1.5">
                            {Object.entries(q.counts).map(([answer, count]) => {
                              const pct = q.total > 0 ? Math.round(count / q.total * 100) : 0
                              return (
                                <div key={answer}>
                                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                                    <span>{answer}</span>
                                    <span>{count} ({pct}%)</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )
                            })}
                            {Object.keys(q.counts).length === 0 && (
                              <p className="text-xs text-gray-400 italic">Chưa có câu trả lời</p>
                            )}
                          </div>
                        )
                      }
                    </div>
                  ))}
                </div>
              )
          }
        </div>
        <div className="px-6 py-3 border-t">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Đóng</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Modal gửi link khảo sát qua Zalo ───────────────────────
function SendZaloModal({ survey, open, onClose }) {
  const [followers, setFollowers] = useState([])
  const [groups, setGroups] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const link = survey ? `${window.location.origin}/ks/${survey.id}` : ''

  useEffect(() => {
    if (!open) return
    setSelected([]); setSelectedGroups([]); setResult(''); setSearch('')
    api.get('/api/broadcast/followers').then(r => setFollowers(r.data?.followers || [])).catch(() => {})
    api.get('/api/broadcast/groups').then(r => setGroups(r.data?.groups || [])).catch(() => {})
  }, [open])

  if (!open) return null
  const filtered = followers.filter(f => {
    const q = search.toLowerCase()
    return !q ||
      (f.display_name || '').toLowerCase().includes(q) ||
      (f.user_id || '').includes(q) ||
      (f.linkedMember?.hoTen || '').toLowerCase().includes(q) ||
      (f.linkedMember?.sdt || '').includes(q)
  })
  const toggle = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleGroup = id => setSelectedGroups(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const selectAllFiltered = () => setSelected(p => Array.from(new Set([...p, ...filtered.map(f => f.user_id)])))

  const send = async () => {
    if (selected.length === 0 && selectedGroups.length === 0) return alert('Chọn ít nhất 1 người nhận hoặc nhóm')
    setSending(true)
    try {
      const message = `📋 Khảo sát: ${survey.tieuDe}\n\nMời bạn tham gia trả lời: ${link}`
      const userIds = [...selected, ...selectedGroups.map(id => `g:${id}`)]
      await api.post('/api/broadcast/send', { userIds, message })
      setResult(`Đã gửi link khảo sát tới ${selected.length} người và ${selectedGroups.length} nhóm (đang xử lý nền).`)
    } catch (e) { alert(e.response?.data?.error || 'Lỗi gửi') }
    finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Gửi khảo sát qua Zalo</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-3 border-b">
          <p className="text-sm font-medium text-gray-700 truncate">{survey?.tieuDe}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-100 rounded px-2 py-1 truncate">{link}</code>
            <button onClick={() => { navigator.clipboard.writeText(link); setResult('Đã sao chép link') }}
              className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50"><Copy size={12} /> Chép</button>
          </div>
        </div>
        {groups.length > 0 && (
          <div className="px-6 py-3 border-b">
            <p className="text-xs font-medium text-gray-500 mb-2">Gửi theo nhóm Zalo</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <label key={g.group_id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${selectedGroups.includes(g.group_id) ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  <input type="checkbox" className="hidden" checked={selectedGroups.includes(g.group_id)} onChange={() => toggleGroup(g.group_id)} />
                  <span>{g.icon} {g.name}</span>
                  <span className="opacity-70">({g.memberCount})</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="px-6 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
              <input className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Tìm theo tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={selectAllFiltered} disabled={filtered.length === 0}
              className="shrink-0 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">
              Chọn tất cả
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {filtered.length === 0
            ? <p className="text-center text-sm text-gray-400 py-6">Chưa có follower (đồng bộ ở tab Gửi tin Zalo)</p>
            : filtered.map(f => (
              <label key={f.user_id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(f.user_id)} onChange={() => toggle(f.user_id)} className="rounded" />
                <span className="text-sm flex-1 truncate min-w-0">
                  {f.display_name || f.linkedMember?.hoTen || '(Chưa có tên)'}
                  {f.linkedMember?.sdt && (
                    <span className="text-gray-400 text-xs ml-1.5">· {f.linkedMember.sdt}</span>
                  )}
                </span>
              </label>
            ))
          }
        </div>
        <div className="px-6 py-3 border-t flex items-center justify-between">
          <span className="text-xs text-gray-500">{result || `Đã chọn ${selected.length} người, ${selectedGroups.length} nhóm`}</span>
          <button onClick={send} disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />} Gửi link
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function KhaoSat() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editSurvey, setEditSurvey] = useState(null)
  const [resultsModal, setResultsModal] = useState(null)
  const [sendModal, setSendModal] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getSurveys().then(r => setSurveys(r.data || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Xóa khảo sát này?')) return
    await deleteSurvey(id).catch(e => alert(e.response?.data?.message || 'Không thể xóa'))
    load()
  }

  const handleClose = async (id) => {
    if (!confirm('Đóng khảo sát này? Người dân sẽ không thể trả lời thêm.')) return
    await closeSurvey(id).catch(e => alert(e.response?.data?.message || 'Không thể đóng khảo sát'))
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khảo sát nhanh</h1>
          <p className="text-sm text-gray-500 mt-1">Lấy ý kiến người dân qua các câu hỏi trắc nghiệm (UC12)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Tạo khảo sát
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? <div className="col-span-3 py-12 text-center text-gray-400"><RefreshCw size={20} className="animate-spin inline mr-2" />Đang tải...</div>
          : surveys.length === 0
            ? (
              <div className="col-span-3 py-16 text-center">
                <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">Chưa có khảo sát nào</p>
                <button onClick={() => setCreateOpen(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                  Tạo khảo sát đầu tiên
                </button>
              </div>
            )
            : surveys.map(s => {
              const status = getSurveyStatus(s)
              return (
              <div key={s.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 leading-tight">{s.tieuDe}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {s._count?.questions || 0} câu hỏi · {s._count?.responses || 0} phản hồi
                    </p>
                    {s.deadline && (
                      <p className={`text-xs mt-1 ${new Date(s.deadline) < new Date() ? 'text-red-500' : 'text-orange-500'}`}>
                        Hạn: {fmtDate(s.deadline)}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <button
                    onClick={() => setResultsModal(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                  >
                    <BarChart3 size={13} /> Kết quả
                  </button>
                  <button
                    onClick={() => setSendModal(s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                  >
                    <Send size={13} /> Gửi Zalo
                  </button>
                  <button
                    onClick={() => setEditSurvey(s)}
                    title="Sửa khảo sát"
                    className="p-1.5 rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                  >
                    <Pencil size={14} />
                  </button>
                  {s.isActive && (
                    <button
                      onClick={() => handleClose(s.id)}
                      title="Đóng khảo sát"
                      className="p-1.5 rounded-lg text-amber-500 bg-amber-50 hover:bg-amber-100 hover:text-amber-600 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                    >
                      <Lock size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Xóa khảo sát"
                    className="p-1.5 rounded-lg text-red-400 bg-red-50 hover:bg-red-100 hover:text-red-600 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )})
        }
      </div>

      <SurveyFormModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
      <SurveyFormModal open={!!editSurvey} survey={editSurvey} onClose={() => setEditSurvey(null)} onDone={load} />
      <ResultsModal surveyId={resultsModal} open={!!resultsModal} onClose={() => setResultsModal(null)} />
      <SendZaloModal survey={sendModal} open={!!sendModal} onClose={() => setSendModal(null)} />
    </div>
  )
}
