require('dotenv').config(); // this is important!
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;
const BACKEND_PORT = process.env.BACKEND_PORT || 3030;
const ANNOUNCED_IP = process.env.ANNOUNCED_IP || '127.0.0.1';
console.log('FRONTEND_PORT: ', FRONTEND_PORT);
console.log('BACKEND_PORT: ', BACKEND_PORT);
console.log('ANNOUNCED_IP: ', ANNOUNCED_IP);
console.log('FE_URL: ', process.env.FE_URL || 'http://localhost:3000');
const config = {
    frontEndPort: FRONTEND_PORT,
    backEndPort: BACKEND_PORT,
    workerSettings: {
        rtcMinPort: 40000,
        rtcMaxPort: 41000,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
        ]
    },
    mediaCodecs: [
        {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
        },
        {
            kind: 'video',
            mimeType: 'video/H264',
            clockRate: 90000,
            parameters: {}
        }
    ],
    webRtcTransport: {
        listenInfos: [
            {
                protocol: 'udp',
                ip: '0.0.0.0',
                announcedIp: ANNOUNCED_IP
            },
            {
                protocol: 'tcp',
                ip: '0.0.0.0',
                announcedIp: ANNOUNCED_IP
            }
        ],
        iceServers: [
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302'
                ]
            }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        maxIncomingBitrate: 10000000, // 10mbps
        initialAvailableOutgoingBitrate: 5000000, // 5mbps
        iceTransportPolicy: 'all'
    }
}

module.exports = config;