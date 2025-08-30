class TouchDesignerWebRTCClient {
    constructor() {
        this.socket = io();
        this.peerConnection = null;
        this.remoteVideo = document.getElementById('remoteVideo');
        this.statusDiv = document.getElementById('status');
        this.logsDiv = document.getElementById('logs');
        
        this.setupSocketListeners();
        this.setupWebRTCConfig();
        
        this.log('Client initialized');
    }
    
    setupWebRTCConfig() {
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.log('Connected to signaling server');
            this.socket.emit('register', { type: 'browser' });
            this.updateStatus('Connected to server', 'status-online');
        });
        
        this.socket.on('disconnect', () => {
            this.log('Disconnected from signaling server');
            this.updateStatus('Disconnected from server', 'status-offline');
        });
        
        this.socket.on('touchdesigner-online', () => {
            this.log('TouchDesigner is online');
            this.updateStatus('TouchDesigner online - Ready to connect', 'status-online');
        });
        
        this.socket.on('touchdesigner-offline', () => {
            this.log('TouchDesigner went offline');
            this.updateStatus('TouchDesigner offline', 'status-offline');
            this.disconnectFromStream();
        });
        
        this.socket.on('offer', async (data) => {
            this.log('Received offer from TouchDesigner');
            await this.handleOffer(data);
        });
        
        this.socket.on('ice-candidate', async (data) => {
            if (this.peerConnection && data.candidate) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    this.log('Added ICE candidate');
                } catch (error) {
                    this.log('Error adding ICE candidate: ' + error.message);
                }
            }
        });
    }
    
    async connectToStream() {
        this.log('Attempting to connect to TouchDesigner stream...');
        this.updateStatus('Connecting to stream...', 'status-connecting');
        
        try {
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            this.setupPeerConnectionListeners();
            
            // Wait for offer from TouchDesigner
            this.socket.emit('request-stream');
            
            document.getElementById('connectBtn').disabled = true;
            document.getElementById('disconnectBtn').disabled = false;
            
        } catch (error) {
            this.log('Error connecting: ' + error.message);
            this.updateStatus('Connection failed', 'status-offline');
        }
    }
    
    async handleOffer(data) {
        if (!this.peerConnection) {
            this.log('No peer connection available for offer');
            return;
        }
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', { answer: answer });
            this.log('Sent answer to TouchDesigner');
            
        } catch (error) {
            this.log('Error handling offer: ' + error.message);
        }
    }
    
    setupPeerConnectionListeners() {
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { candidate: event.candidate });
                this.log('Sent ICE candidate');
            }
        };
        
        this.peerConnection.ontrack = (event) => {
            this.log('Received remote stream');
            this.remoteVideo.srcObject = event.streams[0];
            this.updateStatus('Stream connected!', 'status-online');
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            this.log(`Connection state: ${state}`);
            
            if (state === 'connected') {
                this.updateStatus('Stream active', 'status-online');
            } else if (state === 'disconnected' || state === 'failed') {
                this.updateStatus('Stream disconnected', 'status-offline');
            }
        };
    }
    
    disconnectFromStream() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.remoteVideo.srcObject = null;
        this.updateStatus('Disconnected', 'status-offline');
        this.log('Disconnected from stream');
        
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('disconnectBtn').disabled = true;
    }
    
    updateStatus(message, className) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = className;
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logsDiv.appendChild(logEntry);
        this.logsDiv.scrollTop = this.logsDiv.scrollHeight;
        console.log(message);
    }
}

// Initialize client when page loads
window.addEventListener('load', () => {
    window.webrtcClient = new TouchDesignerWebRTCClient();
});

// Global functions for buttons
function connectToStream() {
    window.webrtcClient.connectToStream();
}

function disconnectFromStream() {
    window.webrtcClient.disconnectFromStream();
}
