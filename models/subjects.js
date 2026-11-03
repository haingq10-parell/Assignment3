const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    credits: Number,
    status: String,
});

module.exports = mongoose.model('Subject', subjectSchema);