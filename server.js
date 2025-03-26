const fs = require('fs');
require('dotenv').config(); // this is important!
// local server
const http = require('http'); // we need this to create an HTTP server
// const https = require('https');

// express setup the https server
const express = require('express');
const app = express();
// app.use(express.static('public'));


// const httpsServer = https.createServer({ cert, key }, app);

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
const FE_URL = process.env.FE_URL || 'http://localhost:8080';
const io = socketio(httpServer, {
    cors: [`http://localhost:${config.frontEndPort}`],
    cors: [`https://192.168.1.68:${config.backEndPort}`],
    cors: [FE_URL]
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

    // Xử lý khi socket ngắt kết nối
    socket.on('disconnect', async () => {
        console.log('Socket disconnected');

        // Xử lý khi student thoát
        if (student && student.room) {
            console.log(`Student ${student.studentName} disconnected from room ${student.room.roomId}`);

            // Lấy index của student trong mảng
            const studentIndex = student.room.students.findIndex(s => s.studentId === student.studentId);
            if (studentIndex !== -1) {
                // Đóng producer nếu có
                if (student.producer && !student.producer.closed) {
                    console.log(`Closing producer for student ${student.studentName}`);
                    student.producer.close();
                }

                // Đóng transport nếu có
                if (student.upstreamTransport && !student.upstreamTransport.closed) {
                    console.log(`Closing transport for student ${student.studentName}`);
                    student.upstreamTransport.close();
                }

                // Xóa student khỏi danh sách
                student.room.students.splice(studentIndex, 1);

                // Thông báo cho teacher
                if (student.room.teacher) {
                    console.log(`Notifying teacher about student ${student.studentName} leaving`);
                    student.room.teacher.socket.emit('studentLeft', {
                        studentId: student.studentId,
                        studentName: student.studentName,
                        members: student.room.getMembers()
                    });
                }
            }
        }

        // Xử lý khi teacher thoát (nếu cần)
        if (teacher && teacher.room) {
            console.log(`Teacher ${teacher.teacherName} disconnected from room ${teacher.room.roomId}`);

            // Đóng tất cả consumers
            if (teacher.consumers) {
                for (const [producerId, consumer] of teacher.consumers) {
                    if (!consumer.closed) {
                        consumer.close();
                    }
                }
            }

            // Đóng transport nếu có
            if (teacher.downstreamTransport && !teacher.downstreamTransport.closed) {
                teacher.downstreamTransport.close();
            }

            // Xóa teacher khỏi room
            teacher.room.teacher = null;
        }
    });

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
            socket.join(roomId)
            // emit the roomJoined to the client (student)
            // but also emit an event to any other people in this room (Teacher)
            const members = student.room.getMembers()
            ack({
                status: 'success',
                routerRtpCapabilities: student.room.router.rtpCapabilities,
                members: members
            })

            // Không gửi thông báo ở đây - sẽ gửi sau khi producer đã được tạo
            // Thay vào đó, gửi thông báo đầu tiên với thông tin student đã tham gia
            if (requestedRoom.teacher) {
                console.log(`Notifying teacher about new student ${name} joining room ${roomId} (without producer)`);
                const teacherSocket = requestedRoom.teacher.socket;
                teacherSocket.emit('studentJoinedRoom', {
                    studentId: id,
                    studentName: name,
                    members: members,
                    producerActive: false
                });
            }
        } else if (type === "teacher") {
            teacher = new Teacher(id, name, socket);
            if (!requestedRoom) {
                newRoom = true
                const workerToUse = await getWorker(workers)
                requestedRoom = new Room(roomId, workerToUse)
                await requestedRoom.createRouter(io)
                rooms.push(requestedRoom)
            }
            // add the room to the teacher
            teacher.room = requestedRoom
            // add the teacher to the Room teacher
            requestedRoom.addTeacher(teacher)
            // add this socket to the socket room
            socket.join(roomId)
            // get the members in the room
            const members = requestedRoom.getMembers();
            // send back the router rtpCapabilities, and all current students
            ack({
                status: 'success',
                routerRtpCapabilities: requestedRoom.router.rtpCapabilities,
                members: members
            })
        }
    });

    socket.on('requestTransport', async ({ type }, ack) => {
        console.log(`Transport request: ${type}`)
        try {
            // we need to know the producer router before we can set up the transport
            if (type === "consumer" && !(teacher && teacher.room)) {
                ack("error")
                return;
            } else if (type === "producer" && !(student && student.room)) {
                ack("error")
                return;
            }

            // set up the transport
            let clientParams;
            if (type === "consumer") {
                clientParams = await teacher.addTransport();

                // Thêm thông tin cho WebRTC transport
                // teacher.downstreamTransport.enableTraceEvent(['probation', 'bwe']);
                // teacher.downstreamTransport.on('trace', (trace) => {
                //     console.log("Consumer transport trace:", trace);
                // });
            } else {
                clientParams = await student.addTransport();

                // Thêm thông tin cho WebRTC transport
                student.upstreamTransport.enableTraceEvent(['probation', 'bwe']);
                student.upstreamTransport.on('trace', (trace) => {
                    console.log("Producer transport trace:", trace);
                });
            }

            console.log(`Transport created for ${type}`);
            ack(clientParams)
        } catch (err) {
            console.log(err)
            ack("error")
        }
    })

    socket.on('connectTransport', async ({ dtlsParameters, type }, ack) => {
        console.log(`connect transport event: ${type}!`);
        console.log(`DTLS parameters: ${JSON.stringify(dtlsParameters)}`);

        try {
            if (type === "producer") {
                // we get the dtls params from the request and add them to the upstreamsTransport
                console.log("Connecting producer transport with DTLS parameters");

                // Check if transport exists
                if (!student || !student.upstreamTransport) {
                    console.error("Student or upstreamTransport is null");
                    return ack("error");
                }

                // Connect the transport with DTLS parameters
                await student.upstreamTransport.connect({ dtlsParameters });

                // Monitor ICE connection state
                student.upstreamTransport.observer.on('icestatechange', (iceState) => {
                    console.log(`Producer ICE state changed to: ${iceState}`);
                });

                // Kiểm tra trạng thái sau khi kết nối
                student.upstreamTransport.observer.on('close', () => {
                    console.log('Producer transport closed');
                });

                student.upstreamTransport.observer.on('newproducer', (producer) => {
                    console.log('New producer created:', producer.id);
                });

                console.log('Producer transport connected successfully');
                ack("success");
            } else {
                // we get the dtls params from the request and add them to the downstreamsTransport
                console.log("Connecting consumer transport with DTLS parameters");
                console.log("DTLS parameters received:", JSON.stringify(dtlsParameters));

                // Check if transport exists
                if (!teacher || !teacher.downstreamTransport) {
                    console.error("Teacher or downstreamTransport is null");
                    return ack("error");
                }

                // Connect the transport with DTLS parameters
                await teacher.downstreamTransport.connect({ dtlsParameters });

                // Monitor ICE connection state
                teacher.downstreamTransport.observer.on('icestatechange', (iceState) => {
                    console.log(`Consumer ICE state changed to: ${iceState}`);
                });

                // Kiểm tra trạng thái sau khi kết nối
                teacher.downstreamTransport.observer.on('close', () => {
                    console.log('Consumer transport closed');
                });

                teacher.downstreamTransport.observer.on('newconsumer', (consumer) => {
                    console.log('New consumer created:', consumer.id);
                });

                console.log('Consumer transport connected successfully');
                ack("success");
            }
        } catch (err) {
            console.log("Error connecting transport:", err);
            ack("error");
        }
    })

    socket.on('startProducing', async ({ kind, rtpParameters }, ack) => {
        // create a producer with the rtpParameters we were sent
        try {
            const newProducer = await student.upstreamTransport.produce({ kind, rtpParameters })
            //add the producer to this client obect
            student.addProducer(newProducer)

            // Thông báo cho giáo viên có học sinh mới (sau khi producer đã được tạo)
            if (student.room && student.room.teacher) {
                console.log(`Notifying teacher about new student ${student.studentName} with active producer`);
                const teacherSocket = student.room.teacher.socket;
                const members = student.room.getMembers();

                teacherSocket.emit('newStudentJoined', {
                    studentId: student.studentId,
                    studentName: student.studentName,
                    members: members,
                    producerId: newProducer.id,
                    producerActive: true
                });
            }

            // the front end is waiting for the id
            ack(student.producer.id)
        } catch (err) {
            console.log(err)
            ack(err)
        }
    })

    socket.on('consumeMedia', async ({ rtpCapabilities, studentId }, ack) => {
        try {
            if (!teacher || !teacher.room || teacher.room.students.length === 0) {
                console.log("No students available in the room");
                ack("noStudent");
                return;
            }

            // Nếu studentId được chỉ định, tìm học sinh đó
            // Nếu không, lấy học sinh đầu tiên (để tương thích ngược)
            let student;
            if (studentId) {
                student = teacher.room.students.find(s => s.studentId === studentId);
                if (!student) {
                    console.error("Student not found with ID:", studentId);
                    ack("studentNotFound");
                    return;
                }
            } else {
                // Legacy behavior - lấy học sinh đầu tiên
                student = teacher.room.students[0];
            }

            // Debug thông tin producer
            console.log(`Checking producer for student ${student.studentName}:`, {
                hasProducer: !!student.producer,
                producerId: student.producer?.id || 'none',
                producerClosed: student.producer?.closed || true
            });

            // Kiểm tra producer tồn tại
            if (!student.producer || !student.producer.id) {
                console.error("Student doesn't have an active producer:", student.studentId);
                ack("noProducer");
                return;
            }

            // Kiểm tra xem có thể consume được không
            const canConsumeCheck = {
                producerId: student.producer.id,
                rtpCapabilities
            };
            console.log("Checking if can consume with:", canConsumeCheck);

            if (!teacher.room.router.canConsume(canConsumeCheck)) {
                console.error("Cannot consume from producer:", student.producer.id);
                console.log("Router capabilities:", teacher.room.router.rtpCapabilities);
                console.log("Client RTP capabilities:", rtpCapabilities);
                ack("cannotConsume");
                return;
            }

            // Tiến hành tạo consumer
            const downstreamTransport = teacher.downstreamTransport;
            console.log("Creating consumer for student:", student.studentName);

            // Tạo consumer với producer của học sinh được chọn
            const newConsumer = await downstreamTransport.consume({
                producerId: student.producer.id,
                rtpCapabilities,
                paused: true // tạm dừng ban đầu
            });

            // Lưu consumer trong danh sách của giáo viên
            teacher.addConsumer(student.producer.id, newConsumer);

            // Trả về thông tin cho client
            const clientParams = {
                producerId: student.producer.id,
                id: newConsumer.id,
                kind: newConsumer.kind,
                rtpParameters: newConsumer.rtpParameters,
                studentId: student.studentId,
                studentName: student.studentName
            };

            console.log(`Consumer created for teacher to view student ${student.studentName}`);
            ack(clientParams);

        } catch (err) {
            console.log("Error in consumeMedia:", err);
            ack('consumeFailed');
        }
    });

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

            // Nếu track bị muted, thử khởi động lại
            if (producer.track?.muted) {
                console.log("Detected muted track on producer side, attempting to fix");
                if (producer.track) {
                    producer.track.enabled = true;
                }
            }

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