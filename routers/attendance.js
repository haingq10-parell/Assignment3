const express = require('express');
const {
    getStudentsByClass,
    getAttendanceSummary,
    getStudentAttendanceHistory,
    saveClassAttendances,
} = require('../controllers/attendance');

const router = express.Router();

router.get('/classes/:classId/students', getStudentsByClass);
router.get('/classes/:classId/attendance-summary', getAttendanceSummary);
router.get('/students/:studentId/attendances', getStudentAttendanceHistory);
router.post('/classes/attendances', saveClassAttendances);
router.post('/classes/:classId/attendances', saveClassAttendances);

module.exports = router;
