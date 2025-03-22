
const joinForm = document.getElementById('joinForm');
const localVideo = document.getElementById('localVideo');

let device = null
let localStream = null
let producerTransport = null
let videoProducer = null

// socket connection
const socket = io.connect('http://localhost:3030')
socket.on('connect', () => {
    console.log("Connected")
})

// create producer transport function
const createProducerTransport = (socket, device) => new Promise(async (resolve, reject) => {
    const producerTransportParams = await socket.emitWithAck('requestTransport', { type: "producer" })
    const producerTransport = device.createSendTransport(producerTransportParams)

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        console.log("Connect running on produce...")
        const connectResp = await socket.emitWithAck('connectTransport', { dtlsParameters, type: "producer" })
        console.log(connectResp, "connectResp is back")
        if (connectResp === "success") {
            // we are connected! move forward
            callback()
        } else if (connectResp === "error") {
            // connection failed. Stop
            errback()
        }
    })
    producerTransport.on('produce', async (parameters, callback, errback) => {
        // emit startProducing
        console.log("Produce event is now running")
        console.log(parameters)
        const { kind, rtpParameters } = parameters
        const produceResp = await socket.emitWithAck('startProducing', { kind, rtpParameters })
        console.log(produceResp, "produceResp is back!")
        if (produceResp === "error") {
            errback()
        } else {
            // only other option is the producer id
            callback({ id: produceResp })
        }
    })
    resolve(producerTransport)
})

// create producer function
const createProducer = (localStream, producerTransport) => {
    return new Promise(async (resolve, reject) => {
        //get the video track
        const videoTrack = localStream.getVideoTracks()[0]
        try {
            console.log("Calling produce on video")
            const producer = await producerTransport.produce({ track: videoTrack })
            console.log("finished producing!")
            resolve(producer)
        } catch (err) {
            console.log(err, "error producing")
        }
    })
}

const joinRoom = async (e) => {
    e.preventDefault();
    console.log("join room");
    const roomId = document.getElementById('roomId').value;
    const id = document.getElementById('studentId').value;
    const name = document.getElementById('studentName').value;
    // create new device
    try {
        device = new mediasoupClient.Device();
    } catch (error) {
        if (error.name === 'UnsupportedError') {
            console.warn("browser not supported");
        }
    }

    // send to server that we want to join room
    const joinRes = await socket.emitWithAck("joinRoom", { roomId, id, name, type: "student" });
    console.log(joinRes);
    // get router rtpCapabilities
    await device.load({ routerRtpCapabilities: joinRes.routerRtpCapabilities });

    // set local stream with only video
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideo.srcObject = localStream;

    // create producer transport
    producerTransport = await createProducerTransport(socket, device);

    videoProducer = await createProducer(localStream, producerTransport)
    console.log(videoProducer, "videoProducer")
}

joinForm.addEventListener('submit', joinRoom)