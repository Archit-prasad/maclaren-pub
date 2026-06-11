# MacLaren's Pub — Architecture & System Design

## Overview

MacLaren's Pub is a gamified, real-time social chat application themed around the iconic pub from *How I Met Your Mother*. The application enables users to interact with each other through themed game mechanics including a coin economy (GNB coins), romantic gestures (Blue French Horn), and social bonding features (Bro Registry).

## Technology Stack

### Frontend
- **Framework**: React with Vite bundler
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.IO (client)
- **HTTP Client**: Axios
- **Deployment**: Vercel

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time Communication**: Socket.IO (server)
- **Database**: MongoDB (Atlas) with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer + Cloudinary
- **Deployment**: Railway

### Database
- **MongoDB Atlas** — Cloud-hosted MongoDB
- **Mongoose** — Object Data Model (ODM) for schema validation and relationships

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vercel)                       │
│  React + Vite + Tailwind CSS                                 │
│  - LoginPage (Auth & Registration)                           │
│  - PubFloorMap (Interactive floor with tables/hotspots)      │
│  - TableChatbox (Real-time messaging)                        │
│  - BFHModal (Blue French Horn proposals)                     │
│  - BroRequestModal (Bro registry management)                 │
│  - BarMenuModal (Drink economy interactions)                 │
│  - ThePlaybook (User profile & settings)                     │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTPS + WebSocket (Socket.IO)
         │
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Railway)                            │
│  Express.js + Socket.IO                                      │
│  ├─ Routes:                                                   │
│  │  ├─ /api/auth (register, login, onboarding)               │
│  │  ├─ /api/chat (message history, uploads)                  │
│  │  ├─ /api/coins (daily claims, transaction ledger)         │
│  │  └─ /api/admin (moderation, banned keywords)              │
│  ├─ WebSocket Handlers:                                      │
│  │  ├─ phase4 (BFH, Bro Registry, Murtaugh List, Wingman)    │
│  │  ├─ table joins/leaves, message broadcasting              │
│  │  └─ user status/activity tracking                         │
│  └─ Middleware:                                              │
│     ├─ auth (JWT validation)                                 │
│     └─ grinchFilter (profanity/keyword censorship)           │
└─────────────────────────────────────────────────────────────┘
         │
         │ Mongoose ODM
         │
┌─────────────────────────────────────────────────────────────┐
│             Database (MongoDB Atlas)                          │
│  ├─ Users (profiles, balances, inventory, relationships)     │
│  ├─ Messages (chat history, media)                           │
│  ├─ Tables (pub floor layout & capacity)                     │
│  └─ BannedKeywords (censorship list)                         │
└─────────────────────────────────────────────────────────────┘
         │
         │ REST API
         │
┌─────────────────────────────────────────────────────────────┐
│                Cloudinary (CDN)                               │
│  Avatar images and Polaroid chat photo storage               │
└─────────────────────────────────────────────────────────────┘
```

## Core Database Models

### User Schema
```
{
  display_name: String (unique, required),
  age: Number (required, must be >= 20),
  gender: String (enum: 'Male' | 'Female'),
  email: String (unique, lowercase),
  password_hash: String (bcrypt hashed),
  avatar_url: String (Cloudinary URL),
  gnb_coin_balance: Number (default: 100 on signup),
  
  // Relationships
  bro_registry: [ObjectId] (array of User IDs),
  
  // Inventory & Commerce
  personal_inventory: [{
    item_id, item_name, item_category, gulps_remaining, acquired_at
  }],
  offered_inventory: [{...}],
  transaction_ledger: [{
    description, amount, timestamp
  }],
  
  // Game Progress
  murtaugh_list_progress: {
    level_1 through level_10 (boolean flags)
  },
  profile_title: String,
  
  // Phase 4 Features
  bfh_theme_locked_until: Date,
  naked_man_fail_recorded: Boolean,
  naked_man_success_recorded: Boolean,
  daily_spend_total: Number,
  last_spend_date: String,
  
  // Timestamps
  last_dibs_used_at: Date,
  last_horn_received_at: Date,
  last_daily_claim_at: Date,
  is_first_login: Boolean,
  is_admin: Boolean,
  is_banned: Boolean,
  session_overdraft_count: Number,
  session_spend_total: Number,
  createdAt, updatedAt
}
```

### Message Schema
```
{
  sender_id: ObjectId (ref: User),
  table_id: String,
  content: String,
  type: String (enum: 'text' | 'image' | 'system'),
  image_url: String (Cloudinary URL, if type === 'image'),
  createdAt: Date
}
```

### Table Schema
```
{
  _id: String,
  name: String,
  type: String,
  x: Number, y: Number (coordinates on floor map)
}
```

## Authentication & Authorization

### JWT Flow
1. User registers/logs in → Backend validates credentials
2. Backend generates JWT token (7-day expiry)
3. Frontend stores token in AuthContext
4. Frontend includes token in all HTTP requests (Authorization header)
5. Frontend includes token in Socket.IO connection handshake

### Socket.IO Security
- JWT validation on every Socket.IO connection
- Unauthorized connections rejected immediately
- User context attached to socket for all event handlers

## Key Features & Implementation

### 1. Registration & Validation

**Endpoint**: `POST /api/auth/register`

**Validations**:
- Age must be >= 20 (returns: "Ted Mosby will meet you outside the pub.")
- Username must be alphanumeric + underscore only (returns: "We all have read the playbook!!")
- Username cannot contain reserved names: TedMosby, RobinScherbatsky, BarneyStinson, MarshallEriksen, LilyAldrin (returns: "This username is reserved for members of the main booth. Try another one, bro.")
- Username and email must be globally unique
- Password >= 6 characters

**New User Economy**:
- Initial balance: 100 GNB coins (reduced from 500)

### 2. Blue French Horn (BFH) Protocol

**Mechanics**:
- Costs 2000 GNB coins to initiate
- Can only be sent cross-gender
- Cannot be sent to someone on 3-month cooldown
- **New**: Cannot be sent to a Bro (checks bro_registry)
- 30-second response window
- Includes wingman voucher system for Bros to endorse the gesture
- Automatic refund if recipient disconnects during proposal

**Validation**: Before initiating BFH, system checks:
```javascript
const recipientIsBro = sender.bro_registry.some(
  broId => String(broId) === String(recipient_user_id)
);
if (recipientIsBro) return error;
```

### 3. Coin Economy & Transactions

**Daily Claims**:
- 100 GNB coins per claim (once per 24h)
- 5% chance Lucky Penny bonus (110 GNB)
- Tracked by `last_daily_claim_at`

**Spending**:
- Blue French Horn: 2,000 GNB
- Drinks: 50-200 GNB range
- Session tracking prevents overdraft

**Murtaugh List Progression**:
- 10 levels unlocked by completing game objectives
- Level 9: Spend >= 500 GNB in a session
- Reaching all 10 levels unlocks "[Too Old For This]" profile title

### 4. Bro Registry & Relationships

**Mechanics**:
- Users can add each other as Bros
- Max 50 Bros per user
- Bros Before Hoes validation prevents BFH to Bros
- Bros can vouch for BFH proposals via wingman mechanic
- Used to check gender-mixed pairs at tables

### 5. Pub Floor Interaction

**Table System**:
- 10+ named tables with capacity limits
- Real-time user presence tracking
- Shared chatbox per table
- Gender-specific washroom access

**Coordinates**:
- Admin can edit table coordinates via coordinate editor
- Interactive floor map shows real-time occupancy

### 6. Grinch Filter (Profanity Censorship)

**System**:
- Admin configurable banned keywords list
- Text censored before storage and broadcast
- Uses keyword matching (not ML-based)

## Backend Workflow

### User Connection Flow
1. Frontend logs in → receives JWT
2. Frontend connects Socket.IO with JWT in query
3. Backend validates JWT → attaches user to socket
4. User joins "pub_general" room
5. User status broadcast to all connected sockets

### Message Flow (Chatbox)
1. User types message in table chatbox
2. Frontend emits `chat:send` via Socket.IO
3. Backend receives → censors text via grinchFilter
4. Backend stores in Message collection
5. Backend broadcasts to table room subscribers
6. All clients in that room receive updated message history

### BFH Proposal Flow
1. Sender selects recipient and initiates BFH
2. Frontend emits `bfh:initiate` event
3. Backend validates:
   - Sufficient funds (2000 GNB)
   - Cross-gender requirement
   - Bro registry check (NEW)
   - 3-month cooldown check
4. Backend deducts 2000 GNB from sender
5. Backend broadcasts global BFH proposal
6. Recipient receives modal with 30-second timer
7. Recipient accepts/declines or times out
8. Backend updates coin balances and transaction ledgers
9. Wingman Bros notified to vouch if at same table

## Frontend Architecture

### Context Providers
- **AuthContext**: Stores JWT token, user profile, login/logout
- **SocketContext**: Manages Socket.IO connection, event listeners

### Component Hierarchy
```
App
├─ LoginPage (entry point for new/returning users)
├─ PubPage (main app container)
│  ├─ PubFloorMap (interactive floor with hotspots)
│  │  └─ EntryModal (confirm table entry)
│  ├─ TableChatbox (in-table messaging)
│  ├─ BFHModal (proposal response interface)
│  ├─ BFHBanner (BFH status broadcast)
│  ├─ BroRequestModal (relationship management)
│  ├─ WingmanModal (vouch for BFH)
│  ├─ BarMenuModal (drink ordering)
│  ├─ CoasterPlaceholder (inventory display)
│  ├─ DrinkCoaster (item interaction)
│  ├─ ThePlaybook (profile settings)
│  ├─ OnboardingTour (first-time walkthrough)
│  └─ Toast (notifications)
├─ CoordinateEditor (admin tool for table layout)
├─ BoardroomPage (admin dashboard)
└─ NotFound (404 handler)
```

### State Management
- React hooks (useState) for local component state
- Context API for global auth and socket state
- Socket.IO events drive real-time updates (no Redux)

## Deployment Architecture

### Frontend → Vercel
- Automatic deployment on push to main
- Environment variable: `VITE_BACKEND_URL` points to Railway backend
- Served over HTTPS with automatic SSL

### Backend → Railway
- Environment variables: MongoDB URI, JWT secret, Cloudinary keys, etc.
- Persistent Node.js server (not serverless)
- Socket.IO maintains long-lived connections
- Logs streamed to Railway dashboard

### Database → MongoDB Atlas
- Cloud-hosted MongoDB cluster
- Mongoose connection pool
- Automatic backups and scaling

### Media → Cloudinary
- Avatar storage (max 5MB per upload)
- Polaroid chat images (MIME validation: jpeg, png, gif, webp)
- URLs stored in MongoDB (not binary data)

## Error Handling & Validation

### Frontend
- API calls wrapped in try-catch
- User-facing error messages from backend
- Toast notifications for validation failures
- Form state resets on successful submission

### Backend
- All route handlers wrapped in try-catch
- HTTP status codes follow REST conventions:
  - 400: Validation errors
  - 401: Authentication failures
  - 403: Forbidden (banned users)
  - 409: Conflict (duplicate username/email)
  - 500: Server errors
- Detailed error messages for debugging

## Security Considerations

1. **Password Security**: bcryptjs with 12 salt rounds
2. **JWT**: 7-day expiry, signed with secret key
3. **CORS**: Restricted to Vercel frontend URL
4. **File Upload**: Multer + Cloudinary MIME validation
5. **Profanity**: Keyword-based censorship before storage
6. **Ban System**: Admins can permanently ban users
7. **Rate Limiting**: Not yet implemented (future enhancement)

## Future Enhancements

1. Rate limiting on API endpoints
2. Caching layer (Redis) for frequently accessed data
3. Message pagination instead of full history load
4. Real-time presence indicators
5. Direct messaging (DM) system
6. Mobile app (React Native)
7. Admin dashboard analytics
8. User reputation/karma system
