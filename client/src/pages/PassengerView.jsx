import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

export default function PassengerView() {
  const [flights, setFlights] = useState([]);
  const [myQueue, setMyQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [ticketClass, setTicketClass] = useState("ECONOMY");
  const [isSpecialNeeds, setIsSpecialNeeds] = useState(false);

  const navigate = useNavigate();
  const getToken = () => sessionStorage.getItem('token');

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    toast.success("Signed out successfully");
    navigate('/login');
  };

  const fetchData = useCallback(async () => {
    try {
      const flightRes = await axios.get('http://localhost:3001/api/flights');
      setFlights(flightRes.data);

      const token = getToken();
      if (token) {
        const queueRes = await axios.get('http://localhost:3001/api/queue/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMyQueue(queueRes.data.entry);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    socket.on('queue_update', () => fetchData());
    
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      socket.on(`passenger:${user.id}`, (data) => {
        if (data.type === 'CALLED') {
          toast.success(`📢 Attention: Please proceed to ${data.counter}`, {
            duration: 8000,
            style: { background: '#0ea5e9', color: '#fff', fontWeight: 'bold', fontSize: '16px' },
          });
          if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
          fetchData(); 
        }
      });
    }

    return () => {
      socket.off('queue_update');
      if (userStr) {
        const user = JSON.parse(userStr);
        socket.off(`passenger:${user.id}`);
      }
    };
  }, [fetchData]);

  const handleJoinQueue = async (flightId) => {
    const token = getToken();
    if (!token) {
      toast.error("Session expired. Please log in.");
      navigate('/login');
      return;
    }

    try {
      const res = await axios.post('http://localhost:3001/api/queue/join', { 
        flightId, ticketClass, isSpecialNeeds 
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.success) {
        toast.success("Check-In Confirmed. You are now in queue.");
        fetchData(); 
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join queue");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sky-600 font-bold text-xl animate-pulse">Loading Terminal Data...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border-b-4 border-sky-600">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 uppercase tracking-wide">Airport Self-Service Kiosk</h1>
            <p className="text-slate-500 text-sm">Welcome, Passenger</p>
          </div>
          <button onClick={handleLogout} className="mt-4 md:mt-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-bold text-sm transition border border-slate-300">Sign Out</button>
        </div>

        {/* Ticket Configuration Section - Only show if not in queue */}
        {!myQueue && (
          <div className="bg-white p-8 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">1. Configure Your Check-In</h2>
            
            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Select Ticket Class</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['ECONOMY', 'BUSINESS', 'FIRST'].map((cls) => (
                  <div 
                    key={cls}
                    onClick={() => setTicketClass(cls)}
                    className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${
                      ticketClass === cls 
                      ? 'border-sky-600 bg-sky-50 shadow-md' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`font-black text-lg mb-1 ${ticketClass === cls ? 'text-sky-700' : 'text-slate-700'}`}>{cls} Class</div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                      {cls === 'FIRST' ? 'Highest Priority' : cls === 'BUSINESS' ? 'High Priority' : 'Standard Priority'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
              
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Additional Services</label>
              <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-all ${
                isSpecialNeeds ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-amber-600"
                  checked={isSpecialNeeds}
                  onChange={(e) => setIsSpecialNeeds(e.target.checked)}
                />
                <div>
                  <span className="text-base font-bold text-slate-800 block">Request Special Assistance</span>
                  <span className="text-xs text-slate-500">For passengers requiring mobility aid or elderly assistance.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Live Status Card */}
        {myQueue && (
          <div className={`rounded-2xl shadow-xl overflow-hidden text-white transform transition-all ${
            myQueue.status === 'CALLED' ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-sky-600 to-blue-700'
          }`}>
            <div className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                   <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Current Status</h2>
                  <h2 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                    {myQueue.status === 'CALLED' ? "PROCEED TO COUNTER" : "Awaiting Call"}
                  </h2>
                  <p className="text-xl opacity-90 font-medium">Flight {myQueue.flight?.flightCode || "..."} to {myQueue.flight?.destination}</p>
                  <div className="mt-6 inline-flex flex-wrap gap-3 justify-center md:justify-start">
                    <span className="bg-white/25 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide border border-white/30">{myQueue.ticketClass} Class</span>
                    {myQueue.isSpecialNeeds && <span className="bg-white/25 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide border border-white/30 flex items-center">♿ Special Assist</span>}
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20 min-w-[220px] text-center">
                  {myQueue.status === 'CALLED' ? (
                     <>
                      <div className="text-sm uppercase tracking-wider opacity-90 mb-2 font-bold">Assigned Counter</div>
                       <div className="text-6xl font-black animate-pulse">{myQueue.assignedCounter}</div>
                     </>
                  ) : (
                    <>
                      <div className="text-sm uppercase tracking-wider opacity-90 mb-2 font-bold">Queue Position</div>
                      <div className="text-6xl font-black">#{myQueue.position}</div>
                      <div className="mt-4 text-base font-bold bg-black/20 py-2 px-4 rounded-lg inline-block">
                        Est. Wait: {myQueue.estimatedWaitTime} min{myQueue.estimatedWaitTime !== 1 && 's'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flight Selection Header */}
        {!myQueue && <h2 className="text-xl font-bold text-slate-800 pb-2 border-b border-slate-100">2. Select Departure Flight</h2>}
        
        {/* Flight List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {flights.map(flight => {
             const departureDate = new Date(flight.departureTime);
             return (
            <div key={flight.id} className={`bg-white p-6 rounded-xl shadow-sm border transition group ${myQueue ? 'border-slate-100 opacity-75' : 'border-slate-200 hover:shadow-md hover:border-sky-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-3xl font-black text-slate-800 group-hover:text-sky-700 transition">{flight.flightCode}</div>
                  <div className="text-slate-500 font-bold uppercase tracking-wide text-sm mt-1">Destination: <span className="text-slate-800">{flight.destination}</span></div>
                </div>
                <div className="text-right">
                  <div className="bg-slate-100 text-slate-700 text-lg px-4 py-2 rounded-lg font-bold border border-slate-200 group-hover:bg-sky-50 group-hover:text-sky-800 group-hover:border-sky-200 transition">
                    {departureDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                   <div className="text-xs text-slate-400 mt-2 font-medium uppercase tracking-wider">Departure Time</div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-dashed border-slate-200">
                <button
                  onClick={() => handleJoinQueue(flight.id)}
                  disabled={!!myQueue} 
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition flex items-center justify-center gap-3 uppercase tracking-wide
                    ${myQueue 
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                      : 'bg-sky-600 text-white hover:bg-sky-700 shadow-md hover:shadow-lg active:scale-[0.98]'
                    }`}
                >
                  {myQueue ? "Check-In Unavailable (Already Queued)" : "Confirm Check-In & Join Queue"}
                </button>
              </div>
            </div>
          )})}
        </div>
        {flights.length === 0 && !loading && (
            <div className="text-center p-8 bg-white rounded-xl shadow-sm text-slate-500 font-medium">No departing flights currently scheduled.</div>
        )}
      </div>
    </div>
  );
}