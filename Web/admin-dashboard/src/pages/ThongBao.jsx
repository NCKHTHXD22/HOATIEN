import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Send, Plus, Eye, Trash2, CheckCircle2, XCircle,
  Search, RefreshCw, MessageSquare, Mail, Phone, X,
  Image, FileText,
} from 'lucide-react'
import {
  getNotifications, createNotification, sendNotification, deleteNotification,
  scheduleNotification, cancelSchedule, getNotificationSends,
  confirmSend, addFeedback, uploadAttachment, getGroups, getMembers,
} from '../services/notificationService'
import { getFollowers, sendDirectMessage } from '../services/zaloService'
import ZaloFollowersModal from '../components/ZaloFollowersModal'

const STATUS_LABEL = {
  NHAP: { label: 'Nháp', color: 'bg-gray-100 text-gray-600' },
  CHO_GUI: { label: 'Chờ gửi', color: 'bg-yellow-100 text-yellow-700' },
  DANG_GUI: { label: 'Đang gửi...', color: 'bg-blue-100 text-blue-700' },
  DA_GUI: { label: 'Đã gửi', color: 'bg-green-100 text-green-700' },
  DA_HUY: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
}

const SEND_STATUS_LABEL = {
  PENDING: { label: 'Chờ', color: 'text-gray-400' },
  SENT: { label: 'Đã gửi', color: 'text-green-600' },
  FAILED: { label: 'Thất bại', color: 'text-red-600' },
  READ: { label: 'Đã đọc', color: 'text-blue-600' },
  CONFIRMED: { label: 'Xác nhận', color: 'text-purple-600' },
}

const CHANNEL_ICON = {
  ZALO: <span className="text-blue-500 text-xs font-bold">Zalo</span>,
  EMAIL: <Mail size={13} className="text-orange-500" />,
  SMS: <Phone size={13} className="text-green-600" />,
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Modal Soạn thông báo ── (Redesigned — Quế Sơn style) ──
function ComposeModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ tieuDe: '', noiDung: '', kenhGui: [], memberIds: [], groupIds: [], followerIds: [] })
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [followers, setFollowers] = useState([])
  const [followerSearch, setFollowerSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [tab, setTab] = useState('nhom')

  // Attachment state (image preview + other files)
  const [attachTab, setAttachTab] = useState('image')
  const [imgPreviews, setImgPreviews] = useState([])  // [{file, url}]
  const [otherFiles, setOtherFiles] = useState([])    // [{file}]

  // Inline toast (tránh dùng alert())
  const [toast, setToast] = useState(null) // {type: 'success'|'error', msg}
  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (!open) return
    setForm({ tieuDe: '', noiDung: '', kenhGui: [], memberIds: [], groupIds: [], followerIds: [] })
    setImgPreviews([]); setOtherFiles([])
    setScheduleMode(false); setScheduledAt(''); setToast(null); setFollowerSearch('')
    getGroups().then(r => setGroups(r.data || [])).catch(() => {})
    getFollowers().then(r => setFollowers(r.data?.data?.followers || [])).catch(() => {})
  }, [open])

  useEffect(() => {
    if (tab !== 'canhan') return
    const t = setTimeout(() => {
      getMembers({ search: memberSearch, limit: 30 })
        .then(r => setMembers(r.data || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [memberSearch, tab])

  const toggleChannel = (ch) =>
    setForm(f => ({
      ...f,
      kenhGui: f.kenhGui.includes(ch) ? f.kenhGui.filter(c => c !== ch) : [...f.kenhGui, ch],
    }))

  const toggleGroup = (id) =>
    setForm(f => ({
      ...f,
      groupIds: f.groupIds.includes(id) ? f.groupIds.filter(g => g !== id) : [...f.groupIds, id],
    }))

  const toggleMember = (id) =>
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(m => m !== id) : [...f.memberIds, id],
    }))

  const toggleFollower = (id) =>
    setForm(f => ({
      ...f,
      followerIds: f.followerIds.includes(id) ? f.followerIds.filter(x => x !== id) : [...f.followerIds, id],
    }))

  function handleImageFiles(files) {
    const imgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - imgPreviews.length)
    if (!imgs.length) return
    setImgPreviews(prev => [...prev, ...imgs.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }

  function handleOtherFile(file) {
    if (!file) return
    setOtherFiles(prev => [...prev, { file }])
  }

  const handleSave = async () => {
    if (!form.tieuDe.trim() || !form.noiDung.trim()) return showToast('error', 'Nhập tiêu đề và nội dung')
    if (form.kenhGui.length === 0) return showToast('error', 'Chọn ít nhất 1 kênh gửi')
    if (form.memberIds.length === 0 && form.groupIds.length === 0 && form.followerIds.length === 0) return showToast('error', 'Chọn ít nhất 1 người nhận, nhóm hoặc follower')
    setLoading(true)
    try {
      const res = await createNotification(form)
      const id = res.data.id
      const allFiles = [...imgPreviews.map(p => p.file), ...otherFiles.map(f => f.file)]
      for (const file of allFiles) {
        await uploadAttachment(id, file).catch(() => {})
      }
      const hasMemberRecipients = form.memberIds.length > 0 || form.groupIds.length > 0
      // Gửi cho follower Zalo (kèm tiêu đề/nội dung/đính kèm) — gửi ngay
      let followerWarning = ''
      if (form.followerIds.length > 0) {
        try {
          await sendDirectMessage({ userIds: form.followerIds, notificationId: id })
        } catch (e) {
          followerWarning = ` (Lưu ý: ${e.response?.data?.message || 'gửi tới follower Zalo thất bại'})`
        }
      }
      if (scheduleMode && scheduledAt && hasMemberRecipients) {
        await scheduleNotification(id, scheduledAt)
        showToast('success', `Đã lưu và lên lịch gửi thành công!${followerWarning}`)
      } else {
        await sendNotification(id)
        showToast('success', `Đã gửi thông báo thành công!${followerWarning}`)
      }
      setTimeout(() => { onDone(); onClose() }, 1200)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Có lỗi xảy ra')
    } finally { setLoading(false) }
  }

  if (!open) return null

  const totalAttach = imgPreviews.length + otherFiles.length
  const totalRecipients = form.groupIds.length + form.memberIds.length + form.followerIds.length

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Soạn thông báo mới</h2>
            <p className="text-xs text-gray-400 mt-0.5">Soạn và gửi thông báo qua Zalo, Email, SMS</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Inline Toast */}
        {toast && (
          <div className={`mx-6 mt-3 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 shrink-0 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {toast.msg}
          </div>
        )}

        {/* Body — 2 cột */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x min-h-full">

            {/* ── Cột trái: Tiêu đề, Nội dung, Đính kèm ── */}
            <div className="px-6 py-5 space-y-4">
              {/* Tiêu đề */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  placeholder="Nhập tiêu đề thông báo..."
                  value={form.tieuDe}
                  onChange={e => setForm(f => ({ ...f, tieuDe: e.target.value }))}
                  maxLength={200}
                />
              </div>

              {/* Nội dung */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Nội dung <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs font-mono ${form.noiDung.length > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
                    {form.noiDung.length}/2000
                  </span>
                </div>
                <textarea
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none transition-all"
                  rows={5}
                  placeholder="Nhập nội dung thông báo..."
                  value={form.noiDung}
                  onChange={e => setForm(f => ({ ...f, noiDung: e.target.value.slice(0, 2000) }))}
                />
              </div>

              {/* Đính kèm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Đính kèm</label>

                {/* Attach tabs */}
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-3">
                  {[
                    { id: 'image', label: 'Hình ảnh', Icon: Image },
                    { id: 'file',  label: 'File',     Icon: FileText },
                  ].map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setAttachTab(id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        attachTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                {/* Image panel */}
                {attachTab === 'image' && (
                  <div className="space-y-2">
                    <label
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); handleImageFiles(e.dataTransfer.files) }}
                    >
                      <Image size={22} className="text-gray-300" />
                      <span className="text-sm text-gray-400">Chọn hoặc kéo thả ảnh · tối đa 5 ảnh</span>
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={e => handleImageFiles(e.target.files)} />
                    </label>
                    {imgPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {imgPreviews.map((p, i) => (
                          <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200">
                            <img src={p.url} alt="" className="h-full w-full object-cover" />
                            <button
                              onClick={() => setImgPreviews(prev => prev.filter((_, j) => j !== i))}
                              className="absolute top-0.5 right-0.5 rounded-full bg-red-500 text-white h-4 w-4 flex items-center justify-center hover:bg-red-600 transition-colors"
                            ><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* File panel */}
                {attachTab === 'file' && (
                  <div className="space-y-2">
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                      <FileText size={22} className="text-gray-300" />
                      <span className="text-sm text-gray-400">Chọn file .pdf .docx .xlsx</span>
                      <input type="file" accept=".pdf,.docx,.xlsx,.xls" className="hidden"
                        onChange={e => handleOtherFile(e.target.files[0])} />
                    </label>
                    {otherFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                        <FileText size={15} className="text-blue-500 shrink-0" />
                        <span className="text-sm flex-1 truncate">{f.file.name}</span>
                        <button onClick={() => setOtherFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Cột phải: Kênh gửi, Người nhận, Lên lịch ── */}
            <div className="px-6 py-5 space-y-5">

              {/* Kênh gửi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kênh gửi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'ZALO',  label: 'ZALO',  icon: <span className="text-blue-500 text-xs font-extrabold">Z</span> },
                    { id: 'EMAIL', label: 'EMAIL', icon: <Mail size={13} className="text-orange-500" /> },
                    { id: 'SMS',   label: 'SMS',   icon: <Phone size={13} className="text-green-600" /> },
                  ].map(ch => (
                    <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.kenhGui.includes(ch.id)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {ch.icon}
                      <span>{ch.label}</span>
                      {form.kenhGui.includes(ch.id) && <CheckCircle2 size={13} className="text-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Người nhận */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Người nhận <span className="text-red-500">*</span>
                </label>
                {/* Tab nhóm / cá nhân */}
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-3">
                  {[
                    { id: 'nhom',     label: 'Theo nhóm' },
                    { id: 'canhan',   label: 'Cá nhân'   },
                    { id: 'follower', label: 'Follower Zalo' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                        tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >{t.label}</button>
                  ))}
                </div>

                {tab === 'nhom' && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border divide-y">
                    {groups.length === 0
                      ? <p className="text-center text-sm text-gray-400 py-4">Chưa có nhóm. Tạo nhóm tại "Người nhận"</p>
                      : groups.map(g => (
                        <label key={g.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${form.groupIds.includes(g.id) ? 'bg-blue-50/50' : ''}`}
                        >
                          <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="rounded" />
                          <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                            {(g.ten || '?')[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm flex-1">{g.ten}</span>
                          <span className="text-xs text-gray-400">{g._count?.members || 0} người</span>
                        </label>
                      ))
                    }
                  </div>
                )}

                {tab === 'canhan' && (
                  <div>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                      <input
                        className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                        placeholder="Tìm kiếm nhân khẩu..."
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-xl border divide-y">
                      {members.length === 0
                        ? <p className="text-center text-sm text-gray-400 py-4">Nhập tên để tìm kiếm</p>
                        : members.map(m => (
                          <label key={m.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${form.memberIds.includes(m.id) ? 'bg-blue-50/50' : ''}`}
                          >
                            <input type="checkbox" checked={form.memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} className="rounded" />
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                              {(m.hoTen || '?')[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm flex-1">{m.hoTen}</span>
                            <span className="text-xs text-gray-400 truncate max-w-[5rem]">{m.household?.village?.ten}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>
                )}

                {tab === 'follower' && (
                  <div>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                      <input
                        className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                        placeholder="Tìm follower theo tên hoặc UserID..."
                        value={followerSearch}
                        onChange={e => setFollowerSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-xl border divide-y">
                      {followers.length === 0
                        ? <p className="text-center text-sm text-gray-400 py-4">Chưa có follower. Bấm "Đồng bộ" ở "Quản lý danh bạ Zalo"</p>
                        : followers
                            .filter(f => {
                              const q = followerSearch.toLowerCase()
                              return !q || (f.displayName || '').toLowerCase().includes(q) || (f.userId || '').includes(q)
                            })
                            .slice(0, 50)
                            .map(f => (
                              <label key={f.userId}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${form.followerIds.includes(f.userId) ? 'bg-blue-50/50' : ''}`}
                              >
                                <input type="checkbox" checked={form.followerIds.includes(f.userId)} onChange={() => toggleFollower(f.userId)} className="rounded" />
                                <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold shrink-0 overflow-hidden">
                                  {f.avatar ? <img src={f.avatar} alt="" className="h-full w-full object-cover" /> : (f.displayName || '?')[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm flex-1">{f.displayName || '(Chưa có tên)'}</span>
                                {f.linkedMemberId && <span className="text-[10px] text-green-600">✓ liên kết</span>}
                              </label>
                            ))
                      }
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Follower chỉ nhận qua Zalo, và chỉ tới được người đã nhắn OA trong 48h.</p>
                  </div>
                )}

                {totalRecipients > 0 && (
                  <p className="text-xs text-blue-600 mt-1.5 font-medium">
                    Đã chọn:{' '}
                    {form.groupIds.length > 0 && `${form.groupIds.length} nhóm`}
                    {form.groupIds.length > 0 && form.memberIds.length > 0 && ', '}
                    {form.memberIds.length > 0 && `${form.memberIds.length} cá nhân`}
                    {(form.groupIds.length > 0 || form.memberIds.length > 0) && form.followerIds.length > 0 && ', '}
                    {form.followerIds.length > 0 && `${form.followerIds.length} follower`}
                  </p>
                )}
              </div>

              {/* Lên lịch */}
              <div className="rounded-xl border border-gray-200 px-4 py-3.5 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-gray-700">Lên lịch gửi tự động</span>
                </label>
                {scheduleMode && (
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">
            {totalAttach > 0 && `${totalAttach} tệp đính kèm · `}
            {totalRecipients > 0 ? `${totalRecipients} người nhận` : 'Chưa chọn người nhận'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <><RefreshCw size={14} className="animate-spin" /> Đang xử lý...</>
                : <><Send size={14} /> {scheduleMode ? 'Lưu & Lên lịch' : 'Gửi ngay'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Modal Xem chi tiết / trạng thái gửi ───────────────────
function SendsModal({ notifId, title, open, onClose }) {
  const [sends, setSends] = useState([])
  const [loading, setLoading] = useState(false)
  const [feedbackText, setFeedbackText] = useState({})

  const load = useCallback(() => {
    if (!notifId) return
    setLoading(true)
    getNotificationSends(notifId)
      .then(r => setSends(r.data || []))
      .finally(() => setLoading(false))
  }, [notifId])

  useEffect(() => { if (open) load() }, [open, load])

  const handleConfirm = async (sendId) => {
    await confirmSend(sendId).catch(() => {})
    load()
  }

  const handleFeedback = async (sendId) => {
    const text = feedbackText[sendId]
    if (!text?.trim()) return
    await addFeedback(sendId, text).catch(() => {})
    setFeedbackText(f => ({ ...f, [sendId]: '' }))
    load()
  }

  if (!open) return null

  const total = sends.length
  const sent = sends.filter(s => ['SENT','READ','CONFIRMED'].includes(s.trangThai)).length
  const failed = sends.filter(s => s.trangThai === 'FAILED').length

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-500">
              Tổng: {total} | Đã gửi: {sent} | Thất bại: {failed}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="flex items-center justify-center py-12 text-gray-400"><RefreshCw size={20} className="animate-spin mr-2" /> Đang tải...</div>
            : sends.length === 0
              ? <p className="text-center text-gray-400 py-12">Chưa có dữ liệu gửi</p>
              : sends.map(s => {
                const st = SEND_STATUS_LABEL[s.trangThai] || {}
                return (
                  <div key={s.id} className="px-6 py-3 border-b hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{s.member?.hoTen}</p>
                        <p className="text-xs text-gray-400">{s.member?.household?.village?.ten}</p>
                      </div>
                      <span className="text-xs">{CHANNEL_ICON[s.kenh]}</span>
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                      {s.sentAt && <span className="text-xs text-gray-400">{fmtDate(s.sentAt)}</span>}
                      {s.errorMsg && <span className="text-xs text-red-400 max-w-32 truncate" title={s.errorMsg}>{s.errorMsg}</span>}
                      {!['CONFIRMED'].includes(s.trangThai) && s.trangThai !== 'PENDING' && (
                        <button
                          onClick={() => handleConfirm(s.id)}
                          className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                        >Xác nhận</button>
                      )}
                    </div>
                    {/* Phản hồi */}
                    {s.feedbacks?.length > 0 && (
                      <div className="mt-2 ml-4 space-y-1">
                        {s.feedbacks.map(fb => (
                          <p key={fb.id} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                            <MessageSquare size={11} className="inline mr-1" />{fb.noiDung}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <input
                        className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Nhập phản hồi..."
                        value={feedbackText[s.id] || ''}
                        onChange={e => setFeedbackText(f => ({ ...f, [s.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleFeedback(s.id)}
                      />
                      <button
                        onClick={() => handleFeedback(s.id)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >Lưu</button>
                    </div>
                  </div>
                )
              })
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

// ── Main Page ──────────────────────────────────────────────
export default function ThongBao() {
  const [notifs, setNotifs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [sendsModal, setSendsModal] = useState(null) // { id, title }
  const [zaloModalOpen, setZaloModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotifications({ page, limit: 20, search: search || undefined, trangThai: filterStatus || undefined })
      setNotifs(res.data || [])
      setTotal(res.pagination?.total || 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, search, filterStatus])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Xóa thông báo này?')) return
    await deleteNotification(id).catch(e => alert(e.response?.data?.message || 'Không thể xóa'))
    load()
  }

  const handleSend = async (id) => {
    if (!confirm('Gửi thông báo ngay?')) return
    try {
      await sendNotification(id)
      alert('Đã gửi!')
      load()
    } catch (e) { alert(e.response?.data?.message || 'Gửi thất bại') }
  }

  const handleCancelSchedule = async (id) => {
    if (!confirm('Hủy lịch gửi?')) return
    await cancelSchedule(id).catch(() => {})
    load()
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thông Báo</h1>
          <p className="text-sm text-gray-500 mt-1">Soạn và gửi thông báo đến người dân qua Zalo, Email, SMS</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZaloModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 text-sm font-medium rounded-lg hover:bg-blue-100"
          >
            <MessageSquare size={16} /> Quản lý danh bạ Zalo
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} /> Soạn thông báo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Tìm kiếm tiêu đề..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tiêu đề</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Kênh</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Người tạo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Thời gian</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lượt gửi</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? <tr><td colSpan={7} className="text-center py-12 text-gray-400"><RefreshCw size={20} className="animate-spin inline mr-2" />Đang tải...</td></tr>
              : notifs.length === 0
                ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Chưa có thông báo nào</td></tr>
                : notifs.map(n => {
                  const st = STATUS_LABEL[n.trangThai] || {}
                  return (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-56">{n.tieuDe}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex gap-1.5">
                          {(n.kenhGui || []).map(ch => (
                            <span key={ch}>{CHANNEL_ICON[ch]}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{n.admin?.hoTen}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {n.trangThai === 'CHO_GUI' ? fmtDate(n.scheduledAt) : fmtDate(n.sentAt || n.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{n._count?.sends || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {n._count?.sends > 0 && (
                            <button
                              onClick={() => setSendsModal({ id: n.id, title: n.tieuDe })}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Xem trạng thái gửi"
                            ><Eye size={15} /></button>
                          )}
                          {n.trangThai === 'NHAP' && (
                            <button
                              onClick={() => handleSend(n.id)}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gửi ngay"
                            ><Send size={15} /></button>
                          )}
                          {n.trangThai === 'CHO_GUI' && (
                            <button
                              onClick={() => handleCancelSchedule(n.id)}
                              className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600" title="Hủy lịch"
                            ><XCircle size={15} /></button>
                          )}
                          {['NHAP', 'DA_HUY'].includes(n.trangThai) && (
                            <button
                              onClick={() => handleDelete(n.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Xóa"
                            ><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <span>Tổng: {total} thông báo</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Trước</button>
              <span className="px-3 py-1">{page}/{totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Sau</button>
            </div>
          </div>
        )}
      </div>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onDone={load} />
      {sendsModal && (
        <SendsModal
          notifId={sendsModal.id}
          title={sendsModal.title}
          open={!!sendsModal}
          onClose={() => setSendsModal(null)}
        />
      )}
      <ZaloFollowersModal open={zaloModalOpen} onClose={() => setZaloModalOpen(false)} />
    </div>
  )
}
