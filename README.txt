Virtual Queue Management System (Airport Check-In)
Final Year Project Submission
--------------------------------------------------------------------------------

About the Project
-----------------
This project demonstrates a real-time queue management system designed for airport check-in counters. It uses a weighted algorithm to prioritize passengers based on flight urgency, ticket class, and special assistance needs.

The system is split into two parts:
1. Server: Node.js with a PostgreSQL database.
2. Client: React frontend using Vite and Tailwind CSS.

Prerequisites
-------------
Before running the code, ensure you have the following installed:
1. Node.js (v16.0.0 or higher) and npm.
2. PostgreSQL Server (must be installed and running locally on port 5432).

Configuration (Important)
-------------------------
The server requires environment variables to connect to your database.

1. Navigate to the /server folder.
2. Open the ".env" file.
3. Locate the DATABASE_URL variable:
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/airport_queue?schema=public"
   
   > If your local PostgreSQL credentials differ (e.g., different password or username), you MUST update this line to match your local setup.
   > The format is: postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME

How to Run the Project
----------------------

STEP 1: Setting up the Backend (Server)
   Open a terminal and navigate to the /server folder.
   
   Run the following commands in order:
   > npm install             (Installs dependencies like Express and Prisma)
   > npx prisma generate     (Generates the database client)
   > npx prisma migrate dev  (Push schema to DB - this will create the 'airport_queue' database)
   > node seed.js            (Seeds the DB with an Admin account and Flight data)
   > node index.js           (Starts the backend server)

   You should see: "Server running on port 3001"

STEP 2: Setting up the Frontend (Client)
   Open a NEW terminal window (do not close the server terminal).
   Navigate to the /client folder.

   Run the following commands:
   > npm install             (Installs React, Vite, Tailwind, etc.)
   > npm run dev             (Starts the frontend development server)

   Click the local URL shown in the terminal (usually http://localhost:5173) to launch the app.

--------------------------------------------------------------------------------

Operating Guide
---------------

To demonstrate the full system capabilities, open two browser windows:

A. Window 1: Admin Dashboard
   - Log in with Username: "admin" and Password: "admin123".
   - This view allows you to manage flights, open counters, and call passengers.
   - Use the "Traffic Simulation" panel to instantly generate 5-20 bot passengers to test the priority algorithm.

B. Window 2: Passenger Kiosk (Use Incognito/Private Mode)
   - Register a new account.
   - Select a flight and checking in.
   - Try selecting "First Class" or "Special Assistance" to see how it affects your queue position compared to standard economy passengers.

Troubleshooting
---------------
1. "Connection refused" (Database): 
   Ensure your PostgreSQL service is running. On Windows, check Services.msc. On Mac/Linux, check your brew/systemctl status.

2. "Authentication failed" (Database):
   Double-check the username and password in server/.env match your local Postgres credentials.

3. "Port already in use":
   Ensure ports 3001 (Server) and 5173 (Client) are free.

--------------------------------------------------------------------------------
Built with: React, Node.js, Express, PostgreSQL, Prisma, Socket.io, Tailwind CSS.