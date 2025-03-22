const joinForm = document.getElementById('joinForm');
const videoGrid = document.getElementById('videoGrid');
const studentList = document.getElementById('studentList');

let device = null;
let recvTransport = null;
let videoConsumers = [];

// connect to socket
// socket connection
const socket = io.connect('http://localhost:3030')
socket.on('connect', () => {
    console.log("Connected")
})

// create consumer transport function
const createConsumerTransport = async (device, socket) => new Promise(async (resolve, reject) => {
    const transportParams = await socket.emitWithAck('requestTransport', { type: "consumer" });
    console.log(transportParams, "transportParams")
    const consumerTransport = device.createRecvTransport(transportParams);

    recvTransport = consumerTransport;
    recvTransport.on('connectionstatechange', state => {
        console.log("....connection state change....")
        console.log(state)
    })
    recvTransport.on('icegatheringstatechange', state => {
        console.log("....ice gathering change....")
        console.log(state)
    })

    recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        console.log("Transport connect event has fired!")
        // connect comes with local dtlsParameters. We need
        // to send these up to the server, so we can finish
        // the connection
        const connectResp = await socket.emitWithAck('connectTransport', { dtlsParameters, type: "consumer" })
        console.log(connectResp, "connectResp is back!")
        if (connectResp === "success") {
            callback() //this will finish our await consume
        } else {
            errback()
        }
    })
    resolve(consumerTransport);
});

// create consumer function test with one consumer
const createConsumer = async (consumerTransport, device, socket) => {
    return new Promise(async (resolve, reject) => {
        // consume from the basics, emit the consumeMedia event, we take
        // the params we get back, and run .consume(). That gives us our track
        const consumerParams = await socket.emitWithAck('consumeMedia', { rtpCapabilities: device.rtpCapabilities })
        console.log(consumerParams)
        if (consumerParams === "cannotConsume") {
            console.log("Cannot consume")
            resolve()
        } else if (consumerParams === "consumeFailed") {
            console.log("Consume failed...")
            resolve()
        } else {
            // we got valid params! Use them to consume
            const consumer = await consumerTransport.consume(consumerParams)
            resolve(consumer)
        }
    })
}

joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomId = document.getElementById('roomId').value;
    const id = document.getElementById('teacherId').value;
    const name = document.getElementById('teacherName').value;

    // send to server that we want to join room
    const joinRes = await socket.emitWithAck("joinRoom", { roomId, id, name, type: "teacher" });
    console.log(joinRes);
    joinRes.members.forEach(member => {
        const li = document.createElement('li');
        li.innerHTML = `${member.studentName} - ${member.studentId}`;
        console.log(li);
        studentList.appendChild(li);
    });

    // Tạo device Mediasoup
    try {
        device = new mediasoupClient.Device();
    } catch (error) {
        if (error.name === 'UnsupportedError') {
            console.warn("browser not supported");
        }
    }
    await device.load({ routerRtpCapabilities: joinRes.routerRtpCapabilities });

    // Tạo recvTransport để nhận video từ học sinh
    recvTransport = await createConsumerTransport(device, socket);

    const consumer = await createConsumer(recvTransport, device, socket);
    console.log(consumer, "consumer")

    // add the consumer to the array
    videoConsumers.push(consumer);

    console.log("consume() has finished")
    const { track } = consumer
    console.log("Track properties:", track.muted, track.enabled, track.readyState)

    track.addEventListener("ended", () => {
        console.log("Track has ended")
    });

    // Create a new MediaStream with the track
    const stream = new MediaStream([track]);

    // Attach the stream to the video element
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    videoWrapper.appendChild(video);
    videoGrid.appendChild(videoWrapper);

    console.log("Track is ready... we need to unpause")
    // unpause - using producerId to identify the consumer
    const result = await socket.emitWithAck('unpauseConsumer', { producerId: consumer.producerId });
    console.log("Unpause result:", result);
});


socket.on("updateStudentList", (data) => {
    console.log("Cập nhật danh sách học sinh:", data.members);

    // Xóa danh sách cũ
    studentList.innerHTML = "";

    // Cập nhật danh sách mới
    data.members.forEach(member => {
        const li = document.createElement("li");
        li.innerHTML = `${member.studentName} - ${member.studentId}`;
        studentList.appendChild(li);
    });
});