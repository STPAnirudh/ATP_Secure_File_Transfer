import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { TransfersPage } from './pages/TransfersPage';
import { SendPage } from './pages/SendPage';
import { ReceivedPage } from './pages/ReceivedPage';
import { ActivityPage } from './pages/ActivityPage';
import { SecurityPage } from './pages/SecurityPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page inspired closely by Agnos */}
        <Route path="/" element={<LandingPage />} />

        {/* Authenticated Application Shell Routes */}
        <Route path="/app" element={<OverviewPage />} />
        <Route path="/app/transfers" element={<TransfersPage />} />
        <Route path="/app/send" element={<SendPage />} />
        <Route path="/app/received" element={<ReceivedPage />} />
        <Route path="/app/activity" element={<ActivityPage />} />
        <Route path="/app/security" element={<SecurityPage />} />
        <Route path="/app/settings" element={<SettingsPage />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
