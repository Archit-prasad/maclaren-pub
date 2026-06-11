# MacLaren's Pub 🍺
<img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDFpNDFrZW4xM2pzNDJicmJ0a2hsamw1bG0wdWJ5dnJhZTUzaW1iOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/B0yP8p6NSfboY/giphy.gif" width="100%" height="20%" alt="HIMYM">
A gamified, real-time social chat application themed around the iconic MacLaren's Pub from *How I Met Your Mother*.

## 🎯 Overview

Welcome to **MacLaren's Pub** — a multiplayer, coin-based social gaming experience where you can:

- **Chat** in real-time with other users across themed pub tables
- **Earn & Spend** GNB coins through daily claims and game activities
- **Romance** others with the legendary Blue French Horn (if they're not your Bro!)
- **Manage** your Bro Registry and social relationships
- **Unlock** achievements via the Murtaugh List progression system
- **Order** drinks and manage your personal inventory
- **Play** mini-games and earn profile titles

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and npm/yarn
- **MongoDB Atlas** account (free tier works)
- **Cloudinary** account (for avatar/image storage)
- **Git** for cloning the repo

### Environment Setup

#### Backend `.env` file

Create `backend/.env`:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/maclaren-pub

# Authentication
JWT_SECRET=your-super-secret-key-min-32-chars

# Server
PORT=4000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
VERCEL_FRONTEND_URL=https://your-vercel-domain.vercel.app

# Cloudinary (for avatar/image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Frontend `.env` file

Create `frontend/.env.local`:

```env
VITE_BACKEND_URL=http://localhost:4000
```

### Installation & Running

#### Backend

```bash
cd backend
npm install
npm start
# Server runs on http://localhost:4000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
# App opens on http://localhost:5173
```

## 🎮 How to Play

### 1. Register & Join

1. Navigate to the login page
2. Click **Register**
3. Fill in your details:
   - **Username**: Alphanumeric + underscore only (no spaces or special chars)
   - **Age**: Must be 20 or older
   - **Gender**: Select your gender
   - **Email** & **Password**: Standard auth fields
4. Click **Enter the Pub**
5. You start with **100 GNB coins**

> ⚠️ Note: You cannot use these reserved usernames:
> - TedMosby
> - RobinScherbatsky
> - BarneyStinson
> - MarshallEriksen
> - LilyAldrin

### 2. Navigate the Pub Floor

- Interact with **tables** and **hotspots** on the floor map
- Click to enter a table and join the chatbox
- View other users at your table in real-time

### 3. Chat & Message

- Type messages in the **TableChatbox** while at a table
- Upload **Polaroid photos** (jpg, png, gif, webp only)
- View message history (last 50 messages)
- System messages announce users entering/leaving

### 4. Earn & Spend GNB Coins

#### Daily Claim
- Click **Daily Claim** button to earn **100 GNB**
- 5% chance of **Lucky Penny** (110 GNB instead)
- Available once every 24 hours

#### Spending
- **Blue French Horn**: 2,000 GNB (romantic gesture)
- **Drinks**: 50–200 GNB (via Bar Menu)
- **Sandwich**: 100 GNB (Murtaugh List mini-game)

#### Transaction Ledger
- View all coin transactions in **The Playbook** settings
- Track spending and historical claims

### 5. Blue French Horn (The Romance Protocol)

The legendary **Blue French Horn** is the ultimate romantic gesture:

1. **Initiate** → Select a recipient (must be different gender)
2. **Pay** → 2,000 GNB coins
3. **Recipient gets 30 seconds** to Accept or Decline
4. **Wingman Vouching** → Your Bros can vouch to strengthen the gesture
5. **Refund** → If declined or if recipient disconnects, you get 2,000 GNB back

> ⚠️ **Important**: You **CANNOT** send a Blue French Horn to your Bro!
> - The romance protocol only works if you are not officially Bros.
> - Check your Bro Registry before attempting.

### 6. Manage Your Bro Registry

- Add other users as **Bros** to build your network
- Max **50 Bros** per user
- **Bros can vouche** for your Blue French Horn proposals
- Use Bros for team-based gameplay

### 7. The Playbook (Settings)

Access **The Playbook** to:

- **View/Update Profile**: Change avatar, gender, profile title
- **Transaction History**: See all coin transactions
- **Inventory**: View your drinks and items
- **Murtaugh List Progress**: Track your achievement levels
- **Logout**: Leave the pub

### 8. Murtaugh List Achievements

Unlock **10 levels** by completing objectives:

- **Level 1–8**: Complete various gameplay challenges
- **Level 9**: Spend ≥500 GNB coins in one session
- **Level 10**: Complete all achievements
- **Reward**: Unlock the **[Too Old For This]** profile title

## 🏗️ Project Structure

```
maclaren-pub/
├── frontend/                    # React + Vite app
│   ├── src/
│   │   ├── api/                 # API client functions
│   │   │   └── auth.js          # Auth endpoints
│   │   ├── components/          # React components
│   │   │   ├── LoginPage.jsx
│   │   │   ├── PubFloorMap.jsx
│   │   │   ├── TableChatbox.jsx
│   │   │   ├── BFHModal.jsx
│   │   │   ├── BarMenuModal.jsx
│   │   │   ├── ThePlaybook.jsx
│   │   │   └── ...
│   │   ├── contexts/            # React Context (auth, socket)
│   │   └── pages/               # Route pages
│   ├── public/assets/           # Static images & audio
│   └── package.json
│
├── backend/                     # Node.js + Express server
│   ├── models/                  # Mongoose schemas
│   │   ├── User.js
│   │   ├── Message.js
│   │   ├── Table.js
│   │   └── BannedKeyword.js
│   ├── routes/                  # HTTP route handlers
│   │   ├── auth.js              # Registration, login
│   │   ├── chat.js              # Message history, uploads
│   │   ├── coins.js             # Daily claims, ledger
│   │   └── admin.js             # Admin moderation
│   ├── sockets/                 # Socket.IO event handlers
│   │   ├── phase4.js            # BFH, Bro Registry, Wingman
│   │   └── ...
│   ├── middleware/              # Express middleware
│   │   ├── auth.js              # JWT validation
│   │   └── grinchFilter.js      # Profanity censorship
│   ├── lib/                     # Utility functions
│   │   ├── cloudinary.js        # Image upload logic
│   │   └── ...
│   ├── server.js                # Main entry point
│   └── package.json
│
├── architecture.md              # System architecture docs
├── README.md                    # This file
└── .gitignore
```

## 🔐 Authentication

### Registration Validation

When registering, the following checks are performed:

| Field | Validation | Error Message |
|-------|-----------|---------------|
| Age | Must be ≥20 | "Ted Mosby will meet you outside the pub." |
| Username | Alphanumeric + `_` only | "We all have read the playbook!!" |
| Username | Cannot be reserved name | "This username is reserved for members of the main booth. Try another one, bro." |
| Username | Must be unique | "We all have read the playbook!!" |
| Email | Must be unique | "Email already taken." |
| Password | ≥6 characters | "Password must be at least 6 characters." |

### JWT Tokens

- **Expiry**: 7 days
- **Stored**: Frontend localStorage
- **Validated**: On every API request + Socket.IO connection
- **Refreshed**: Automatic via `/api/auth/me` endpoint

## 🎨 Features

### Real-Time Chat
- WebSocket-powered messaging via Socket.IO
- Message history (last 50 per table)
- Image uploads with Polaroid styling
- System messages for user activity

### Coin Economy
- Dynamic balance tracking
- Transaction ledger with full history
- Spend tracking per session
- Overdraft protection

### Social Features
- Real-time user presence (online/offline)
- Bro Registry (friendship system)
- Status indicators (active/AFK/etc)
- Wingman vouch system

### Game Mechanics
- Murtaugh List progression (10 levels)
- Blue French Horn romance protocol
- Drink economy & inventory management
- Lucky Penny daily bonus

### Admin Tools
- Ban/unban users
- Add/remove profanity keywords
- Kick users from tables
- View activity logs

## 📱 API Endpoints

### Authentication

```
POST   /api/auth/register         # Create new user
POST   /api/auth/login            # Sign in
GET    /api/auth/me               # Get current user profile
POST   /api/auth/complete_onboarding  # Mark tour as done
```

### Chat

```
GET    /api/chat/history/:table_id  # Fetch message history
POST   /api/chat/upload             # Upload image to Cloudinary
```

### Coins

```
POST   /api/coins/daily_claim     # Claim daily GNB
GET    /api/coins/ledger          # View transaction history
```

### Admin

```
POST   /api/admin/ban_user        # Ban a user
POST   /api/admin/add_keyword     # Add profanity keyword
GET    /api/admin/stats           # View BFH/activity stats
```

## 🔌 WebSocket Events

### Chat Events

```
chat:send                         # Send message to table
chat:message                      # Receive message (broadcast)
chat:history                      # Load message history
chat:user_joined                  # User entered table
chat:user_left                    # User left table
```

### BFH Events

```
bfh:initiate                      # Sender proposes
bfh:proposal                      # Recipient receives proposal
bfh:respond                       # Recipient accepts/declines
bfh:global_broadcast              # All users see status
bfh:wingman_available             # Bros can vouch
bfh:wingman_vouch                 # Wingman endorses
```

### Bro Events

```
bro:request                       # Send bro request
bro:respond                       # Accept/decline bro request
bro:registry_updated              # Bro list changed
```

### User Status Events

```
user:join_table                   # User joins table
user:leave_table                  # User leaves table
user:status_changed               # Status updated (online/AFK)
```

## 🐛 Troubleshooting

### Cannot Register

**Issue**: "Ted Mosby will meet you outside the pub."
- **Solution**: Ensure your age is 20 or older.

**Issue**: "We all have read the playbook!!"
- **Solution**: Username must contain only letters, numbers, and underscores. No spaces or special characters.

**Issue**: "This username is reserved for members of the main booth. Try another one, bro."
- **Solution**: Avoid these reserved names: TedMosby, RobinScherbatsky, BarneyStinson, MarshallEriksen, LilyAldrin.

### WebSocket Connection Issues

1. Check that backend is running: `http://localhost:4000/health`
2. Verify CORS config in `backend/server.js`
3. Check browser console for connection errors
4. Ensure JWT is valid and not expired

### Cannot Send Blue French Horn

**Issue**: "Bros Before Hoes: You cannot send the Blue French Horn to your Bro."
- **Solution**: You cannot send a Blue French Horn to someone in your Bro Registry. Remove them first if you want to send the gesture.

**Issue**: "Insufficient funds" / "Artillery Arthur"
- **Solution**: You need 2,000 GNB coins. Use the Daily Claim or check the Bar Menu prices.

### Image Upload Fails

**Issue**: "Carl only allows photos. No documents at the bar."
- **Solution**: Only JPEG, PNG, GIF, and WebP images are allowed. Convert or re-export your file.

## 🚀 Deployment

### Deploy to Vercel (Frontend)

1. Push code to GitHub
2. Connect repo to Vercel
3. Set environment variable: `VITE_BACKEND_URL`
4. Auto-deploy on every push to `main`

### Deploy to Railway (Backend)

1. Create Railway project
2. Connect GitHub repo
3. Add environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `CLOUDINARY_CLOUD_NAME` (etc.)
4. Deploy from dashboard or via CLI

### Database Backups (MongoDB Atlas)

1. Atlas handles automatic daily backups
2. Manual snapshots available in Atlas dashboard
3. Point-in-time restore available for recent snapshots

## 📖 Additional Documentation

For detailed system architecture and technical design, see [`architecture.md`](./architecture.md).

## 🤝 Contributing

This is a personal/hobby project. For suggestions or issues:

1. Test thoroughly in development
2. Document changes clearly
3. Follow existing code style
4. Test all validation flows

## 📄 License

This project is personal and not licensed for commercial use.

## 🎬 Credits

Themed around **How I Met Your Mother** — the iconic sitcom by Carter Bays and Craig Thomas.

---

**Questions?** Check the [architecture.md](./architecture.md) for technical details, or review the component code for specific feature implementations.

**Have fun at the pub!** 🍺
