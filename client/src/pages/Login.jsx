import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/auth/login', { email, password });
      
      sessionStorage.setItem('token', res.data.token);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast.success(`Welcome, ${res.data.user.name}`);
      
      const userRole = res.data.user.role;
      if (userRole && userRole.toUpperCase() === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/passenger');
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      toast.error(err.response?.data?.error || "Authentication Failed");
    }
  };

  return (
    // Enhanced background with a professional blue gradient theme
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-sky-800 via-slate-800 to-sky-900 p-4">
      <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-sky-600">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800">Airport Services</h1>
          <p className="text-slate-500 text-sm mt-2">Virtual Queue Management Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Credential ID (Email or Username)</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
              placeholder="Enter your identifier"
              value={email} onChange={e => setEmail(e.target.value)} required 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
            <input 
              type="password" 
              className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required 
            />
          </div>
          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-lg font-bold text-lg transition shadow-lg hover:shadow-xl active:scale-[0.98]">
            Secure Login
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
          Need credentials? <Link to="/register" className="text-sky-600 font-bold hover:underline">Register New Passenger Account</Link>
        </div>
      </div>
    </div>
  );
}