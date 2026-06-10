import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import LoginPage from './pages/LoginPage';
import PubPage from './pages/PubPage';
import BoardroomPage from './pages/BoardroomPage';
import NotFound from './pages/NotFound';
import CoordinateEditor from './pages/CoordinateEditor';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pub" element={<PubPage />} />
            <Route path="/boardroom" element={<BoardroomPage />} />
            <Route path="/404" element={<NotFound />} />
            {import.meta.env.DEV && (
              <Route path="/dev/coordinate-editor" element={<CoordinateEditor />} />
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
