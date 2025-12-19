import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '', name: '' });
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/auth/register', formData);
      
      sessionStorage.setItem('token', res.data.token);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast.success("Account Created Successfully");
      navigate('/passenger');
      
    } catch (err) {
      console.error("REGISTRATION ERROR:", err);
      toast.error(err.response?.data?.error || "Registration Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-sky-800 via-slate-800 to-sky-900 p-4">
      <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-sky-600">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800">Passenger Registration</h1>
          <p className="text-slate-500 text-sm mt-2">Create your digital profile to begin</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Legal Name</label>
            <input name="name" type="text" className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="e.g. John Smith" onChange={handleChange} required />
          </div>
           <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Username Identifier</label>
            <input name="username" type="text" className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Unique username" onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
            <input name="email" type="email" className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="john@example.com" onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input name="password" type="password" className="w-full border border-slate-300 bg-slate-50 px-4 py-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Strong password" onChange={handleChange} required />
          </div>
          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-lg font-bold text-lg transition shadow-lg hover:shadow-xl active:scale-[0.98] mt-4">
            Create Passenger Account
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
          Already registered? <Link to="/login" className="text-sky-600 font-bold hover:underline">Return to Login</Link>
        </div>
      </div>
    </div>
  );
}