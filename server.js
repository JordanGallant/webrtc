const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// Store connected clients
const clients = new Map();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Register client type (TouchDesigner or Browser)
  socket.on('register', (data) => {
    clients.set(socket.id, {
      type: data.type, // 'touchdesigner' or 'browser'
      socket: socket
    });
    console.log(`Registered ${data.type}: ${socket.id}`);
    
    // Notify browsers when TouchDesigner connects
    if (data.type === 'touchdesigner') {
      broadcastToBrowsers('touchdesigner-online', { message: 'TouchDesigner is online' });
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    console.log('Received offer from TouchDesigner');
    broadcastToBrowsers('offer', data);
  });

  socket.on('answer', (data) => {
    console.log('Received answer from browser');
    broadcastToTouchDesigner('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    console.log('Received ICE candidate');
    // Forward to appropriate clients
    if (clients.get(socket.id)?.type === 'touchdesigner') {
      broadcastToBrowsers('ice-candidate', data);
    } else {
      broadcastToTouchDesigner('ice-candidate', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const client = clients.get(socket.id);
    if (client?.type === 'touchdesigner') {
      broadcastToBrowsers('touchdesigner-offline', { message: 'TouchDesigner disconnected' });
    }
    clients.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Helper functions
function broadcastToBrowsers(event, data) {
  clients.forEach((client) => {
    if (client.type === 'browser') {
      client.socket.emit(event, data);
    }
  });
}

function broadcastToTouchDesigner(event, data) {
  clients.forEach((client) => {
    if (client.type === 'touchdesigner') {
      client.socket.emit(event, data);
    }
  });
}

// Serve the client HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to check server status
app.get('/status', (req, res) => {
  const touchdesignerOnline = Array.from(clients.values()).some(c => c.type === 'touchdesigner');
  const browserCount = Array.from(clients.values()).filter(c => c.type === 'browser').length;
  
  res.json({
    status: 'online',
    touchdesigner: touchdesignerOnline,
    browsers: browserCount,
    totalClients: clients.size
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the client`);
});
