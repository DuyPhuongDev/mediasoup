const config = require('../config/config');
class Student {
    constructor(studentId, studentName, socket) {
        this.studentId = studentId;
        this.studentName = studentName
        this.socket = socket;
        this.upstreamTransport = null; // Producer Transport
        this.producer = {}; // Video Producer
        this.room = null; // Phòng học
    }

    addTransport() {
        return new Promise(async (resolve, reject) => {
            const { listenInfos, maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.webRtcTransport;
            const transport = await this.room.router.createWebRtcTransport({
                enableUdp: true,
                enableTcp: true, // always use UDP unless we can't
                preferUdp: true, // use UDP if possible
                listenInfos: listenInfos,
                initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
            })
            if (maxIncomingBitrate) {
                try {
                    await transport.setMaxIncomingBitrate(maxIncomingBitrate);
                } catch (error) {
                    console.error("error setting max incoming bitrate", error)
                }
            }
            // console.log(transport)
            const clientTransportParams = {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }
            this.upstreamTransport = transport;
            resolve(clientTransportParams)
        });
    }

    // only save video producer
    addProducer(newProducer) {
        this.producer = newProducer;
    }
}

module.exports = Student;