import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Landing from './pages/Landing';
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Registration from './pages/Registration';
import MFAsetupForm from './pages/MFAsetupForm';
import MFAverifyForm from './pages/MFAverifyForm';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

// Contexts
import AuthProvider from './utils/AuthContext';
import CreditProvider from './utils/CreditContext';

/** Wrap content in sidebar + topbar layout (accessible to all users) */
const WithLayout = ({ children }) => (
  <DashboardLayout>{children}</DashboardLayout>
);

function App() {
  return (
    <AuthProvider>
      <CreditProvider>
        <Router>
          <Routes>
            {/* ─── Public Landing ─── */}
            <Route path="/" element={<Landing />} />

            {/* ─── Auth Routes (no layout) ─── */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/setup-mfa" element={<MFAsetupForm />} />
            <Route path="/verify-mfa" element={<MFAverifyForm />} />

            {/* ─── App Routes (with layout, accessible by all users) ─── */}
            <Route path="/home" element={<WithLayout><Home /></WithLayout>} />
            <Route path="/pricing" element={<WithLayout><Pricing /></WithLayout>} />
            <Route path="/settings" element={<WithLayout><Settings /></WithLayout>} />
            <Route path="/profile/:userId" element={<WithLayout><Profile /></WithLayout>} />

            {/* ─── Redirect old routes ─── */}
            <Route path="/extract" element={<Navigate to="/home" replace />} />
            <Route path="/extraction-hub" element={<Navigate to="/home" replace />} />
            <Route path="/report-sections" element={<Navigate to="/home" replace />} />
            <Route path="/report-sections/:sectionKey" element={<Navigate to="/home" replace />} />
          </Routes>
        </Router>
      </CreditProvider>
    </AuthProvider>
  );
}

export default App;
