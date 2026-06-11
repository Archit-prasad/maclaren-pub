// CORS Configuration for MacLaren's Pub
// Supports development and production environments

const ALLOWED_ORIGINS = [
  // Development
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  // Environment variables (production)
  process.env.FRONTEND_URL,
  process.env.VERCEL_FRONTEND_URL,
].filter(Boolean);

const corsConfig = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Log rejected origins in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`CORS blocked origin: ${origin}`);
    }

    callback(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

module.exports = corsConfig;
