import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({ 
    name: '', 
    username: '', 
    email: '', 
    password: '', 
    role: 'PASSENGER' 
  });
  
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/auth/register', formData);
      toast.success("Account created! Please login.");
      navigate('/');
    } catch (err) {
      // Improved error handling to show the backend message (e.g., "Username taken")
      const message = err.response?.data?.error || "Registration Failed";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-900">Register</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Full Name Input */}
          <input 
            placeholder="Full Name" 
            className="w-full border p-2 rounded"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />

          {/* Username Input */}
          <input 
            type="text" 
            placeholder="Username (e.g. pilot123)" 
            className="w-full border p-2 rounded"
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})} 
            required 
          />

          {/* Email Input */}
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full border p-2 rounded"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})} 
            required 
          />

          {/* Password Input */}
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full border p-2 rounded"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})} 
            required 
          />

          {/* Role Selection */}
          <select 
            className="w-full border p-2 rounded"
            value={formData.role}
            onChange={e => setFormData({...formData, role: e.target.value})}
          >
            <option value="PASSENGER">Passenger</option>
            <option value="ADMIN">Airport Staff (Admin)</option>
          </select>

          <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold">
            Create Account
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account? <Link to="/" className="text-blue-600">Login</Link>
        </p>
      </div>
    </div>
  );
}