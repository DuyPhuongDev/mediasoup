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
            // this.downstreamTransport.push(transport);
            this.downstreamTransport = transport;
            resolve(clientTransportParams)
        });
    }

    // only video first
    addConsumer(studentId, newConsumer) {
        this.consumers.set(studentId, newConsumer);
    }

}

module.exports = Teacher;