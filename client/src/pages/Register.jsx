import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({ 
    name: '', 
    username: '', 
    email: '', 
    password: ''
  });
  
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/auth/register', formData);
      toast.success("Account created successfully! Please login.");
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.error || "Registration Failed";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <h1 className="text-3xl font-bold mb-6 text-center text-slate-800">Register</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-slate-600">Full Name</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600">Username</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})} 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600">Email</label>
            <input 
              type="email" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})} 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600">Password</label>
            <input 
              type="password" 
              className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})} 
              required 
            />
          </div>

          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold transition shadow-md mt-4">
            Create Account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}