const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authorization = req.get('Authorization');
    const match = typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(\S+)$/i)
        : null;

    if (!match || !process.env.JWT_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        req.user = jwt.verify(match[1], process.env.JWT_SECRET);
        return next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        return next(error);
    }
};

module.exports = verifyToken;
