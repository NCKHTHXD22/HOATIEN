import '../styles/ho-so.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Filter, Home, Users, ArrowRightLeft, CheckCircle, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, PrimaryBtn, SecondaryBtn, DataTable, Tabs, SearchInput, StatCard, Badge } from '../components/ui'
import * as householdService from '../services/householdService'

const LOAI_HO_LABEL = {
  THUONG_TRU: { label: 'Thường trú', variant: 'green' },
  TAM_TRU:    { label: 'Tạm trú',    variant: 'amber' },
  TAM_VANG:   { label: 'Tạm vắng',  variant: 'orange' },
}

const TRANG_THAI_LABEL = {
  ACTIVE:       { label: 'Đang hoạt động', variant: 'green' },
  DA_TACH:      { label: 'Đã tách',        variant: 'amber' },
  DA_GIAI_THE:  { label: 'Đã giải thể',    variant: 'red' },
}

const TAB_FILTER = {
  'Tất cả':    {},
  'Thường trú': { loaiHo: 'THUONG_TRU' },
  'Tạm trú':   { loaiHo: 'TAM_TRU' },
  'Tạm vắng':  { loaiHo: 'TAM_VANG' },
}

const COLUMNS = ['Số HK', 'Địa chỉ', 'Thôn', 'Loại hộ', 'Nhân khẩu', 'Trạng thái', '']

export default function HoSo() {
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [households, setHouseholds] = useState([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [stats, setStats] = useState({ all: 0, thuongTru: 0, tamTru: 0, tamVang: 0 })
  const [loading, setLoading] = useState(true)
  const searchDebounce = useRef(null)

  const loadStats = useCallback(async () => {
    try {
      const [all, tt, tr, tv] = await Promise.all([
        householdService.getAll({ page: 1, limit: 1 }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'THUONG_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_TRU' }),
        householdService.getAll({ page: 1, limit: 1, loaiHo: 'TAM_VANG' }),
      ])
      setStats({
        all:      all.data.pagination.total,
        thuongTru: tt.data.pagination.total,
        tamTru:    tr.data.pagination.total,
        tamVang:   tv.data.pagination.total,
      })
    } catch {}
  }, [])

  const loadList = useCallback(async (currentTab, currentSearch, currentPage) => {
    setLoading(true)
    try {
      let res
      if (currentSearch.trim()) {
        res = await householdService.search(currentSearch.trim())
        setHouseholds(res.data.data || [])
        setPagination({ total: res.data.data?.length ?? 0, totalPages: 1 })
      } else {
        const params = { ...TAB_FILTER[currentTab], page: currentPage, limit: 20 }
        res = await householdService.getAll(params)
        setHouseholds(res.data.data || [])
        setPagination(res.data.pagination || { total: 0, totalPages: 1 })
      }
    } catch (e) {
      console.error('HoSo load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load stats once
  useEffect(() => { loadStats() }, [loadStats])

  // Reload list when tab/page changes
  useEffect(() => { loadList(tab, search, page) }, [tab, page])

  // Debounce search
  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(1)
      loadList(tab, val, 1)
    }, 400)
  }

  const handleTabChange = (t) => { setTab(t); setPage(1) }

  const statCards = [
    { label: 'Tổng hộ dân', value: stats.all,      icon: Home,           iconColor: '#2563eb' },
    { label: 'Thường trú',  value: stats.thuongTru, icon: CheckCircle,    iconColor: '#16a34a' },
    { label: 'Tạm trú',     value: stats.tamTru,    icon: Users,          iconColor: '#d97706' },
    { label: 'Tạm vắng',   value: stats.tamVang,   icon: ArrowRightLeft, iconColor: '#7c3aed' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý hộ dân"
        subtitle="Danh sách hộ khẩu — UBND Xã Hòa Tiến"
        action={
          <div className="flex items-center gap-2">
            <SecondaryBtn><Filter size={14} /> Lọc</SecondaryBtn>
            <PrimaryBtn><Plus size={14} /> Thêm hộ dân</PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <Tabs
            tabs={['Tất cả', 'Thường trú', 'Tạm trú', 'Tạm vắng']}
            active={tab}
            onChange={handleTabChange}
          />
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder="Tìm số HK, địa chỉ..."
            />
          </div>
        </div>

        <DataTable columns={COLUMNS} empty={!loading && households.length === 0}>
          {loading ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-5 py-16 text-center text-sm text-muted-foreground">
                Đang tải...
              </td>
            </tr>
          ) : (
            households.map(h => {
              const loai = LOAI_HO_LABEL[h.loaiHo] || { label: h.loaiHo, variant: 'default' }
              const tt = TRANG_THAI_LABEL[h.trangThai] || { label: h.trangThai, variant: 'default' }
              return (
                <tr key={h.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{h.soHoKhau}</td>
                  <td className="px-5 py-3 text-sm text-foreground max-w-[200px] truncate">{h.diaChi}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{h.village?.ten ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={loai.variant}>{loai.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{h.members?.length ?? 0} người</td>
                  <td className="px-5 py-3">
                    <Badge variant={tt.variant}>{tt.label}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors" title="Xem chi tiết">
                        <Eye size={13} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors" title="Chỉnh sửa">
                        <Pencil size={13} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors" title="Xóa">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </DataTable>

        <div className="table-footer">
          <span className="table-count">
            Hiển thị {households.length} / {pagination.total} hộ dân
          </span>
          <div className="flex gap-1">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >‹</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'page-btn-active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            })}
            <button
              className="page-btn"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
