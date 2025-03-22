// local server
const http = require('http'); // we need this to create an HTTP server

// express setup the https server
const express = require('express');
const app = express();
app.use(express.static('public'));

// local server
const httpServer = http.createServer(app);

const socketio = require('socket.io');
const mediasoup = require('mediasoup');

const config = require('./config/config');
const createWokers = require('./utils/createWorkers');
const getWorker = require('./utils/getWorker');
const Student = require('./classes/Student');
const Teacher = require('./classes/Teacher');
const Room = require('./classes/Room');

// local server
const io = socketio(httpServer, {
    cors: [`http://localhost:${config.backEndPort}`]
})

// init worker, it's where our mediasoup live
let workers = null;
const rooms = [];

// init mediasoup gets mediasoup ready to use
const initMediaSoup = async () => {
    workers = await createWokers();
    router = await workers[0].createRouter({ mediaCodecs: config.mediaCodecs });
}

initMediaSoup();  // build our mediasoup server/sfu

// socket.io listeners
io.on('connection', socket => {
    let student = null;
    let teacher = null;
    const handshake = socket.handshake;
    socket.on("joinRoom", async ({ roomId, id, name, type }, ack) => {
        let newRoom = false
        let requestedRoom = rooms.find(room => room.roomId === roomId)
        if (type === "student") {
            student = new Student(id, name, socket);
            if (!requestedRoom) {
                newRoom = true
                // make the new room, add a worker, add a router
                const workerToUse = await getWorker(workers)
                requestedRoom = new Room(roomId, workerToUse)
                await requestedRoom.createRouter(io)
                rooms.push(requestedRoom)
            }

            // add the room to the student
            student.room = requestedRoom
            // add the student to the Room students
            student.room.addStudent(student)
            // add this socket to the socket room
            socket.join(student.room.roomId)
            // Gửi danh sách cập nhật đến giáo viên
            io.to(student.room.roomId).emit("updateStudentList", {
                members: student.room.students.map(s => ({
                    studentId: s.studentId,
                    studentName: s.studentName
                }))
            });
            ack({
                routerRtpCapabilities: student.room.router.rtpCapabilities,
                newRoom,
                numOfMembers: student.room.students.length
            });
        } else if (type === "teacher") {
            teacher = new Teacher(id, name, socket);
            if (!requestedRoom) {
                newRoom = true
                // make the new room, add a worker, add a router
                const workerToUse = await getWorker(workers)
                requestedRoom = new Room(roomId, workerToUse)
                await requestedRoom.createRouter(io)
                rooms.push(requestedRoom)
            }
            // add the room to the teacher
            teacher.room = requestedRoom
            // add the teacher to the Room teacher
            teacher.room.addTeacher(teacher)
            // add this socket to the socket room
            socket.join(teacher.room.roomId)

            ack({
                routerRtpCapabilities: teacher.room.router.rtpCapabilities,
                newRoom,
                members: teacher.room.students.map(student => ({
                    studentId: student.studentId,
                    studentName: student.studentName
                }))
            });
        }
    });

    socket.on('requestTransport', async ({ type }, ack) => {
        // whether producer or consumer, client needs params
        let transportParams;
        if (type === "producer") {
            // run addClient, which is part of our Client class
            transportParams = await student.addTransport();
        } else if (type === "consumer") {
            transportParams = await teacher.addTransport();
        }
        ack(transportParams)
    })

    socket.on('connectTransport', async ({ dtlsParameters, type }, ack) => {
        if (type === "producer") {
            try {
                await student.upstreamTransport.connect({ dtlsParameters })
                ack("success")
            } catch (error) {
                console.log(error)
                ack('error')
            }
        } else if (type === "consumer") {
            // find the right transport, for this consumer
            try {
                await teacher.downstreamTransport.connect({ dtlsParameters })
                ack("success")
            } catch (err) {
                console.log(err)
                ack('error')
            }
        }
    })

    socket.on('startProducing', async ({ kind, rtpParameters }, ack) => {
        // create a producer with the rtpParameters we were sent
        try {
            const newProducer = await student.upstreamTransport.produce({ kind, rtpParameters })
            //add the producer to this client obect
            student.addProducer(newProducer)
            // the front end is waiting for the id
            ack(student.producer.id)
        } catch (err) {
            console.log(err)
            ack(err)
        }
    })

    socket.on('consumeMedia', async ({ rtpCapabilities }, ack) => {
        try {
            if (teacher.room.students.length === 0) {
                ack("noStudent")
            } else if (!teacher.room.router.canConsume({ producerId: teacher.room.students[0].producer.id, rtpCapabilities })) {
                ack("cannotConsume")
            } else {
                // we can consume!
                // find the student index
                const studentIndex = 0;
                const student = teacher.room.students[studentIndex];
                const downstreamTransport = teacher.downstreamTransport;
                // create the consumer with the transport with only 1 student
                const newConsumer = await downstreamTransport.consume({
                    producerId: student.producer.id,
                    rtpCapabilities,
                    paused: true //good practice
                })
                // add this newConsumer to the teacher - store with producerId as the key
                teacher.addConsumer(student.producer.id, newConsumer)
                // respond with the params
                const clientParams = {
                    producerId: student.producer.id,
                    id: newConsumer.id,
                    kind: newConsumer.kind,
                    rtpParameters: newConsumer.rtpParameters
                }

                ack(clientParams)
            }
        } catch (err) {
            console.log(err)
            ack('consumeFailed')
        }
    })

    socket.on('unpauseConsumer', async ({ producerId }, ack) => {
        try {
            // Get consumer by producerId - this is more reliable than studentIndex
            const studentIndex = teacher.room.students.findIndex(student => student.producer.id === producerId)
            console.log(studentIndex)

            const producer = teacher.room.students[studentIndex].producer;
            console.log(producer.paused); // false: Đang chạy, true: Đã pause
            console.log(producer.closed); // false: Đang chạy, true: Đã đóng
            console.log(producer.track?.muted); // false: OK, true: Track bị mute
            console.log(producer.track?.enabled); // true: OK, false: Track đã tắt
            const consumerToResume = teacher.consumers.get(producerId);

            if (!consumerToResume) {
                console.error('Consumer not found for producerId:', producerId);
                return ack('consumerNotFound');
            }

            console.log('Consumer before resume - paused:', consumerToResume.paused);
            await consumerToResume.resume();
            console.log('Consumer after resume - paused:', consumerToResume.paused);

            ack('resumed');
        } catch (error) {
            console.error('Error resuming consumer:', error);
            ack('error');
        }
    })
});

httpServer.listen(config.backEndPort);