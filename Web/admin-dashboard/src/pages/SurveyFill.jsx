import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'

// Trang điền khảo sát CÔNG KHAI (dân mở từ link Zalo, không cần đăng nhập)
export default function SurveyFill() {
  const { id } = useParams()
  const [survey, setSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get(`/api/notify/surveys/${id}/public`)
      .then((r) => setSurvey(r.data?.data || null))
      .catch(() => setErr('Không tải được khảo sát'))
      .finally(() => setLoading(false))
  }, [id])

  const setSingle = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }))
  const toggleMulti = (qid, val) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? a[qid] : []
      return { ...a, [qid]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] }
    })

  const submit = async () => {
    for (const q of survey.questions) {
      const v = answers[q.id]
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
        setErr('Vui lòng trả lời tất cả câu hỏi')
        return
      }
    }
    setSubmitting(true); setErr('')
    try {
      await api.post(`/api/notify/surveys/${id}/respond`, { answers })
      setDone(true)
    } catch (e) {
      setErr(e.response?.data?.message || 'Gửi thất bại, vui lòng thử lại')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Đang tải khảo sát...</div>
  if (!survey) return <div className="min-h-screen flex items-center justify-center text-red-500">{err || 'Không tìm thấy khảo sát'}</div>

  const closed = !survey.isActive || (survey.deadline && new Date() > new Date(survey.deadline))

  if (done)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-lg font-semibold text-slate-800">Cảm ơn bạn đã tham gia khảo sát!</p>
          <p className="text-sm text-slate-500 mt-1">UBND Xã Hòa Tiến</p>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800">{survey.tieuDe}</h1>
        <p className="text-sm text-slate-500 mt-1">Khảo sát · UBND Xã Hòa Tiến</p>

        {closed ? (
          <p className="mt-6 text-center text-amber-600">Khảo sát đã đóng hoặc hết hạn.</p>
        ) : (
          <div className="mt-5 space-y-5">
            {survey.questions.map((q, i) => (
              <div key={q.id}>
                <p className="font-medium text-slate-800 mb-2">{i + 1}. {q.cauHoi}</p>
                {q.loai === 'TEXT' ? (
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    rows={3}
                    value={answers[q.id] || ''}
                    onChange={(e) => setSingle(q.id, e.target.value)}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {(q.luaChon || []).map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type={q.loai === 'MULTIPLE' ? 'checkbox' : 'radio'}
                          name={q.id}
                          checked={q.loai === 'MULTIPLE' ? (answers[q.id] || []).includes(opt) : answers[q.id] === opt}
                          onChange={() => (q.loai === 'MULTIPLE' ? toggleMulti(q.id, opt) : setSingle(q.id, opt))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Đang gửi...' : 'Gửi câu trả lời'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
