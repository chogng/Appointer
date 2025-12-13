# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Appointer** is a Device Reservation Management System (DRMS) built with React + Vite frontend and Node.js/Express backend. The application allows users to browse and reserve devices (like servers, VR units) with configurable time slots and granularity.

## Tech Stack

- **Frontend**: React 19, React Router, Tailwind CSS, Vite
- **Backend**: Express.js, Socket.IO (real-time updates)
- **Database**: SQL.js (in-memory SQLite) with file persistence
- **Build Tool**: Vite

## Development Commands

### Frontend (root directory)
```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend (server directory)
```bash
npm run server       # Start backend server (http://localhost:3001) - run from root
npm run server:init  # Install dependencies and initialize database - run from root
cd server && npm run dev      # Start server with --watch mode (auto-restart on changes)
cd server && npm run start    # Start production server
cd server && npm run init-db  # Initialize/reset database
```

### Database Migrations
```bash
cd server && node migrate-to-granularity.js        # Add/rename granularity field
cd server && node migrate-add-reservation-details.js  # Add title/description/color to reservations
cd server && node migrate-add-opentime.js          # Add openTime field to devices
```

## Architecture

### Frontend Structure
```
src/
├── components/        # Reusable UI components
│   ├── ui/           # Generic UI components (Button, Card, Input, Toast, Popup, Dropdown)
│   ├── AppRoutes.jsx # Main routing configuration
│   ├── PrivateRoute.jsx, AdminRoute.jsx  # Auth guards
│   ├── WeeklyCalendar.jsx, MiniCalendar.jsx  # Calendar components
│   ├── BookingPopover.jsx, BookingDate.jsx, BookingTime.jsx, BookingGranularity.jsx  # Booking flow
│   └── DeviceCard.jsx, PageTransition.jsx
├── pages/            # Route pages
│   ├── Login.jsx, Register.jsx, PendingReview.jsx
│   ├── Dashboard.jsx, Devices.jsx, CreateDevice.jsx, DeviceBooking.jsx
│   ├── MyReservations.jsx, Messages.jsx, Docs.jsx
├── layouts/          # Layout wrappers
│   ├── MainLayout.jsx   # Authenticated pages layout
│   └── AuthLayout.jsx   # Login/register layout
├── context/
│   └── AuthContext.jsx  # Authentication state management
├── services/
│   ├── apiService.js    # REST API client (handles all HTTP requests to backend)
│   ├── socketService.js # WebSocket client (real-time updates)
│   ├── mockData.js      # Mock data service (legacy, mostly replaced by API)
├── hooks/
│   ├── useRealtimeSync.js  # Custom hook for real-time data sync via WebSocket
│   └── usePermission.js    # Permission checking hook
└── App.jsx           # Root component with Router + AuthProvider
```

### Backend Structure
```
server/
├── server.js         # Express + Socket.IO server, all REST API routes
├── database.js       # SQL.js database initialization and setup
├── db-adapter.js     # Database abstraction layer (query/queryOne/execute)
├── init-db.js        # Database initialization script (better-sqlite3 version)
├── migrate-*.js      # Database migration scripts
└── drms.db          # SQLite database file (created at runtime)
```

### Database Schema

**users**: id (TEXT), username (UNIQUE), password, role (SUPER_ADMIN/ADMIN/USER), status (ACTIVE/PENDING/BLOCKED), name, email, expiryDate

**devices**: id (TEXT), name, description, isEnabled (INTEGER 0/1), openDays (JSON array), timeSlots (JSON array), granularity (INTEGER minutes), openTime (JSON object with start/end)

**reservations**: id (TEXT), userId, deviceId, date (YYYY-MM-DD), timeSlot (HH:MM-HH:MM), status (CONFIRMED/CANCELLED), createdAt (ISO timestamp), title, description, color

**logs**: id (TEXT), userId, action, details, timestamp

### Real-time Updates

The application uses Socket.IO for real-time synchronization:
- **Events emitted by server**: `user:created`, `user:updated`, `device:created`, `device:updated`, `device:deleted`, `reservation:created`, `reservation:updated`, `reservation:deleted`
- **Client-side handling**: Components use `useRealtimeSync()` hook to listen for these events and update local state automatically
- **Broadcasting**: All data mutations (POST/PATCH/DELETE) trigger a `broadcast()` call in server.js to notify connected clients

### Authentication Flow

1. User logs in via `/api/auth/login` (username/password)
2. `AuthContext` stores user object in localStorage (`drms_current_user`)
3. `PrivateRoute` and `AdminRoute` components protect routes based on user role
4. Password is stored in plain text (⚠️ not production-ready, implement proper hashing)

### Booking System Features

- **Configurable granularity**: Devices support booking intervals (15/30/60 minutes)
- **Open days/times**: Devices have configurable open days (array of weekday numbers) and daily time range
- **Time slots**: Legacy timeSlots array (JSON) for predefined slots
- **Conflict detection**: Backend checks for overlapping reservations before confirming

### Database Adapter Pattern

`db-adapter.js` provides abstraction for switching between SQL.js and other databases:
- `query(sql, params)` - returns array of objects
- `queryOne(sql, params)` - returns single object or null
- `execute(sql, params)` - for INSERT/UPDATE/DELETE
- `getLastInsertId()` - get last inserted row ID

The adapter currently uses SQL.js but has commented placeholders for MySQL migration.

## Key Implementation Details

### Tailwind Configuration
- Custom color palette based on Claude AI design system (bg-*, border-*, text-*, accent-*)
- Custom animations: slide-up, slide-down, slide-in-right, slide-in-left
- Font families: Inter (UI), Georgia (display/serif)

### Component Patterns
- UI components in `src/components/ui/` are generic and reusable
- Pages use layouts (`MainLayout` for authenticated, `AuthLayout` for public)
- Real-time features use `socketService.connect()` + `useRealtimeSync()` pattern

### API Conventions
- Base URL: `http://localhost:3001/api`
- REST endpoints follow pattern: `/api/{resource}` and `/api/{resource}/:id`
- All responses are JSON
- Error responses: `{ error: "message" }`
- Success responses: return the resource object or `{ success: true }`

### ESLint Configuration
- Using flat config format (`eslint.config.js`)
- Ignores variables starting with capital letters or underscore in no-unused-vars rule
- React Hooks and React Refresh plugins enabled

## Common Development Tasks

### Adding a New API Endpoint
1. Add route handler in `server/server.js` (group by resource type)
2. Use `db.query()`, `db.queryOne()`, or `db.execute()` for database operations
3. Call `broadcast(event, data)` if the change should trigger real-time updates
4. Add corresponding method in `src/services/apiService.js`

### Adding Real-time Sync to a Component
```javascript
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const MyComponent = () => {
  const [data, setData] = useState([]);

  useRealtimeSync({
    'resource:created': (newItem) => setData(prev => [...prev, newItem]),
    'resource:updated': (updated) => setData(prev => prev.map(item =>
      item.id === updated.id ? updated : item
    )),
    'resource:deleted': ({ id }) => setData(prev => prev.filter(item => item.id !== id))
  });
};
```

### Running Database Migrations
- Create a new `migrate-*.js` file in `server/` directory
- Check if column exists using `PRAGMA table_info(table_name)`
- Use `db.execute()` with `ALTER TABLE` or table rebuild pattern
- Run: `cd server && node migrate-your-migration.js`

### Testing API Endpoints
- Use `server/test-api.js` to manually test endpoints
- Default test accounts: admin/123, manager/123, user/123
- Frontend dev server proxies API to avoid CORS issues (or backend has CORS enabled)

## Important Notes

- **Database persistence**: SQL.js runs in-memory; `saveDatabase()` writes to `drms.db` file after each write operation
- **ID generation**: Uses timestamp-based IDs (`dev_${Date.now()}`, `user_${Date.now()}`, etc.)
- **Port configuration**: Frontend runs on 5173 (Vite default), backend on 3001
- **Module type**: Both frontend and backend use ES modules (`"type": "module"` in package.json)
- **Watch mode**: Backend supports `--watch` flag for auto-restart during development
