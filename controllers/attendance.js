const mongoose = require('mongoose');
const Attendance = require('../models/attendances');
const Class = require('../models/classes');
const Student = require('../models/students');
require('../models/subjects');

const isObjectId = (value) =>
    typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const parseDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return null;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return date > today ? null : date;
};

const validateClassId = (classId, res) => {
    if (!isObjectId(classId)) {
        res.status(400).json({ message: 'Invalid classId' });
        return false;
    }
    return true;
};

exports.getStudentsByClass = async (req, res, next) => {
    try {
        const { classId } = req.params;
        if (!validateClassId(classId, res)) return;

        const status = (req.query.status || 'enrolled').toString().toUpperCase();
        if (!['ENROLLED', 'DROPPED'].includes(status)) {
            return res.status(400).json({ message: 'Status must be enrolled or dropped' });
        }

        const classRecord = await Class.findById(classId).select('enrollments');
        if (!classRecord) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const studentIds = classRecord.enrollments
            .filter((enrollment) => enrollment.status.toUpperCase() === status)
            .map((enrollment) => enrollment.studentId);
        const students = await Student.find({ _id: { $in: studentIds } })
            .select('_id studentCode fullName email')
            .lean();
        const byId = new Map(students.map((student) => [student._id.toString(), student]));
        const result = studentIds
            .map((studentId) => byId.get(studentId.toString()))
            .filter(Boolean)
            .map((student) => ({
                studentId: student._id.toString(),
                studentCode: student.studentCode,
                fullName: student.fullName,
                email: student.email,
            }));

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

exports.getAttendanceSummary = async (req, res, next) => {
    try {
        const { classId } = req.params;
        if (!validateClassId(classId, res)) return;

        const classRecord = await Class.findById(classId)
            .select('className enrollments')
            .lean();
        if (!classRecord) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const enrolledIds = classRecord.enrollments
            .filter((enrollment) => enrollment.status.toUpperCase() === 'ENROLLED')
            .map((enrollment) => enrollment.studentId);
        const students = await Student.find({ _id: { $in: enrolledIds } })
            .select('_id studentCode')
            .lean();
        const records = await Attendance.find({
            classId,
            studentId: { $in: enrolledIds },
        }).select('studentId status').lean();

        const counts = new Map();
        for (const record of records) {
            const studentId = record.studentId.toString();
            const count = counts.get(studentId) || { present: 0, absent: 0 };
            if (record.status === 'PRESENT') count.present += 1;
            if (record.status === 'ABSENT') count.absent += 1;
            counts.set(studentId, count);
        }

        const attendanceSummary = students.map((student) => {
            const count = counts.get(student._id.toString()) || { present: 0, absent: 0 };
            const totalSessions = count.present + count.absent;
            const attendanceRate = totalSessions
                ? Math.round((count.present / totalSessions) * 1000) / 10
                : 0;
            return {
                student: student.studentCode,
                studentId: student._id.toString(),
                studentCode: student.studentCode,
                totalSessions,
                present: count.present,
                absent: count.absent,
                attendanceRate,
                warning: attendanceRate < 80,
            };
        });

        return res.status(200).json({
            classId: classRecord._id.toString(),
            className: classRecord.className,
            attendanceSummary,
        });
    } catch (error) {
        return next(error);
    }
};

exports.getStudentAttendanceHistory = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (!isObjectId(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId' });
        }

        const student = await Student.findById(studentId).select('_id');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const records = await Attendance.find({ studentId })
            .sort({ date: -1 })
            .populate({
                path: 'classId',
                select: 'className subjectId',
                populate: { path: 'subjectId', select: 'name' },
            })
            .lean();

        const result = records.map((record) => ({
            className: record.classId?.className,
            subjectName: record.classId?.subjectId?.name,
            date: record.date,
            status: record.status,
        }));

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

exports.saveClassAttendances = async (req, res, next) => {
    try {
        const classId = req.params.classId || req.query.classId || req.body?.classId;
        if (!validateClassId(classId, res)) return;

        const classRecord = await Class.findById(classId).select('enrollments');
        if (!classRecord) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const date = parseDate(req.body?.date);
        if (!date) {
            return res.status(400).json({ message: 'date must be a valid date and not in the future' });
        }

        const { records } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: 'records must be a non-empty array' });
        }

        const enrolledIds = classRecord.enrollments
            .filter((enrollment) => enrollment.status.toUpperCase() === 'ENROLLED')
            .map((enrollment) => enrollment.studentId.toString());
        const receivedIds = [];
        for (const record of records) {
            if (!record || !isObjectId(record.studentId)) {
                return res.status(400).json({ message: 'Every record must have a valid studentId' });
            }
            if (!['PRESENT', 'ABSENT'].includes(record.status)) {
                return res.status(400).json({ message: 'status must be PRESENT or ABSENT' });
            }
            receivedIds.push(new mongoose.Types.ObjectId(record.studentId).toString());
        }

        if (new Set(receivedIds).size !== receivedIds.length) {
            return res.status(400).json({ message: 'Each studentId can appear only once' });
        }

        const receivedSet = new Set(receivedIds);
        if (
            receivedIds.some((studentId) => !enrolledIds.includes(studentId)) ||
            enrolledIds.some((studentId) => !receivedSet.has(studentId))
        ) {
            return res.status(400).json({
                message: 'Records must include every currently enrolled student and no others',
            });
        }

        const existingStudents = await Student.countDocuments({
            _id: { $in: receivedIds },
        });
        if (existingStudents !== receivedIds.length) {
            return res.status(400).json({ message: 'A studentId does not identify an existing student' });
        }

        const operations = records.map((record) => ({
            updateOne: {
                filter: {
                    classId,
                    studentId: new mongoose.Types.ObjectId(record.studentId),
                    date,
                },
                update: {
                    $set: { status: record.status },
                    $setOnInsert: {
                        classId: new mongoose.Types.ObjectId(classId),
                        studentId: new mongoose.Types.ObjectId(record.studentId),
                        date,
                    },
                },
                upsert: true,
            },
        }));
        const result = await Attendance.bulkWrite(operations);

        return res.status(200).json({
            message: 'Attendance records saved successfully',
            created: result.upsertedCount,
            updated: result.modifiedCount,
        });
    } catch (error) {
        return next(error);
    }
};
