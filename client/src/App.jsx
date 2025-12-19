import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerView from './pages/PassengerView';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from 'react-hot-toast';

// Route Guard component to handle role-based access
const PrivateRoute = ({ children, role }) => {
  const userStr = sessionStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  // Enforce role-based access control
  if (role && user.role.toUpperCase() !== role.toUpperCase()) {
    return <Navigate to="/passenger" replace />;
  }

  return children;
};

function App() {
  return (
    // Updated background for a cleaner, more professional feel
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 font-sans">
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
      <Toaster position="top-center" toastOptions={{
        style: {
          background: '#334155',
          color: '#fff',
        },
      }}/>
    </div>
  );
}

export default App;