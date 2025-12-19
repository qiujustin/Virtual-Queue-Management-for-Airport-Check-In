import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import QueueAnalytics from '../components/QueueAnalytics';

const socket = io('http://localhost:3001');

// Initial Counters
const INITIAL_COUNTERS = [
  { id: 'Counter 1', status: 'IDLE', currentPassenger: null },
  { id: 'Counter 2', status: 'IDLE', currentPassenger: null },
  { id: 'Counter 3', status: 'IDLE', currentPassenger: null },
];

export default function AdminDashboard() {
  const [flightId, setFlightId] = useState('');
  const [flights, setFlights] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [counters, setCounters] = useState(INITIAL_COUNTERS);
  const [metrics, setMetrics] = useState({ queueLength: 0, avgWaitTime: 0, priorityCount: 0 });
  
  // Automation State
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const isProcessingRef = useRef(false); // Prevents auto-call spamming

  const [newFlight, setNewFlight] = useState({ flightCode: '', destination: '', departureTime: '' });
  const navigate = useNavigate();

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const refreshFlights = () => {
    axios.get('http://localhost:3001/api/flights').then(res => {
      setFlights(res.data);
      if (res.data.length > 0 && !flightId) {
        setFlightId(res.data[0].id);
      }
    });
  };

  const refreshQueueData = useCallback(() => {
    if (!flightId) return;

    axios.get(`http://localhost:3001/api/admin/queue/${flightId}`, getAuthHeader())
      .then(res => {
        const data = res.data;
        setQueueList(data);

        // Map Passengers to Specific Counters
        const servingPassengers = data.filter(p => p.status === 'CALLED');
        
        setCounters(prevCounters => {
          return prevCounters.map(counter => {
            // MATCH USING DB FIELD 'assignedCounter'
            const assignedPassenger = servingPassengers.find(p => p.assignedCounter === counter.id);
            
            if (assignedPassenger) {
              return { ...counter, status: 'BUSY', currentPassenger: assignedPassenger };
            } else {
              return { ...counter, status: 'IDLE', currentPassenger: null };
            }
          });
        });
      })
      .catch(err => console.error("Queue fetch error", err));

    axios.get(`http://localhost:3001/api/admin/metrics/${flightId}`, getAuthHeader())
      .then(res => setMetrics(res.data))
      .catch(err => console.error("Metrics fetch error", err));
  }, [flightId]);

  useEffect(() => {
    refreshFlights();
  }, []);

  useEffect(() => {
    refreshQueueData();
    const handleUpdate = () => { refreshQueueData(); };
    socket.on('queue_update', handleUpdate);
    return () => { socket.off('queue_update', handleUpdate); };
  }, [refreshQueueData]);

  // --- ACTIONS ---

  const handleAddFlight = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/admin/flights', newFlight, getAuthHeader());
      toast.success("Flight Created");
      setNewFlight({ flightCode: '', destination: '', departureTime: '' });
      refreshFlights();
    } catch (err) {
      toast.error("Error creating flight");
    }
  };

  const handleCallPassenger = async (counterIndex) => {
    const counter = counters[counterIndex];
    if (counter.status === 'BUSY') return; // Double check

    try {
      isProcessingRef.current = true; // Lock
      const res = await axios.post('http://localhost:3001/api/admin/call-next', { 
        flightId: flightId, 
        counterId: counter.id 
      }, getAuthHeader());

      if (res.data.message === "Queue is empty") {
        if (!isAutoMode) toast("No passengers waiting");
        return;
      }

      // Optimistic Update (Immediate visual feedback)
      const servedPassenger = res.data.passenger;
      const updatedCounters = [...counters];
      updatedCounters[counterIndex] = { ...counter, status: 'BUSY', currentPassenger: servedPassenger };
      setCounters(updatedCounters);

      if (!isAutoMode) toast.success(`${counter.id} serving ${servedPassenger.user.name}`);
      
    } catch (err) {
      console.error(err);
    } finally {
      isProcessingRef.current = false; // Unlock
    }
  };

  const handleCompleteService = async (counterIndex) => {
    const counter = counters[counterIndex];
    if (!counter.currentPassenger) return;

    try {
      await axios.post('http://localhost:3001/api/admin/complete-service', { 
        entryId: counter.currentPassenger.id 
      }, getAuthHeader());

      // Free up
      const updatedCounters = [...counters];
      updatedCounters[counterIndex] = { ...counter, status: 'IDLE', currentPassenger: null };
      setCounters(updatedCounters);
      if (!isAutoMode) toast.success(`${counter.id} free`);

    } catch (err) {
      toast.error("Error completing");
    }
  };

  const handleSimulate = async (count) => {
    if (!flightId) return toast.error("Select a flight");
    setSimLoading(true);
    try {
      await axios.post('http://localhost:3001/api/admin/simulate', { flightId, count }, getAuthHeader());
      toast.success(`Generated ${count} Passengers`);
    } catch (err) { toast.error("Simulation failed"); }
    finally { setSimLoading(false); }
  };

  // --- AUTOMATION ENGINE ---
  useEffect(() => {
    if (!isAutoMode) return;

    // Check every 2 seconds
    const interval = setInterval(() => {
      // 1. Are there waiting passengers?
      const waitingCount = queueList.filter(p => p.status === 'WAITING').length;
      if (waitingCount === 0) return;

      // 2. Is there an idle counter?
      if (isProcessingRef.current) return; // Don't call if network is busy

      const idleIndex = counters.findIndex(c => c.status === 'IDLE');
      if (idleIndex !== -1) {
        console.log("Auto-Assigning to", counters[idleIndex].id);
        handleCallPassenger(idleIndex);
      }
    }, 2000); // 2 second delay creates a nice rhythm

    return () => clearInterval(interval);
  }, [isAutoMode, counters, queueList]); // Re-evaluate when state changes

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-lg shadow-sm mb-8 gap-4">
          <h1 className="text-3xl font-bold text-slate-800">Admin Operations Center</h1>
          <div className="flex items-center gap-4">
            {/* AUTO TOGGLE */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition ${isAutoMode ? 'bg-green-100' : 'bg-slate-200'}`}
                 onClick={() => setIsAutoMode(!isAutoMode)}>
              <div className={`w-4 h-4 rounded-full ${isAutoMode ? 'bg-green-600 animate-pulse' : 'bg-slate-400'}`}></div>
              <span className={`text-sm font-bold ${isAutoMode ? 'text-green-800' : 'text-slate-600'}`}>
                {isAutoMode ? "AUTO-PILOT ON" : "MANUAL MODE"}
              </span>
            </div>

            <select 
              className="border border-slate-300 rounded p-2 min-w-[200px]"
              value={flightId}
              onChange={(e) => setFlightId(e.target.value)}
            >
              {flights.map(f => (
                <option key={f.id} value={f.id}>{f.flightCode} ({f.destination})</option>
              ))}
            </select>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-4 py-2 rounded font-bold h-[42px]">Logout</button>
          </div>
        </div>

        <QueueAnalytics queueList={queueList} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Counters */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-slate-700">Check-In Counters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {counters.map((counter, index) => (
                <div key={counter.id} className={`p-4 rounded-xl border-2 transition-all shadow-sm ${
                  counter.status === 'BUSY' ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-white'
                }`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-slate-700">{counter.id}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      counter.status === 'BUSY' ? 'bg-orange-200 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {counter.status}
                    </span>
                  </div>

                  {counter.status === 'BUSY' ? (
                    <div className="text-center space-y-3">
                      <div className="bg-white p-2 rounded border border-orange-100">
                        <div className="text-xs text-slate-400">SERVING</div>
                        <div className="font-bold text-slate-800 truncate">
                          {counter.currentPassenger?.user?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Score: {counter.currentPassenger?.priorityScore}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCompleteService(index)}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm py-2 rounded font-bold transition"
                      >
                        ✅ Complete
                      </button>
                    </div>
                  ) : (
                    <div className="text-center h-full flex flex-col justify-end">
                      <button 
                        onClick={() => handleCallPassenger(index)}
                        disabled={queueList.filter(p => p.status === 'WAITING').length === 0 || isAutoMode}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm py-2 rounded font-bold shadow-sm active:scale-95 transition"
                      >
                        {isAutoMode ? "Auto..." : "📢 Call Next"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Waiting List */}
            <div className="bg-white rounded-lg shadow overflow-hidden mt-8">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-700">Priority Queue ({queueList.filter(p => p.status === 'WAITING').length} Waiting)</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 text-sm sticky top-0">
                    <tr>
                      <th className="p-4">Pos</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Class</th>
                      <th className="p-4">Score</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queueList.map((entry, idx) => (
                      <tr key={entry.id} className={entry.status === 'CALLED' ? 'bg-orange-50' : ''}>
                        <td className="p-4 font-mono text-slate-400 text-sm">
                          {entry.status === 'CALLED' ? '-' : idx + 1}
                        </td>
                        <td className="p-4 font-medium">{entry.user.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            entry.ticketClass === 'FIRST' ? 'bg-purple-100 text-purple-700' :
                            entry.ticketClass === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {entry.ticketClass}
                          </span>
                          {entry.isSpecialNeeds && <span className="ml-1">♿</span>}
                        </td>
                        <td className="p-4 font-bold text-indigo-600">{entry.priorityScore}</td>
                        <td className="p-4 text-xs font-bold uppercase tracking-wider">
                          {entry.status === 'CALLED' ? <span className="text-orange-600 animate-pulse">Serving</span> : <span className="text-slate-400">Waiting</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT: Controls */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
              <h2 className="text-lg font-bold mb-2 text-slate-800">Simulation Engine</h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleSimulate(5)} disabled={simLoading} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 rounded font-bold text-sm">+5 Pax</button>
                <button onClick={() => handleSimulate(20)} disabled={simLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 py-2 rounded font-bold text-sm">+20 Peak</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-slate-700 mb-4">Add Flight</h3>
              <form onSubmit={handleAddFlight} className="space-y-3">
                <input className="w-full border p-2 rounded text-sm" placeholder="Code (MH370)" value={newFlight.flightCode} onChange={e => setNewFlight({...newFlight, flightCode: e.target.value})} required />
                <input className="w-full border p-2 rounded text-sm" placeholder="Destination" value={newFlight.destination} onChange={e => setNewFlight({...newFlight, destination: e.target.value})} required />
                <input className="w-full border p-2 rounded text-sm" type="datetime-local" onChange={e => setNewFlight({...newFlight, departureTime: e.target.value})} required />
                <button className="w-full bg-slate-800 text-white py-2 rounded font-bold text-sm">Create Schedule</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}