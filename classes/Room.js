const config = require('../config/config');
class Room {
    constructor(roomId, workerToUse) {
        this.roomId = roomId;
        this.worker = workerToUse;
        this.router = null;
        this.students = [];
        this.teacher = null; // Chỉ có 1 giáo viên trong phòng
    }

    addStudent(student) {
        this.students.push(student);
    }
    
    addTeacher(teacher) {
        this.teacher = teacher;
    }

    // Lấy danh sách các thành viên trong phòng
    getMembers() {
        const members = this.students.map(student => ({
            studentId: student.studentId,
            studentName: student.studentName
        }));
        
        return members;
    }

    async createRouter(io) {
        return new Promise(async (resolve, reject) => {
            this.router = await this.worker.createRouter({ mediaCodecs: config.mediaCodecs });
            resolve();
        });
    }
}

module.exports = Room;