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
    console.log("1. Form submitted, preventing default reload.");

    try {
      console.log("2. Sending request to server...");
      const res = await axios.post('http://localhost:3001/api/auth/login', { email, password });
      
      console.log("3. Server response received:", res.data);

      // Save Token & User Info (Using sessionStorage as per previous fix)
      sessionStorage.setItem('token', res.data.token);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      console.log("4. Token saved to Storage.");
      
      toast.success(`Welcome back, ${res.data.user.name}`);
      
      const userRole = res.data.user.role;
      console.log("5. User Role identified as:", userRole);

      // Redirect based on Role (Case Insensitive Check)
      if (userRole && userRole.toUpperCase() === 'ADMIN') {
        console.log("6. Attempting navigation to /admin");
        navigate('/admin');
      } else {
        console.log("6. Attempting navigation to /passenger");
        navigate('/passenger');
      }

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      toast.error(err.response?.data?.error || "Login Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <h1 className="text-3xl font-bold mb-6 text-center text-slate-800">Login</h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email or Username</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition"
              value={email} onChange={e => setEmail(e.target.value)} required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition"
              value={password} onChange={e => setPassword(e.target.value)} required 
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition shadow-md">
            Sign In
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          New passenger? <Link to="/register" className="text-indigo-600 font-bold hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
}