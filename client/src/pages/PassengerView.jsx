import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function PassengerView() {
  const [flights, setFlights] = useState([]);
  const [myQueue, setMyQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1. Fetch Flights on Load
  useEffect(() => {
    fetchFlights();
    checkActiveSession();
  }, []);

  const fetchFlights = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/flights');
      setFlights(res.data);
      setLoading(false);
    } catch (err) {
      toast.error("Failed to load flights");
      setLoading(false);
    }
  };

  // 2. Check if user is already in a queue
  const checkActiveSession = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await axios.get('http://localhost:3001/api/queue/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.entry) {
        setMyQueue(res.data.entry);
      }
    } catch (err) {
      console.error("Session check failed", err);
    }
  };

  // 3. Handle Join Queue
  const handleJoinQueue = async (flightId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Please login first");
      return navigate('/');
    }

    try {
      const res = await axios.post('http://localhost:3001/api/queue/join', 
        { 
          flightId, 
          ticketClass: "ECONOMY", // You can add a dropdown for this later
          isSpecialNeeds: false   // You can add a checkbox for this later
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Joined Queue Successfully!");
      setMyQueue(res.data.entry);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join queue");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Flights...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Available Flights</h1>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              navigate('/');
            }}
            className="text-red-500 hover:text-red-700 font-semibold"
          >
            Logout
          </button>
        </div>

        {/* Active Queue Status Card */}
        {myQueue && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-8 rounded shadow">
            <p className="font-bold">You are currently in queue!</p>
            <p>Flight: {myQueue.flight?.flightCode || "Loading..."}</p>
            <p>Your Priority Score: {myQueue.priorityScore}</p>
            <p className="text-sm mt-2">Status: <span className="font-bold">{myQueue.status}</span></p>
          </div>
        )}

        {/* Flight List */}
        <div className="grid gap-6 md:grid-cols-2">
          {flights.map(flight => (
            <div key={flight.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{flight.flightCode}</h2>
                  <p className="text-gray-500">{flight.origin} ➝ {flight.destination}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {new Date(flight.departureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => handleJoinQueue(flight.id)}
                  disabled={!!myQueue} // Disable if already in a queue
                  className={`w-full py-2 px-4 rounded font-bold transition
                    ${myQueue 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                    }`}
                >
                  {myQueue ? "Already Queued" : "Join Queue"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {flights.length === 0 && (
          <p className="text-center text-gray-500 mt-10">No flights scheduled yet.</p>
        )}
      </div>
    </div>
  );
}