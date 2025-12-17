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
      
      // Save Token & User Info
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast.success(`Welcome back, ${res.data.user.name}`);
      
      // Redirect based on Role
      if (res.data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/passenger');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Login Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-900">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" placeholder="Email" className="w-full border p-2 rounded"
            value={email} onChange={e => setEmail(e.target.value)} required 
          />
          <input 
            type="password" placeholder="Password" className="w-full border p-2 rounded"
            value={password} onChange={e => setPassword(e.target.value)} required 
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded font-bold">Login</button>
        </form>
        <p className="mt-4 text-center text-sm">
          No account? <Link to="/register" className="text-blue-600">Register</Link>
        </p>
      </div>
    </div>
  );
}