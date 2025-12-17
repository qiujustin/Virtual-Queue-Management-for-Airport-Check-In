import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import toast from 'react-hot-toast';

const socket = io('http://localhost:3001');

export default function PassengerView() {
  const [step, setStep] = useState('LOADING'); 
  const [flights, setFlights] = useState([]);
  const [queueData, setQueueData] = useState(null);
  
  // Get User from Login Session (LocalStorage)
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  const userName = user?.name;

  const [formData, setFormData] = useState({
    userId: userId, 
    flightId: '',
    ticketClass: 'ECONOMY',
    isSpecialNeeds: false
  });

  // 1. Initial Load: Check if user is ALREADY in a queue (Session Restore)
  useEffect(() => {
    if (!userId) {
       setStep('FLIGHT_SELECT'); // Should be redirected by Router, but safe fallback
       return; 
    }

    const checkActiveSession = async () => {
      try {
        // Fetch flights first
        const flightsRes = await axios.get('http://localhost:3001/api/flights');
        setFlights(flightsRes.data);
        if(flightsRes.data.length > 0) {
          setFormData(prev => ({ ...prev, flightId: flightsRes.data[0].id }));
        }

        // Ask Server: "Am I already in a line?"
        const myEntryRes = await axios.get(`http://localhost:3001/api/queue/active/${userId}`);
        
        if (myEntryRes.data.entry) {
          setQueueData(myEntryRes.data.entry);
          setStep('WAITING');
          toast.success(`Welcome back, ${userName}! Session Restored.`);
        } else {
          setStep('FLIGHT_SELECT');
        }
      } catch (err) {
        setStep('FLIGHT_SELECT');
      }
    };
    checkActiveSession();
  }, [userId, userName]);

  // 2. Real-time Listeners (Position Updates & Alerts)
  useEffect(() => {
    if (!userId) return;

    // A. Personal "My Turn" Alert
    socket.on(`passenger:${userId}`, (data) => {
      if (data.type === 'CALLED') {
        toast.success(data.message, { duration: Infinity }); // Keep toast open
        setQueueData(prev => ({ ...prev, status: 'CALLED', counter: data.counter }));
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
      }
    });

    // B. Queue Movement Updates (Refresh Position)
    if (step === 'WAITING' && queueData?.flightId) {
      socket.on(`flight:${queueData.flightId}:update`, () => {
        fetchStatus(queueData.id);
      });
    }

    return () => {
      socket.off(`passenger:${userId}`);
      if (queueData?.flightId) socket.off(`flight:${queueData.flightId}:update`);
    };
  }, [userId, step, queueData]);

  // Helper to refresh position data
  const fetchStatus = async (id) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/queue/status/${id}`);
      setQueueData(res.data);
    } catch (err) { console.error(err); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/queue/join', formData);
      setQueueData(res.data.entry);
      setStep('WAITING');
      toast.success("Joined Queue!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join");
    }
  };

  if (step === 'LOADING') return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-md mx-auto p-4 pt-10">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-blue-900">✈️ Virtual Queue</h1>
        <p className="text-sm text-gray-500">Logged in as {userName}</p>
      </div>
      
      {step === 'FLIGHT_SELECT' && (
        <form onSubmit={handleJoin} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Flight</label>
            <select 
              className="w-full border rounded p-2"
              value={formData.flightId}
              onChange={e => setFormData({...formData, flightId: e.target.value})}
            >
              {flights.map(f => (
                <option key={f.id} value={f.id}>{f.flightCode} to {f.destination}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ticket Class</label>
            <select 
              className="w-full border rounded p-2"
              value={formData.ticketClass}
              onChange={e => setFormData({...formData, ticketClass: e.target.value})}
            >
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First Class</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox"
              checked={formData.isSpecialNeeds}
              onChange={e => setFormData({...formData, isSpecialNeeds: e.target.checked})}
            />
            <label> I require Special Assistance</label>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold">
            Check In & Join Queue
          </button>
        </form>
      )}

      {step === 'WAITING' && queueData && (
        <div className="bg-white p-8 rounded-lg shadow-md text-center transition-all">
           {queueData.status === 'CALLED' ? (
              <div className="animate-pulse">
                <div className="text-6xl mb-4">🎫</div>
                <h2 className="text-3xl font-bold text-green-600 mb-2">IT'S YOUR TURN!</h2>
                <p className="text-xl">Counter {queueData.counter || '1'}</p>
              </div>
           ) : (
             <>
               <p className="text-gray-500 mb-2">Your Position</p>
               <div key={queueData.position} className="text-6xl font-black text-blue-600 mb-4 animate-bounce-short">
                 {queueData.position}
               </div>
               
               <div className="bg-blue-50 p-4 rounded mb-4">
                <p className="text-sm text-gray-600">Est. Wait Time</p>
                <p className="text-xl font-semibold">{queueData.estimatedWaitTime} mins</p>
                <p className="text-xs text-blue-400 mt-1">Based on real-time service speed</p>
              </div>
               
               <p className="text-xs text-gray-400 mt-4">
                 Priority Score: {queueData.priorityScore}
               </p>
             </>
           )}
        </div>
      )}
    </div>
  );
}