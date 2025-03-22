const config = require('../config/config');
class Room {
    constructor(roomId, workerToUse) {
        this.roomId = roomId;
        this.worker = workerToUse;
        this.router = null;
        this.students = [];
        this.teachers = [];
    }

    addStudent(student) {
        this.students.push(student);
    }
    addTeacher(teacher) {
        this.teachers.push(teacher);
    }

    async createRouter(io) {
        return new Promise(async (resolve, reject) => {
            this.router = await this.worker.createRouter({ mediaCodecs: config.mediaCodecs });
            resolve();
        });
    }
}

module.exports = Room;