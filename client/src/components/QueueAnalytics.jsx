import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function QueueAnalytics({ queueList }) {
  
  // Format data for Ticket Class Distribution (Pie Chart)
  const classData = [
    { name: 'First', value: queueList.filter(p => p.ticketClass === 'FIRST').length },
    { name: 'Business', value: queueList.filter(p => p.ticketClass === 'BUSINESS').length },
    { name: 'Economy', value: queueList.filter(p => p.ticketClass === 'ECONOMY').length },
  ].filter(item => item.value > 0);

  const COLORS = ['#7e22ce', '#3b82f6', '#94a3b8']; 

  // Format data for Wait Time Estimates (Bar Chart) - Top 10 only
  const waitTimeData = queueList.slice(0, 10).map((entry, index) => ({
    name: entry.user.name.split(' ')[0], 
    waitTime: entry.estimatedWaitTime || (index + 1) * 3, 
    priority: entry.priorityScore
  }));

  if (queueList.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center text-slate-400">
        No data for analytics.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      {/* Passenger Composition Chart */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-4">Passenger Composition</h3>
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

      {/* Priority vs Wait Time Chart */}
      <div className="bg-white p-6 rounded-lg shadow border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-4">Top 10: Priority Score vs Wait Time</h3>
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