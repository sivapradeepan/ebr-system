import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, Result, Button } from 'antd';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import AuditTrail from './pages/AuditTrail';
import MBRList from './pages/mbr/MBRList';
import MBRForm from './pages/mbr/MBRForm';
import MBRDetail from './pages/mbr/MBRDetail';
import EBRList from './pages/ebr/EBRList';
import EBRCreate from './pages/ebr/EBRCreate';
import EBRExecution from './pages/ebr/EBRExecution';
import EquipmentList from './pages/equipment/EquipmentList';
import EquipmentForm from './pages/equipment/EquipmentForm';
import MaterialList from './pages/material/MaterialList';
import MaterialForm from './pages/material/MaterialForm';
import QualityDashboard from './pages/quality/QualityDashboard';
import Analytics from './pages/Analytics';
import Schedule from './pages/schedule/Schedule';
import ScheduleForm from './pages/schedule/ScheduleForm';
import TrainingList from './pages/training/TrainingList';
import TrainingForm from './pages/training/TrainingForm';
import DeviationDetail from './pages/quality/DeviationDetail';
import DeviationForm from './pages/quality/DeviationForm';
import CAPADetail from './pages/quality/CAPADetail';
import CAPAForm from './pages/quality/CAPAForm';
import IDOCInterface from './pages/integration/IDOCInterface';
import OPCInterface from './pages/integration/OPCInterface';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Forbidden() {
  return (
    <Result
      status="403"
      title="Access Denied"
      subTitle="You don't have permission to access this page."
      extra={<Button type="primary" onClick={() => history.back()}>Go Back</Button>}
    />
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <Result
      title={`${name}`}
      subTitle="This module will be available in the next phase. Stay tuned!"
      extra={<Button onClick={() => history.back()}>Back to Dashboard</Button>}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/403" element={<Forbidden />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<ProtectedRoute permission="users:read"><Users /></ProtectedRoute>} />
              <Route path="roles" element={<ProtectedRoute permission="roles:read"><Roles /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute permission="audit:read"><AuditTrail /></ProtectedRoute>} />
              <Route path="mbr" element={<ProtectedRoute permission="mbr:read"><MBRList /></ProtectedRoute>} />
              <Route path="mbr/new" element={<ProtectedRoute permission="mbr:create"><MBRForm /></ProtectedRoute>} />
              <Route path="mbr/:id" element={<ProtectedRoute permission="mbr:read"><MBRDetail /></ProtectedRoute>} />
              <Route path="mbr/:id/edit" element={<ProtectedRoute permission="mbr:update"><MBRForm /></ProtectedRoute>} />
              <Route path="ebr" element={<ProtectedRoute permission="ebr:read"><EBRList /></ProtectedRoute>} />
              <Route path="ebr/new" element={<ProtectedRoute permission="ebr:create"><EBRCreate /></ProtectedRoute>} />
              <Route path="ebr/:id" element={<ProtectedRoute permission="ebr:read"><EBRExecution /></ProtectedRoute>} />
              <Route path="ebr/:id/execute" element={<ProtectedRoute permission="ebr:execute"><EBRExecution /></ProtectedRoute>} />
              <Route path="equipment" element={<ProtectedRoute permission="equipment:read"><EquipmentList /></ProtectedRoute>} />
              <Route path="equipment/new" element={<ProtectedRoute permission="equipment:manage"><EquipmentForm /></ProtectedRoute>} />
              <Route path="equipment/:id/edit" element={<ProtectedRoute permission="equipment:manage"><EquipmentForm /></ProtectedRoute>} />
              <Route path="materials" element={<ProtectedRoute permission="materials:read"><MaterialList /></ProtectedRoute>} />
              <Route path="materials/new" element={<ProtectedRoute permission="materials:manage"><MaterialForm /></ProtectedRoute>} />
              <Route path="materials/:id/edit" element={<ProtectedRoute permission="materials:manage"><MaterialForm /></ProtectedRoute>} />
              <Route path="quality" element={<ProtectedRoute permission="quality:read"><QualityDashboard /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="schedule" element={<ProtectedRoute permission="ebr:read"><Schedule /></ProtectedRoute>} />
              <Route path="schedule/new" element={<ProtectedRoute permission="ebr:create"><ScheduleForm /></ProtectedRoute>} />
              <Route path="schedule/:id/edit" element={<ProtectedRoute permission="ebr:create"><ScheduleForm /></ProtectedRoute>} />
              <Route path="training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
              <Route path="training/new" element={<ProtectedRoute><TrainingForm /></ProtectedRoute>} />
              <Route path="training/:id/edit" element={<ProtectedRoute><TrainingForm /></ProtectedRoute>} />
              <Route path="quality/deviations/new" element={<ProtectedRoute permission="quality:manage"><DeviationForm /></ProtectedRoute>} />
              <Route path="quality/deviations/:id" element={<ProtectedRoute permission="quality:read"><DeviationDetail /></ProtectedRoute>} />
              <Route path="quality/capas/new" element={<ProtectedRoute permission="quality:manage"><CAPAForm /></ProtectedRoute>} />
              <Route path="quality/capas/:id" element={<ProtectedRoute permission="quality:read"><CAPADetail /></ProtectedRoute>} />
              <Route path="integration/idoc" element={<ProtectedRoute permission="integration:read"><IDOCInterface /></ProtectedRoute>} />
              <Route path="integration/opc" element={<ProtectedRoute permission="integration:read"><OPCInterface /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
