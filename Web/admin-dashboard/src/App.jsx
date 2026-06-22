import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import HoSo from './pages/HoSo'
import TinTuc from './pages/TinTuc'
import VanBan from './pages/VanBan'
import PhanAnh from './pages/PhanAnh'
import PhanAnhDetail from './pages/PhanAnhDetail'
import NhanSu from './pages/NhanSu'
import BaoCao from './pages/BaoCao'
import CaiDat from './pages/CaiDat'
import ThonXom from './pages/ThonXom'
import BienDong from './pages/BienDong'
import MessagesPage from './pages/MessagesPage'
import SettingsPage from './pages/SettingsPage'
import SurveyFill from './pages/SurveyFill'
import KhaoSat from './pages/KhaoSat'
import BaoCaoThongBao from './pages/BaoCaoThongBao'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/ks/:id" element={<SurveyFill />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="ho-so"    element={<HoSo />} />
        <Route path="thon-xom" element={<ThonXom />} />
        <Route path="bien-dong" element={<BienDong />} />
        <Route path="tin-tuc"  element={<TinTuc />} />
        <Route path="van-ban"  element={<VanBan />} />
        <Route path="phan-anh" element={<PhanAnh />} />
        <Route path="phan-anh/:id" element={<PhanAnhDetail />} />
        <Route path="nhan-su"  element={<NhanSu />} />
        <Route path="bao-cao"  element={<BaoCao />} />
        <Route path="cai-dat"  element={<CaiDat />} />
        <Route path="thong-bao"      element={<MessagesPage />} />
        <Route path="nhom-zalo"      element={<SettingsPage />} />
        <Route path="nguoi-nhan"     element={<Navigate to="/thong-bao" replace />} />
        <Route path="khao-sat"       element={<KhaoSat />} />
        <Route path="bao-cao-tb"     element={<BaoCaoThongBao />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
