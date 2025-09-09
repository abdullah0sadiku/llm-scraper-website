import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useWebSocket } from './services/websocket';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateJob from './pages/CreateJob';
import JobDetail from './pages/JobDetail';
import JobsList from './pages/JobsList';
import NotFound from './pages/NotFound';

function App() {
  const { connect, disconnect } = useWebSocket();

  useEffect(() => {
    // Connect to WebSocket on app start
    connect().catch(console.error);

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs" element={<JobsList />} />
        <Route path="/jobs/new" element={<CreateJob />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
