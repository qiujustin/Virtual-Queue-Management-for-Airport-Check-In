import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerView from './pages/PassengerView';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from 'react-hot-toast';

// Simple Route Guard
const PrivateRoute = ({ children, role }) => {
  // FIX: Read from sessionStorage (matches Login.jsx)
  const userStr = sessionStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  // Role Check (Case Insensitive)
  if (role && user.role.toUpperCase() !== role.toUpperCase()) {
    // If passenger tries to access admin, send them to passenger view
    return <Navigate to="/passenger" replace />;
  }

  return children;
};

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route path="/passenger" element={
            <PrivateRoute>
              <PassengerView />
            </PrivateRoute>
          } />
          
          <Route path="/admin" element={
            <PrivateRoute role="ADMIN">
              <AdminDashboard />
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </div>
  );
}

export default App;