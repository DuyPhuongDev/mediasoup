const config = {
    frontEndPort: 5173,
    backEndPort: 3030,
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
                ip: '0.0.0.0'
            },
            {
                protocol: 'tcp',
                ip: '0.0.0.0'
            }
        ],
        maxIncomingBitrate: 5000000, // 5mbps
        initialAvailableOutgoingBitrate: 5000000, // 5mbps
    }
}

module.exports = config;