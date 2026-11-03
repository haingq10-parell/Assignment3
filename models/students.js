const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentCode: {
            type: String,
            required: true,
            unique: true,
        },
        fullName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            match: [/\S+@\S+\.\S+/, 'is invalid'],
        }
    },
{timestamps: true}
);
module.exports = mongoose.model('Student', studentSchema);
