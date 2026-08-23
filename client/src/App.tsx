import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute, RoleProtectedRoute } from './components/ProtectedRoute';

const HomePage = lazy(() => import('./pages/HomePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const lazyNamed = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) => lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })));
const AuthPages = {
  ForgotPasswordPage: lazyNamed(() => import('./pages/AuthPages'), 'ForgotPasswordPage'),
  LoginPage: lazyNamed(() => import('./pages/AuthPages'), 'LoginPage'),
  RegisterPage: lazyNamed(() => import('./pages/AuthPages'), 'RegisterPage'),
  ResetPasswordPage: lazyNamed(() => import('./pages/AuthPages'), 'ResetPasswordPage'),
  VerifyEmailPage: lazyNamed(() => import('./pages/AuthPages'), 'VerifyEmailPage'),
};
const ProfilePages = {
  EditProfilePage: lazyNamed(() => import('./pages/ProfilePages'), 'EditProfilePage'),
  ProfilePage: lazyNamed(() => import('./pages/ProfilePages'), 'ProfilePage'),
  PublicProfilePage: lazyNamed(() => import('./pages/ProfilePages'), 'PublicProfilePage'),
};
const AdminPages = {
  AdminCategoriesPage: lazyNamed(() => import('./pages/AdminPages'), 'AdminCategoriesPage'),
  AdminDashboardPage: lazyNamed(() => import('./pages/AdminPages'), 'AdminDashboardPage'),
  AdminSkillsPage: lazyNamed(() => import('./pages/AdminPages'), 'AdminSkillsPage'),
  AdminUsersPage: lazyNamed(() => import('./pages/AdminPages'), 'AdminUsersPage'),
  ReportsPage: lazyNamed(() => import('./pages/AdminPages'), 'ReportsPage'),
};

function App() {
  return <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthPages.LoginPage />} />
      <Route path="/register" element={<AuthPages.RegisterPage />} />
      <Route path="/forgot-password" element={<AuthPages.ForgotPasswordPage />} />
      <Route path="/reset-password" element={<AuthPages.ResetPasswordPage />} />
      <Route path="/verify-email" element={<AuthPages.VerifyEmailPage />} />
      <Route path="/browse" element={<WorkspacePage />} />
      <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
        {['/dashboard', '/skills', '/settings'].map((path) => <Route key={path} path={path} element={<WorkspacePage />} />)}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/profile" element={<ProfilePages.ProfilePage />} />
        <Route path="/profile/edit" element={<ProfilePages.EditProfilePage />} />
        <Route path="/users/:id" element={<ProfilePages.PublicProfilePage />} />
        <Route element={<RoleProtectedRoute roles={['ADMIN', 'MODERATOR']} />}>
          <Route element={<RoleProtectedRoute roles={['ADMIN']} />}><Route path="/admin" element={<AdminPages.AdminDashboardPage />} /></Route>
          <Route path="/admin/reports" element={<AdminPages.ReportsPage />} />
          <Route path="/admin/users" element={<AdminPages.AdminUsersPage />} />
          <Route path="/admin/skills" element={<AdminPages.AdminSkillsPage />} />
          <Route path="/admin/categories" element={<AdminPages.AdminCategoriesPage />} />
        </Route>
      </Route></Route>
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>;
}

export default App;
