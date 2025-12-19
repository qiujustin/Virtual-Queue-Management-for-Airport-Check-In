import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import QueueAnalytics from '../components/QueueAnalytics';

const socket = io('http://localhost:3001');

const INITIAL_COUNTERS = [
  { id: 'Counter 01', status: 'IDLE', currentPassenger: null },
  { id: 'Counter 02', status: 'IDLE', currentPassenger: null },
  { id: 'Counter 03', status: 'IDLE', currentPassenger: null },
];

export default function AdminDashboard() {
  const [flightId, setFlightId] = useState('');
  const [flights, setFlights] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [counters, setCounters] = useState(INITIAL_COUNTERS);
  
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const isProcessingRef = useRef(false); 

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

        const servingPassengers = data.filter(p => p.status === 'CALLED');
        
        setCounters(prevCounters => {
          return prevCounters.map(counter => {
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

  const handleAddFlight = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/admin/flights', newFlight, getAuthHeader());
      toast.success("Flight Schedule Published");
      setNewFlight({ flightCode: '', destination: '', departureTime: '' });
      refreshFlights();
    } catch (err) {
      toast.error("Error creating flight schedule");
    }
  };

  const handleCallPassenger = async (counterIndex) => {
    const counter = counters[counterIndex];
    if (counter.status === 'BUSY') return; 

    try {
      isProcessingRef.current = true;
      const res = await axios.post('http://localhost:3001/api/admin/call-next', { 
        flightId: flightId, 
        counterId: counter.id 
      }, getAuthHeader());

      if (res.data.message === "Queue is empty") {
        if (!isAutoMode) toast("Queue is currently empty");
        return;
      }

      const servedPassenger = res.data.passenger;
      const updatedCounters = [...counters];
      updatedCounters[counterIndex] = { ...counter, status: 'BUSY', currentPassenger: servedPassenger };
      setCounters(updatedCounters);

      if (!isAutoMode) toast.success(`${counter.id} summoning: ${servedPassenger.user.name}`);
      
    } catch (err) {
      console.error(err);
    } finally {
      isProcessingRef.current = false; 
    }
  };

  const handleCompleteService = async (counterIndex) => {
    const counter = counters[counterIndex];
    if (!counter.currentPassenger) return;

    try {
      await axios.post('http://localhost:3001/api/admin/complete-service', { 
        entryId: counter.currentPassenger.id 
      }, getAuthHeader());

      const updatedCounters = [...counters];
      updatedCounters[counterIndex] = { ...counter, status: 'IDLE', currentPassenger: null };
      setCounters(updatedCounters);
      if (!isAutoMode) toast.success(`${counter.id} marked available`);

    } catch (err) {
      toast.error("Failed to complete transaction");
    }
  };

  const handleNoShow = async (counterIndex) => {
    const counter = counters[counterIndex];
    if (!counter.currentPassenger) return;

    if (!isAutoMode && !window.confirm("Confirm mark passenger as NO-SHOW?")) return;

    try {
      await axios.post('http://localhost:3001/api/admin/noshow', { 
        entryId: counter.currentPassenger.id 
      }, getAuthHeader());

      const updatedCounters = [...counters];
      updatedCounters[counterIndex] = { ...counter, status: 'IDLE', currentPassenger: null };
      setCounters(updatedCounters);
      
      if (!isAutoMode) toast.error(`${counter.id}: Passenger marked absent`);

    } catch (err) {
      toast.error("Failed to process No-Show");
    }
  };

  const handleSimulate = async (count) => {
    if (!flightId) return toast.error("Select active flight first");
    setSimLoading(true);
    try {
      await axios.post('http://localhost:3001/api/admin/simulate', { flightId, count }, getAuthHeader());
      toast.success(`Injected ${count} simulated passengers`);
    } catch (err) { toast.error("Simulation failed"); }
    finally { setSimLoading(false); }
  };

  useEffect(() => {
    if (!isAutoMode) return;
    const interval = setInterval(() => {
      const waitingCount = queueList.filter(p => p.status === 'WAITING').length;
      if (waitingCount === 0) return;
      if (isProcessingRef.current) return; 

      const idleIndex = counters.findIndex(c => c.status === 'IDLE');
      if (idleIndex !== -1) {
        handleCallPassenger(idleIndex);
      }
    }, 2000); 
    return () => clearInterval(interval);
  }, [isAutoMode, counters, queueList]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Professional Header */}
        <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm mb-8 gap-6 border-t-4 border-sky-700">
          <div>
             <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Terminal Operations Control</h1>
             <p className="text-slate-500 font-medium">System Administrator Dashboard</p>
          </div>
         
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
             {/* Styled Toggle Switch */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-md cursor-pointer transition-all border ${isAutoMode ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-200 border-slate-300'}`}
                 onClick={() => setIsAutoMode(!isAutoMode)}>
              <div className="relative w-12 h-6 bg-slate-300 rounded-full shadow-inner transition-colors" style={{backgroundColor: isAutoMode ? '#10b981' : '#cbd5e1'}}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform transform ${isAutoMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
              <span className={`text-sm font-bold uppercase tracking-wider ${isAutoMode ? 'text-emerald-700' : 'text-slate-600'}`}>
                Auto-Assign: {isAutoMode ? "ON" : "OFF"}
              </span>
            </div>

            <select className="border border-slate-300 bg-white rounded-md px-3 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none min-w-[220px]" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
              {flights.map(f => <option key={f.id} value={f.id}>Flight {f.flightCode} ({f.destination})</option>)}
            </select>
            <button onClick={handleLogout} className="bg-white text-red-600 hover:bg-red-50 border border-red-200 px-6 py-2 rounded-md font-bold transition shadow-sm">End Session</button>
          </div>
        </div>

        <QueueAnalytics queueList={queueList} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          <div className="xl:col-span-2 space-y-8">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2"><span className="text-sky-600">●</span> Service Counters Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {counters.map((counter, index) => {
                const isBusy = counter.status === 'BUSY';
                return (
                <div key={counter.id} 
                  className={`relative rounded-xl border-2 transition-all shadow-md flex flex-col justify-between overflow-hidden ${
                  isBusy ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-white' : 'border-emerald-400 bg-gradient-to-b from-emerald-50 to-white'
                }`}>
                  
                  <div className={`p-4 flex justify-between items-center ${isBusy ? 'bg-amber-400 text-amber-950' : 'bg-emerald-400 text-emerald-950'}`}>
                    <span className="font-black text-lg uppercase">{counter.id}</span>
                    <span className="text-xs font-extrabold uppercase tracking-widest bg-white/30 px-2 py-1 rounded">
                      {isBusy ? 'Occupied' : 'Available'}
                    </span>
                  </div>

                  <div className="flex-grow flex items-center justify-center p-6 min-h-[150px]">
                    {isBusy ? (
                      <div className="text-center w-full">
                        <div className="text-xs text-amber-700 font-bold mb-2 tracking-wider uppercase">Currently Processing Passenger</div>
                        <div className="font-black text-slate-800 text-xl truncate mb-2 py-1 px-2 bg-white rounded border border-amber-200 shadow-sm">
                          {counter.currentPassenger?.user?.name}
                        </div>
                        <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                          Priority Score: {counter.currentPassenger?.priorityScore}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-emerald-600 opacity-70">
                        <div className="text-5xl mb-2">🟢</div>
                        <span className="text-sm font-bold uppercase tracking-wide">Ready for Assignment</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    {isBusy ? (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleCompleteService(index)}
                          className="flex-1 bg-slate-800 hover:bg-slate-900 text-white text-sm py-3 rounded-lg font-bold transition shadow-sm uppercase tracking-wide"
                        >
                          Complete Service
                        </button>
                        <button 
                          onClick={() => handleNoShow(index)}
                          className="flex-1 bg-white border-2 border-red-200 hover:bg-red-50 text-red-700 text-sm py-3 rounded-lg font-bold transition shadow-sm uppercase tracking-wide"
                        >
                          Mark No-Show
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCallPassenger(index)}
                        disabled={queueList.filter(p => p.status === 'WAITING').length === 0 || isAutoMode}
                        className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm py-4 rounded-lg font-black shadow-md active:scale-[0.98] transition uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {isAutoMode ? "Auto-Assignment Active" : "Summon Next Passenger"}
                      </button>
                    )}
                  </div>
                </div>
              )})}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
              <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 uppercase tracking-wide text-sm">Waitlist Manifest</h3>
                <span className="text-xs font-black bg-sky-100 text-sky-700 px-3 py-1 rounded-full uppercase">
                  {queueList.filter(p => p.status === 'WAITING').length} Pending
                </span>
              </div>
              <div className="max-h-[450px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="p-4 bg-slate-50">Seq.</th>
                      <th className="p-4 bg-slate-50">Passenger Name</th>
                      <th className="p-4 bg-slate-50">Ticket Type</th>
                      <th className="p-4 bg-slate-50">Prio. Score</th>
                      <th className="p-4 bg-slate-50">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queueList.map((entry, idx) => (
                      <tr key={entry.id} className={`transition hover:bg-slate-50 ${entry.status === 'CALLED' ? 'bg-amber-50/50' : ''}`}>
                        <td className="p-4 font-mono text-slate-500 font-bold">
                          {entry.status === 'CALLED' ? '-' : (idx + 1).toString().padStart(3, '0')}
                        </td>
                        <td className="p-4 font-bold text-slate-800">{entry.user.name}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wide border ${
                            entry.ticketClass === 'FIRST' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            entry.ticketClass === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {entry.ticketClass.substring(0,4)}
                          </span>
                          {entry.isSpecialNeeds && <span className="ml-2 text-lg" title="Special Assistance Required">♿</span>}
                        </td>
                        <td className="p-4 font-bold text-sky-700">{entry.priorityScore}</td>
                        <td className="p-4 text-xs font-black uppercase tracking-wider">
                          {entry.status === 'CALLED' ? <span className="text-amber-600 animate-pulse bg-amber-100 px-2 py-1 rounded">Summoned</span> : <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded">Queued</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
             {/* Simulation Controls with professional names */}
            <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-500">
              <h2 className="text-sm font-bold mb-4 text-slate-700 uppercase tracking-wide">Traffic Simulation</h2>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => handleSimulate(5)} disabled={simLoading} className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 py-3 rounded-lg font-bold text-sm transition uppercase tracking-wide">Inject Standard Load (5 Pax)</button>
                <button onClick={() => handleSimulate(20)} disabled={simLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 py-3 rounded-lg font-black text-sm transition shadow uppercase tracking-wide">Inject Peak Load (20 Pax)</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-slate-700">
              <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Flight Schedule Management</h3>
              <form onSubmit={handleAddFlight} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Flight Designator</label>
                    <input className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50" placeholder="e.g., MH370" value={newFlight.flightCode} onChange={e => setNewFlight({...newFlight, flightCode: e.target.value})} required />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Destination Airport</label>
                    <input className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50" placeholder="City or Airport Code" value={newFlight.destination} onChange={e => setNewFlight({...newFlight, destination: e.target.value})} required />
                </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Scheduled Departure (UTC)</label>
                    <input className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50 font-mono" type="datetime-local" onChange={e => setNewFlight({...newFlight, departureTime: e.target.value})} required />
                </div>
                <button className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-lg font-black text-sm transition shadow uppercase tracking-widest mt-2">Publish Schedule</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}