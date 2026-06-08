import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Plus, Trash2, RefreshCw, Eye, X,
  PlusCircle, MinusCircle, BarChart3,
} from 'lucide-react'
import { getSurveys, createSurvey, deleteSurvey, getSurveyResults } from '../services/notificationService'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN')
}

const QTYPE_LABEL = { SINGLE: 'Một lựa chọn', MULTIPLE: 'Nhiều lựa chọn', TEXT: 'Văn bản tự do' }

// ── Modal tạo khảo sát ─────────────────────────────────────
function CreateSurveyModal({ open, onClose, onDone }) {
  const [tieuDe, setTieuDe] = useState('')
  const [deadline, setDeadline] = useState('')
  const [questions, setQuestions] = useState([
    { cauHoi: '', loai: 'SINGLE', luaChon: ['', ''] },
  ])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTieuDe(''); setDeadline('')
      setQuestions([{ cauHoi: '', loai: 'SINGLE', luaChon: ['', ''] }])
    }
  }, [open])

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
      await createSurvey({
        tieuDe,
        deadline: deadline || null,
        questions: questions.map(q => ({
          ...q,
          luaChon: q.loai !== 'TEXT' ? q.luaChon.filter(c => c.trim()) : [],
        })),
      })
      onDone(); onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally { setLoading(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Tạo khảo sát nhanh</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
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
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading && <RefreshCw size={13} className="animate-spin" />} Tạo khảo sát
          </button>
        </div>
      </div>
    </div>
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
  return (
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
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function KhaoSat() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [resultsModal, setResultsModal] = useState(null)

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
            : surveys.map(s => (
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.isActive ? 'Đang mở' : 'Đã đóng'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <button
                    onClick={() => setResultsModal(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    <BarChart3 size={13} /> Xem kết quả
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
        }
      </div>

      <CreateSurveyModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
      <ResultsModal surveyId={resultsModal} open={!!resultsModal} onClose={() => setResultsModal(null)} />
    </div>
  )
}
