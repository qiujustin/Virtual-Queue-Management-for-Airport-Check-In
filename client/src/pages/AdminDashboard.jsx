import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const socket = io('http://localhost:3001');

export default function AdminDashboard() {
  const [flightId, setFlightId] = useState('');
  const [flights, setFlights] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const navigate = useNavigate();
  
  // Flight Management State
  const [newFlight, setNewFlight] = useState({ flightCode: '', destination: '', departureTime: '' });

  // Metrics State
  const [metrics, setMetrics] = useState({
    queueLength: 0,
    avgWaitTime: 0,
    priorityCount: 0
  });

  // Get Auth Header Helper
  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Load Flights
  const refreshFlights = () => {
    axios.get('http://localhost:3001/api/flights').then(res => {
      setFlights(res.data);
      if (res.data.length > 0 && !flightId) setFlightId(res.data[0].id);
    });
  };

  useEffect(() => { refreshFlights(); }, []);

  // Fetch Queue & Metrics
  const fetchData = async () => {
    if (!flightId) return;
    try {
      const token = localStorage.getItem('token'); // Need token for Admin API
      const listRes = await axios.get(`http://localhost:3001/api/admin/queue/${flightId}`, getAuthHeader());
      setQueueList(listRes.data);
      const metricRes = await axios.get(`http://localhost:3001/api/admin/metrics/${flightId}`, getAuthHeader());
      setMetrics(metricRes.data);
    } catch (err) { console.error("Fetch Error:", err); }
  };

  useEffect(() => { fetchData(); }, [flightId]);

  // Real-time Update Listener
  useEffect(() => {
    socket.on('admin:queue_update', () => {
      fetchData();
      toast('Queue Updated', { icon: '🔄', duration: 1000 });
    });
    return () => socket.off('admin:queue_update');
  }, [flightId]);

  // --- ACTIONS ---

  const handleCallNext = async () => {
    try {
      const res = await axios.post('http://localhost:3001/api/admin/call-next', 
        { flightId, counterId: "Counter-1" },
        getAuthHeader()
      );
      if (res.data.passenger) toast.success(`Called: ${res.data.passenger.user?.name}`);
      else toast('Queue is empty!', { icon: '✅' });
    } catch (err) { toast.error("Error calling next"); }
  };

  const handleReset = async () => {
    if(!window.confirm("RESET SYSTEM? This will kick everyone out of the queue.")) return;
    try {
      await axios.post('http://localhost:3001/api/admin/reset', {}, getAuthHeader());
      toast.success("System Reset");
      fetchData();
    } catch (err) { toast.error("Reset failed"); }
  };

  const handleSimulate = async () => {
    try {
      toast.loading("Simulating Crowd...");
      await axios.post('http://localhost:3001/api/admin/simulate', 
        { flightId, count: 5 }, 
        getAuthHeader()
      );
      toast.dismiss();
      toast.success("5 Bots Added!");
    } catch (err) { toast.error("Simulation failed"); }
  };

  const handleCreateFlight = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/admin/flights', newFlight, getAuthHeader());
      toast.success("Flight Registered");
      setNewFlight({ flightCode: '', destination: '', departureTime: '' }); // Reset form
      refreshFlights();
    } catch (err) { toast.error("Failed to register flight"); }
  };

  // Filter Lists
  const servingList = queueList.filter(q => q.status === 'CALLED');
  const waitingList = queueList.filter(q => q.status === 'WAITING');

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header & Controls */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Check-in Counter Control</h1>
            <p className="text-slate-500">Real-time Analytics & Flow Management</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="bg-red-100 text-red-600 px-3 py-2 rounded font-bold text-sm hover:bg-red-200">⚠️ Reset</button>
            <button onClick={handleSimulate} className="bg-purple-100 text-purple-600 px-3 py-2 rounded font-bold text-sm hover:bg-purple-200">🤖 Simulate</button>
            
            <select className="border p-2 rounded" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
              {flights.map(f => (
                <option key={f.id} value={f.id}>{f.flightCode} ({f.destination})</option>
              ))}
            </select>
            <button 
              onClick={() => { localStorage.removeItem('token'); navigate('/'); }}
              className="ml-4 text-red-500 font-bold hover:underline"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Queue Length</h3>
            <p className="text-4xl font-bold text-slate-800">{metrics.queueLength}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Est. Total Wait</h3>
            <p className="text-4xl font-bold text-slate-800">{metrics.avgWaitTime} <span className="text-lg text-gray-400 font-normal">min</span></p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Priority Pax</h3>
            <p className="text-4xl font-bold text-slate-800">{metrics.priorityCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Currently Serving Box */}
            {servingList.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h3 className="text-green-800 font-bold mb-2">🟢 Currently Serving</h3>
                {servingList.map(entry => (
                   <div key={entry.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm mb-2">
                      <div><span className="font-bold">{entry.user?.name}</span> <span className="text-sm text-gray-500">({entry.ticketClass})</span></div>
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">AT COUNTER</span>
                   </div>
                ))}
              </div>
            )}

            {/* Waiting List Table */}
             <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <h2 className="font-bold text-lg">Waiting List</h2>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">Sorted by Smart Priority</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm">
                    <tr><th className="p-4">Name</th><th className="p-4">Class</th><th className="p-4">Score</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {waitingList.map((entry) => (
                      <tr key={entry.id} className="hover:bg-blue-50">
                        <td className="p-4 font-medium">{entry.user?.name} {entry.isSpecialNeeds && '♿'}</td>
                        <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{entry.ticketClass}</span></td>
                        <td className="p-4 font-mono text-sm">{entry.priorityScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             
             {/* Operations: Register Flight */}
             <div className="bg-white p-6 rounded shadow mt-8">
                <h3 className="font-bold text-lg mb-4">✈️ Register New Flight (Stakeholder Ops)</h3>
                <form onSubmit={handleCreateFlight} className="flex flex-col md:flex-row gap-4">
                  <input placeholder="Code (e.g. SQ102)" className="border p-2 rounded" value={newFlight.flightCode}
                    onChange={e => setNewFlight({...newFlight, flightCode: e.target.value})} required />
                  <input placeholder="Destination" className="border p-2 rounded" value={newFlight.destination}
                    onChange={e => setNewFlight({...newFlight, destination: e.target.value})} required />
                  <input type="datetime-local" className="border p-2 rounded" 
                    onChange={e => setNewFlight({...newFlight, departureTime: e.target.value})} required />
                  <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded font-bold">Add Flight</button>
                </form>
             </div>
          </div>

          {/* Right Column: Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg border border-indigo-100">
              <h2 className="text-xl font-bold mb-4 text-slate-800">Action Required</h2>
              <button onClick={handleCallNext} disabled={waitingList.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-lg font-bold py-4 rounded-lg shadow active:scale-95 flex justify-center items-center gap-2">
                <span>📢</span> Call Next Passenger
              </button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
              <strong>System Status:</strong> <span className="text-green-600">● Online</span><br/>
              WebSocket active. Metrics are live.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}