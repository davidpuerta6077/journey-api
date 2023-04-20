

const success = (req, res, mesagge, status) => {
    let statusCode = status || 200;
    let statusMessage = mesagge || '';
    res.status(statusCode).json({
        error: false,
        status: status,
        body: statusMessage,
    });
};

const error = (req, res, mesagge, status) => {
    let statusCode = status || 500;
    let statusMessage = mesagge || 'Internal server error';
    res.status(statusCode).json({
        error: true,
        status: status,
        body: statusMessage,
    });
};

module.exports = {
    success,
    error,
}