import express from 'express';

const app = express();
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Mock data for testing
let mockCalls = [
  {
    id: 1,
    phoneNumber: "+15551234567",
    callerName: "John Smith",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    action: "blocked",
    riskScore: 85,
    reason: "High spam score",
    source: "modem"
  },
  {
    id: 2,
    phoneNumber: "+15559876543",
    callerName: "Jane Doe",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    action: "allowed",
    riskScore: 15,
    reason: "Low risk caller",
    source: "modem"
  }
];

// API endpoints for Monitor testing
app.get("/api/user/calls", (req, res) => {
  console.log("📞 GET /api/user/calls - Returning mock call data");
  res.json(mockCalls);
});

app.post("/api/admin/test-call", (req, res) => {
  const { phoneNumber, action = 'allowed', riskScore = 0.1, reason = 'Test call' } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  const newCall = {
    id: Date.now(),
    phoneNumber,
    callerName: `Test Caller ${phoneNumber.slice(-4)}`,
    timestamp: new Date().toISOString(),
    action,
    riskScore,
    reason,
    source: 'test'
  };

  mockCalls.unshift(newCall); // Add to beginning of array

  console.log("🔔 POST /api/admin/test-call - Created test call:", newCall);

  res.json({
    message: "Test call logged successfully",
    callLog: newCall
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Monitor test server running" });
});

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Monitor Test Server running on port ${PORT}`);
  console.log(`📊 Mock API endpoints ready for testing`);
  console.log(`🌐 Frontend should be accessible at http://localhost:3001`);
});