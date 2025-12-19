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
  const navigate = useNavigate();

  const getToken = () => sessionStorage.getItem('token');

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    toast.success("Logged out");
    navigate('/login');
  };

  // Wrapped in useCallback so it can be safely used in useEffect dependencies
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
  }, []); // Empty dependency array as it doesn't rely on changing state

  useEffect(() => {
    fetchData();

    // Socket Listener for General Updates
    socket.on('queue_update', () => {
      console.log("Queue updated event received");
      fetchData();
    });

    // Socket Listener for Personal Notifications
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      socket.on(`passenger:${user.id}`, (data) => {
        if (data.type === 'CALLED') {
          toast.success(`📢 ${data.message}`, {
            duration: 6000,
            icon: '🏃‍♂️',
            style: { background: '#4ade80', color: '#fff', fontWeight: 'bold' },
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          fetchData(); // Refresh immediately upon being called
        }
      });
    }

    return () => {
      socket.off('queue_update');
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        socket.off(`passenger:${user.id}`);
      }
    };
  }, [fetchData]);

  const handleJoinQueue = async (flightId) => {
    const token = getToken();
    if (!token) {
      toast.error("Please login to join a queue");
      navigate('/login');
      return;
    }

    try {
      const payload = { flightId, ticketClass: "ECONOMY", isSpecialNeeds: false };
      const res = await axios.post('http://localhost:3001/api/queue/join', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success("Joined Queue Successfully!");
        fetchData(); // Trigger immediate refresh
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join queue");
    }
  };

  if (loading) return <div className="text-center mt-10">Loading Flight Deck...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800">✈️ Available Flights</h1>
          <div className="flex items-center gap-4">
            {myQueue && <div className="hidden md:block bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold animate-pulse text-sm">Queue Active</div>}
            <button onClick={handleLogout} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold text-sm transition">Logout</button>
          </div>
        </div>

        {myQueue && (
          <div className="bg-indigo-600 text-white p-8 rounded-2xl shadow-xl transform transition-all">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  {myQueue.status === 'CALLED' ? "PROCEED TO COUNTER" : "You are in line"}
                </h2>
                <p className="opacity-90 text-lg">Flight: {myQueue.flight?.flightCode || "Loading..."}</p>
              </div>
              <div className="bg-white/20 p-6 rounded-xl backdrop-blur-sm min-w-[200px]">
                <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Your Position</div>
                <div className="text-5xl font-black">
                  {myQueue.status === 'CALLED' ? "NOW" : `#${myQueue.position}`}
                </div>
                {myQueue.status !== 'CALLED' && (
                  <div className="mt-2 text-sm font-medium bg-white/10 py-1 px-2 rounded">Est. Wait: {myQueue.estimatedWaitTime} mins</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {flights.map(flight => (
            <div key={flight.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{flight.flightCode}</h2>
                  <p className="text-slate-500 font-medium">To: {flight.destination}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">
                  {new Date(flight.departureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleJoinQueue(flight.id)}
                  disabled={!!myQueue} 
                  className={`w-full py-3 px-4 rounded-lg font-bold transition flex items-center justify-center gap-2
                    ${myQueue ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'}`}
                >
                  {myQueue ? "Checked In / In Queue" : "Check-In & Join Queue"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}