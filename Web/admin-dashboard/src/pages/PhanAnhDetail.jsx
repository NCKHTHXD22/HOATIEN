import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, UserCheck, Trash2, Loader2, CheckCircle2,
  FileText, ThumbsUp, ThumbsDown, Clock,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import ImageGallery from '../components/ImageGallery'
import AttachmentComposer from '../components/AttachmentComposer'
import AttachmentViewer from '../components/AttachmentViewer'
import { formatDate, cn } from '../lib/utils'
import { toast } from 'sonner'

const EMPTY_ATTACH = { note: '', images: [], video: { url: '', name: '' }, file: { url: '', name: '' } }

export default function PhanAnhDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [draftText, setDraftText] = useState('')
  const [note, setNote] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [assignAttach, setAssignAttach] = useState(EMPTY_ATTACH)
  const [draftAttach, setDraftAttach] = useState(EMPTY_ATTACH)
  const [internalTab, setInternalTab] = useState('assign')

  const isLeader = user?.role === 'SUPER_ADMIN' || user?.role === 'DEPT_LEADER'
  const isOfficer = user?.role === 'OFFICER' || user?.role === 'ADMIN_VILLAGE'

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => api.get(`/api/feedbacks/${id}`).then((r) => r.data),
  })

  useEffect(() => {
    if (data?.feedback) {
      const fb = data.feedback
      setNote(fb.note || '')
      setAssignedTo(fb.assignedTo?._id || '')
      setDraftText(fb.draftResponse || '')
      setAssignAttach({
        note: fb.assignAttachments?.note || '',
        images: fb.assignAttachments?.images || [],
        video: fb.assignAttachments?.video || { url: '', name: '' },
        file: fb.assignAttachments?.file || { url: '', name: '' },
      })
      setDraftAttach({
        note: fb.draftAttachments?.note || '',
        images: fb.draftAttachments?.images || [],
        video: fb.draftAttachments?.video || { url: '', name: '' },
        file: fb.draftAttachments?.file || { url: '', name: '' },
      })
    }
  }, [data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['feedback', id] })
    queryClient.invalidateQueries({ queryKey: ['feedbacks'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const noteMutation = useMutation({
    mutationFn: () => api.put(`/api/feedbacks/${id}`, { note }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã lưu ghi chú'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi lưu'),
  })

  const assignMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/assign`, { assignedTo, ...assignAttach }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã cập nhật phân công'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi phân công'),
  })

  const draftMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/draft`, { draftResponse: draftText, ...draftAttach }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã gửi dự thảo, chờ lãnh đạo duyệt'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi gửi dự thảo'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/approve`, { finalResponse: draftText }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã duyệt và gửi phản hồi cho dân qua Zalo'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi duyệt'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/api/feedbacks/${id}/reject`, { rejectedReason: rejectReason }).then((r) => r.data),
    onSuccess: () => { toast.success('Đã từ chối, cán bộ cần soạn lại dự thảo'); setRejectReason(''); invalidate() },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi từ chối'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/feedbacks/${id}`),
    onSuccess: () => { toast.success('Đã xóa góp ý'); navigate('/phan-anh') },
    onError: (e) => toast.error(e.response?.data?.error || 'Lỗi xóa'),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-400">Đang tải chi tiết phản ánh...</p>
      </div>
    )
  }

  const fb = data?.feedback
  const admins = data?.admins ?? []

  if (!fb) return <p className="text-red-500 font-semibold">Không tìm thấy góp ý</p>

  const shortCode = fb._id.slice(-5).toUpperCase()
  const isDraft = fb.status === 'draft'
  const isResolved = fb.status === 'resolved' || fb.status === 'done'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/phan-anh">
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Quay lại
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            Chi tiết phản ánh <span className="text-emerald-600 font-mono">#{shortCode}</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">{fb._id}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {fb.categoryId && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              {fb.categoryId.icon} {fb.categoryId.name}
            </span>
          )}
          <StatusBadge status={fb.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left Column — Info */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Thông tin người gửi &amp; Nội dung</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Họ tên công dân</p>
                  <p className="font-medium text-slate-700 text-sm">{fb.displayName || '(Ẩn danh)'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Liên hệ</p>
                  <p className="font-medium text-slate-700 text-sm">{fb.contact}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400 tracking-wider mb-0.5">NGÀY GỬI</p>
                  <p className="text-slate-600">{formatDate(fb.createdAt)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400 tracking-wider mb-0.5">HẠN XỬ LÝ</p>
                  <p className={cn("text-slate-600", fb.deadline && new Date(fb.deadline) < new Date() && !isResolved && 'text-red-600 font-semibold')}>
                    {fb.deadline ? formatDate(fb.deadline) : '—'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400 tracking-wider mb-0.5">CÁN BỘ PHỤ TRÁCH</p>
                  <p className="text-slate-600 font-medium">{fb.assignedTo?.fullName ?? '—'}</p>
                </div>
                {fb.assignedBy && (
                  <div>
                    <p className="font-semibold text-slate-400 tracking-wider mb-0.5">NGƯỜI PHÂN CÔNG</p>
                    <p className="text-slate-600">{fb.assignedBy?.fullName ?? '—'}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nội dung phản ánh</p>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{fb.content}</div>
              </div>

              {(() => {
                const imgs = fb.imageUrls?.length > 0 ? fb.imageUrls : fb.imageUrl ? [fb.imageUrl] : []
                return imgs.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Hình ảnh đính kèm ({imgs.length})
                    </p>
                    <ImageGallery images={imgs} />
                  </div>
                ) : null
              })()}
            </div>
          </div>

          {/* Trao đổi nội bộ */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">📎 Trao đổi nội bộ</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {[
                  { id: 'assign', label: 'Phân công' },
                  { id: 'draft', label: 'Xử lý' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInternalTab(id)}
                    className={cn(
                      'flex-1 rounded-lg py-1 text-xs font-semibold transition-all',
                      internalTab === id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {internalTab === 'assign' ? (
                <AttachmentViewer data={fb.assignAttachments} emptyLabel="Chưa có đính kèm phân công." />
              ) : (
                <AttachmentViewer data={fb.draftAttachments} emptyLabel="Chưa có đính kèm xử lý." />
              )}
            </div>
          </div>

          {/* Dự thảo đang chờ duyệt */}
          {fb.draftResponse && (
            <div className={cn("rounded-2xl border bg-white shadow-sm overflow-hidden", isDraft ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-100')}>
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm font-bold text-slate-800">Dự thảo phản hồi</h3>
                {isDraft && <span className="text-[10px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold ml-auto">Chờ duyệt</span>}
              </div>
              <div className="p-5">
                <div className="bg-sky-50/50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{fb.draftResponse}</div>
                {fb.draftBy && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    Soạn bởi {fb.draftBy?.fullName} · {fb.draftAt ? formatDate(fb.draftAt) : ''}
                  </p>
                )}
                {fb.rejectedReason && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                    <span className="font-semibold">Lý do từ chối: </span>{fb.rejectedReason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phản hồi đã gửi dân */}
          {isResolved && fb.finalResponse && (
            <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-bold text-green-700">Phản hồi đã gửi qua Zalo</h3>
              </div>
              <div className="p-5">
                <div className="bg-green-50/50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{fb.finalResponse}</div>
                {fb.sentAt && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    Gửi lúc {formatDate(fb.sentAt)}
                    {fb.approvedBy && ` · Duyệt bởi ${fb.approvedBy?.fullName}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* CÁN BỘ: Soạn dự thảo */}
          {isOfficer && !isResolved && (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-500" /> Soạn dự thảo trả lời
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <textarea
                  rows={5}
                  placeholder="Nhập nội dung dự thảo phản hồi cho người dân..."
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 resize-none"
                />
                <div className="border-t pt-3">
                  <p className="text-[11px] font-semibold text-slate-400 mb-2">Đính kèm thêm thông tin xử lý (nội bộ):</p>
                  <AttachmentComposer value={draftAttach} onChange={setDraftAttach} disabled={draftMutation.isPending} />
                </div>
                <button
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors cursor-pointer"
                  onClick={() => {
                    if (!draftText.trim()) { toast.error('Vui lòng nhập nội dung dự thảo'); return }
                    if (window.confirm('Gửi dự thảo để lãnh đạo duyệt?')) draftMutation.mutate()
                  }}
                  disabled={draftMutation.isPending}
                >
                  {draftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gửi dự thảo chờ duyệt
                </button>
              </div>
            </div>
          )}

          {/* LÃNH ĐẠO: Duyệt / Từ chối */}
          {isLeader && isDraft && (
            <div className="rounded-2xl border border-sky-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm font-bold text-sky-800">Duyệt dự thảo</h3>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Nội dung gửi dân (chỉnh sửa nếu cần):</p>
                  <textarea
                    rows={5}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full border border-sky-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-400 resize-none"
                  />
                  {draftText !== fb.draftResponse && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium">✏️ Đã chỉnh sửa so với bản gốc của cán bộ</p>
                  )}
                </div>

                <button
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
                  onClick={() => {
                    if (!draftText.trim()) { toast.error('Nội dung phản hồi không được để trống'); return }
                    if (window.confirm('Duyệt và gửi phản hồi này cho người dân qua Zalo?')) approveMutation.mutate()
                  }}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Duyệt &amp; Gửi dân
                </button>

                <div className="border-t pt-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400">Yêu cầu soạn lại:</p>
                  <textarea
                    rows={2}
                    placeholder="Lý do từ chối (tuỳ chọn)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 resize-none"
                  />
                  <button
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 shadow-sm transition-colors cursor-pointer"
                    onClick={() => {
                      if (window.confirm('Từ chối dự thảo và trả lại cán bộ?')) rejectMutation.mutate()
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                    Từ chối — Trả về cán bộ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LÃNH ĐẠO: Phân công */}
          {isLeader && (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-sky-500" /> Phân công xử lý
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 transition-all cursor-pointer"
                >
                  <option value="">— Chưa phân công —</option>
                  {admins.map((a) => (
                    <option key={a._id} value={a._id}>{a.fullName} (@{a.username})</option>
                  ))}
                </select>
                <div className="border-t pt-3">
                  <p className="text-[11px] font-semibold text-slate-400 mb-2">Đính kèm thêm thông tin cho cán bộ xử lý:</p>
                  <AttachmentComposer value={assignAttach} onChange={setAssignAttach} disabled={assignMutation.isPending} />
                </div>
                <button
                  onClick={() => assignMutation.mutate()}
                  disabled={assignMutation.isPending}
                  className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm transition-colors cursor-pointer"
                >
                  {assignMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Cập nhật phân công
                </button>
              </div>
            </div>
          )}

          {/* Ghi chú nội bộ */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-bold text-slate-800">📝 Ghi chú nội bộ</h3>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                rows={3}
                placeholder="Ghi chú cho nội bộ (người gửi không thấy)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400 resize-none"
              />
              <button
                onClick={() => noteMutation.mutate()}
                disabled={noteMutation.isPending}
                className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm transition-colors cursor-pointer"
              >
                {noteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Lưu ghi chú
              </button>
            </div>
          </div>

          {/* Xóa phản ánh */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">Xóa vĩnh viễn phản ánh này</p>
                <button
                  onClick={() => { if (window.confirm('Xác nhận xóa vĩnh viễn phản ánh này?')) deleteMutation.mutate() }}
                  disabled={deleteMutation.isPending}
                  className="h-8 px-3 inline-flex items-center gap-1 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 text-red-600 shadow-sm transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xóa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
