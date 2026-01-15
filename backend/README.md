# Backend API

This is the backend API server for Profit Pilot.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env` (already configured with MongoDB connection)
   - Update `.env` if needed with your specific configuration

3. Start the development server:
```bash
npm run dev
```

4. Start the production server:
```bash
npm start
```

## MongoDB Connection

The backend is configured to connect to MongoDB Atlas using the provided connection string. The connection is established automatically when the server starts.

## Project Structure

```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── config/         # Configuration files
│   ├── utils/          # Utility functions
│   └── index.js        # Entry point
├── package.json
└── README.md
```
