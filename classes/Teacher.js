const config = require('../config/config');

class Teacher {
    constructor(teacherId, teacherName, socket) {
        this.teacherId = teacherId;
        this.teacherName = teacherName;
        this.socket = socket;
        this.downstreamTransport = null; // need 1 transport since same router
        this.consumers = new Map(); // Danh sách Consumer (để nhận video từ Student)
        this.room = null; // Phòng học
    }

    addTransport() {
        return new Promise(async (resolve, reject) => {
            const { listenInfos, maxIncomingBitrate, initialAvailableOutgoingBitrate, iceServers, enableUdp, enableTcp, preferUdp, iceTransportPolicy } = config.webRtcTransport;
            
            try {
                const transport = await this.room.router.createWebRtcTransport({
                    listenInfos: listenInfos,
                    enableUdp: enableUdp,
                    enableTcp: enableTcp,
                    preferUdp: preferUdp,
                    initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
                    iceServers: iceServers,
                    iceTransportPolicy: iceTransportPolicy
                });
                
                console.log("Teacher WebRTC transport created with ID:", transport.id);
                
                if (maxIncomingBitrate) {
                    try {
                        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
                    } catch (error) {
                        console.error("error setting max incoming bitrate", error)
                    }
                }
                
                // Log transport info
                console.log("ICE parameters:", transport.iceParameters);
                console.log("ICE candidates count:", transport.iceCandidates.length);
                
                const clientTransportParams = {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                }
                
                this.downstreamTransport = transport;
                
                // Theo dõi trạng thái của transport
                transport.observer.on('close', () => {
                    console.log('Teacher transport closed');
                });
                
                transport.observer.on('icestatechange', (iceState) => {
                    console.log('Teacher transport ICE state changed to', iceState);
                });
                
                resolve(clientTransportParams);
            } catch (error) {
                console.error("Error creating WebRTC transport:", error);
                reject(error);
            }
        });
    }

    // only video first
    addConsumer(studentId, newConsumer) {
        this.consumers.set(studentId, newConsumer);
    }

}

module.exports = Teacher;