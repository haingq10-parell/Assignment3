const jwt = require('jsonwebtoken');
const Student = require('../models/students');

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const student = await Student.findOne({ email: normalizedEmail })
            .select('_id studentCode email')
            .lean();

        if (!student || password !== `${normalizedEmail.split('@')[0]}@123`) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const payload = {
            studentId: student._id.toString(),
            studentCode: student.studentCode,
            email: student.email,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        return next(error);
    }
};
