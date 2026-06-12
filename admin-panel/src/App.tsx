import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/Layout';

import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import ActivitiesPage from './pages/Activities';
import SalonConfigPage from './pages/SalonConfig';
import ReferralCodesPage from './pages/ReferralCodes';
import StationsPage from './pages/Stations';
import PartnersPage from './pages/Partners';
import WithdrawalsPage from './pages/Withdrawals';
import ScoreRulesPage from './pages/ScoreRules';
import PremiumVerifyPage from './pages/PremiumVerify';
import CommissionsPage from './pages/Commissions';
import ArchivesPage from './pages/Archives';
import OrdersPage from './pages/Orders';
import FundCustodyPage from './pages/FundCustody';
import SystemSettingsPage from './pages/SystemSettings';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter basename="/admin">
        <Routes>
          {/* 登录页 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 受保护的路由 */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/users"
            element={
              <PrivateRoute>
                <AppLayout>
                  <UsersPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/referral-codes"
            element={
              <PrivateRoute>
                <AppLayout>
                  <ReferralCodesPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/activities"
            element={
              <PrivateRoute>
                <AppLayout>
                  <ActivitiesPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/salon-config"
            element={
              <PrivateRoute>
                <AppLayout>
                  <SalonConfigPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/stations"
            element={
              <PrivateRoute>
                <AppLayout>
                  <StationsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/partners"
            element={
              <PrivateRoute>
                <AppLayout>
                  <PartnersPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/withdrawals"
            element={
              <PrivateRoute>
                <AppLayout>
                  <WithdrawalsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/score-rules"
            element={
              <PrivateRoute>
                <AppLayout>
                  <ScoreRulesPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/premium-verify"
            element={
              <PrivateRoute>
                <AppLayout>
                  <PremiumVerifyPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/commissions"
            element={
              <PrivateRoute>
                <AppLayout>
                  <CommissionsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/archives"
            element={
              <PrivateRoute>
                <AppLayout>
                  <ArchivesPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <AppLayout>
                  <OrdersPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/fund-custody"
            element={
              <PrivateRoute>
                <AppLayout>
                  <FundCustodyPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/system-settings"
            element={
              <PrivateRoute>
                <AppLayout>
                  <SystemSettingsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
