import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function QueueAnalytics({ queueList }) {
  
  // 1. Prepare Data for Pie Chart (Ticket Class Distribution)
  const classData = [
    { name: 'First', value: queueList.filter(p => p.ticketClass === 'FIRST').length },
    { name: 'Business', value: queueList.filter(p => p.ticketClass === 'BUSINESS').length },
    { name: 'Economy', value: queueList.filter(p => p.ticketClass === 'ECONOMY').length },
  ].filter(item => item.value > 0); // Hide empty slices

  const COLORS = ['#7e22ce', '#3b82f6', '#94a3b8']; // Purple, Blue, Gray

  // 2. Prepare Data for Bar Chart (Wait Time Estimates)
  // We take the top 10 passengers to keep the chart readable
  const waitTimeData = queueList.slice(0, 10).map((entry, index) => ({
    name: entry.user.name.split(' ')[0], // First name only
    waitTime: entry.estimatedWaitTime || (index + 1) * 3, // Fallback if 0
    priority: entry.priorityScore
  }));

  if (queueList.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center text-slate-400">
        No data for analytics. Start a simulation!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      {/* CHART 1: Passenger Composition */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-4">Passenger Composition</h3>
        {/* FIX: Use explicit style height instead of relying only on className */}
        <div style={{ width: '100%', height: 300 }}> 
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={classData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {classData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: Priority vs Wait Time */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-4">Top 10: Priority Score vs Wait Time</h3>
        {/* FIX: Use explicit style height */}
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={waitTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="priority" name="Priority Score" fill="#8884d8" />
              <Bar yAxisId="right" dataKey="waitTime" name="Wait (mins)" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}