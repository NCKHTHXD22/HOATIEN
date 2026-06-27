import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, RefreshCw, Send, Link as LinkIcon, Unlink, UserCheck, X } from 'lucide-react'
import { syncFollowers, getFollowers, sendDirectMessage, searchMembers, linkFollower } from '../services/zaloService'

export default function ZaloFollowersModal({ open, onClose }) {
  const [followers, setFollowers] = useState([])
  const [total, setTotal] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Send message modal
  const [sendModal, setSendModal] = useState({ open: false, userIds: [], text: '', sending: false })
  
  // Link modal
  const [linkModal, setLinkModal] = useState({ open: false, follower: null, searchQ: '', results: [], linking: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFollowers()
      setFollowers(res.data?.data?.followers || [])
      setTotal(res.data?.data?.total || 0)
      setSyncing(res.data?.data?.syncing || false)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await syncFollowers()
      alert(res.data?.message || 'Đã bắt đầu đồng bộ')
      load()
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi đồng bộ')
      setSyncing(false)
    }
  }

  const handleSendSubmit = async () => {
    if (!sendModal.text.trim()) return alert('Nhập nội dung')
    setSendModal(prev => ({ ...prev, sending: true }))
    try {
      const res = await sendDirectMessage({ userIds: sendModal.userIds, message: sendModal.text })
      alert(`Gửi xong: Thành công ${res.data?.data?.sent}, Thất bại ${res.data?.data?.failed}`)
      setSendModal({ open: false, userIds: [], text: '', sending: false })
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi gửi tin')
      setSendModal(prev => ({ ...prev, sending: false }))
    }
  }

  // Effect for member search in link modal
  useEffect(() => {
    if (!linkModal.open || !linkModal.searchQ) return
    const t = setTimeout(() => {
      searchMembers(linkModal.searchQ)
        .then(res => setLinkModal(p => ({ ...p, results: res.data?.data || [] })))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [linkModal.searchQ, linkModal.open])

  const handleLink = async (memberId) => {
    setLinkModal(p => ({ ...p, linking: true }))
    try {
      await linkFollower(linkModal.follower.userId, memberId)
      alert(memberId ? 'Liên kết thành công' : 'Đã hủy liên kết')
      setLinkModal({ open: false, follower: null, searchQ: '', results: [], linking: false })
      load()
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi liên kết')
      setLinkModal(p => ({ ...p, linking: false }))
    }
  }

  // Selection for bulk send
  const [selectedIds, setSelectedIds] = useState([])
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelectedIds(p => p.length === filtered.length ? [] : filtered.map(f => f.userId))

  const filtered = followers.filter(f =>
    (f.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.userId || '').includes(search)
  )

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Quản lý danh bạ Zalo OA</h2>
            <p className="text-xs text-gray-500 mt-0.5">Đã tải {total} người quan tâm. Zalo đang đồng bộ tên và avatar ngầm.</p>
          </div>
          <div className="flex gap-2 items-center">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSendModal({ open: true, userIds: selectedIds, text: '', sending: false })}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              >
                <Send size={14} /> Gửi tin ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> 
              {syncing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
            </button>
            <button onClick={onClose} className="p-1.5 ml-2 hover:bg-gray-100 rounded-lg text-gray-500"><X size={18} /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 shrink-0 flex gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Tìm theo tên Zalo hoặc UserID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="rounded" onChange={toggleAll} checked={filtered.length > 0 && selectedIds.length === filtered.length} />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Avatar</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên Zalo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Liên kết Nhân khẩu</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-gray-400"><RefreshCw size={20} className="animate-spin inline mr-2" />Đang tải...</td></tr> :
             filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Không tìm thấy follower nào</td></tr> :
             filtered.map(f => (
               <tr key={f.userId} className="hover:bg-gray-50">
                 <td className="px-4 py-3">
                   <input type="checkbox" className="rounded" checked={selectedIds.includes(f.userId)} onChange={() => toggleSelect(f.userId)} />
                 </td>
                 <td className="px-4 py-3">
                   <img src={f.avatar || 'https://via.placeholder.com/40'} alt="avatar" className="w-8 h-8 rounded-full bg-gray-200" />
                 </td>
                 <td className="px-4 py-3 font-medium">{f.displayName || '(Chưa có tên)'}</td>
                 <td className="px-4 py-3 text-gray-500 font-mono text-xs">{f.userId}</td>
                 <td className="px-4 py-3">
                   {f.linkedMemberId ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                       <UserCheck size={12} /> Đã liên kết ({f.linkedMemberId.slice(-4)})
                     </span>
                   ) : (
                     <span className="text-xs text-gray-400">Chưa liên kết</span>
                   )}
                 </td>
                 <td className="px-4 py-3 text-right">
                   <div className="flex items-center justify-end gap-2">
                     <button
                       onClick={() => setLinkModal({ open: true, follower: f, searchQ: '', results: [], linking: false })}
                       className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Liên kết Nhân khẩu"
                     ><LinkIcon size={15} /></button>
                     <button
                       onClick={() => setSendModal({ open: true, userIds: [f.userId], text: '', sending: false })}
                       className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gửi tin nhắn"
                     ><Send size={15} /></button>
                   </div>
                 </td>
               </tr>
             ))
            }
          </tbody>
        </table>
      </div>

      {/* Send Message Modal */}
      {sendModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-1">Gửi tin nhắn Zalo</h2>
            <p className="text-sm text-gray-500 mb-4">Gửi tin nhắn đến {sendModal.userIds.length} người dùng đã chọn</p>
            <textarea
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[120px] resize-none"
              placeholder="Nhập nội dung tin nhắn tư vấn..."
              value={sendModal.text}
              onChange={e => setSendModal(p => ({ ...p, text: e.target.value }))}
            />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setSendModal(p => ({ ...p, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
              <button
                onClick={handleSendSubmit}
                disabled={sendModal.sending}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {sendModal.sending ? 'Đang gửi...' : <><Send size={15} /> Gửi ngay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Member Modal */}
      {linkModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="p-5 border-b">
              <h2 className="text-lg font-bold">Liên kết Nhân khẩu</h2>
              <div className="flex items-center gap-3 mt-3 bg-gray-50 p-3 rounded-lg">
                <img src={linkModal.follower?.avatar} className="w-10 h-10 rounded-full" alt="" />
                <div>
                  <p className="font-medium text-sm">{linkModal.follower?.displayName}</p>
                  <p className="text-xs font-mono text-gray-500">{linkModal.follower?.userId}</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto">
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Gõ tên hoặc số điện thoại nhân khẩu..."
                  value={linkModal.searchQ}
                  onChange={e => setLinkModal(p => ({ ...p, searchQ: e.target.value }))}
                />
              </div>

              {linkModal.searchQ ? (
                <div className="space-y-2">
                  {linkModal.results.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-4">Không tìm thấy ai</p>
                  ) : (
                    linkModal.results.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-blue-50">
                        <div>
                          <p className="font-medium text-sm">{m.hoTen}</p>
                          <p className="text-xs text-gray-500">
                            {m.sdt ? `SĐT: ${m.sdt} - ` : ''}{m.household?.village?.ten} - Sinh: {m.ngaySinh ? new Date(m.ngaySinh).getFullYear() : '?'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLink(m.id)}
                          disabled={linkModal.linking}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded hover:bg-blue-200 disabled:opacity-50"
                        >Ghép nối</button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500 py-4">Gõ tên để tìm kiếm nhân khẩu tương ứng</p>
              )}
            </div>

            <div className="p-5 border-t flex justify-between bg-gray-50 rounded-b-xl">
              {linkModal.follower?.linkedMemberId ? (
                <button
                  onClick={() => handleLink(null)}
                  disabled={linkModal.linking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 text-sm rounded disabled:opacity-50"
                ><Unlink size={14}/> Hủy liên kết cũ</button>
              ) : <div></div>}
              <button onClick={() => setLinkModal(p => ({ ...p, open: false }))} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Đóng</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>,
    document.body
  )
}
