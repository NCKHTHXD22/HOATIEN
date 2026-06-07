import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import Dashboard from './pages/Dashboard'
import HoSo from './pages/HoSo'
import TinTuc from './pages/TinTuc'
import VanBan from './pages/VanBan'
import PhanAnh from './pages/PhanAnh'
import NhanSu from './pages/NhanSu'
import BaoCao from './pages/BaoCao'
import CaiDat from './pages/CaiDat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ho-so"    element={<HoSo />} />
          <Route path="tin-tuc"  element={<TinTuc />} />
          <Route path="van-ban"  element={<VanBan />} />
          <Route path="phan-anh" element={<PhanAnh />} />
          <Route path="nhan-su"  element={<NhanSu />} />
          <Route path="bao-cao"  element={<BaoCao />} />
          <Route path="cai-dat"  element={<CaiDat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
