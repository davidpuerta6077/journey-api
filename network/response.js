const success = (req, res, message, status) => {
    const statusCode = status || 200;
    res.status(statusCode).json({
        error: false,
        status: statusCode,
        body: message || '',
    });
};

const error = (req, res, message, status) => {
    const statusCode = status || 500;
    res.status(statusCode).json({
        error: true,
        status: statusCode,
        body: message || 'Internal server error',
    });
};

module.exports = { success, error };
