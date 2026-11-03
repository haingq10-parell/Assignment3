require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routers/auth');
const attendanceRoutes = require('./routers/attendance');
const verifyToken = require('./middleware/verifyToken');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use(verifyToken);

app.get('/', async (req, res) => {
    try {
        res.send({ message: 'Welcome to Practical Exam!' });
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.use('/api', attendanceRoutes);

app.use((error, req, res, next) => {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 9999;

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});