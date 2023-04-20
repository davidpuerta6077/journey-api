const response = require('./response');

const errors = (err, req, res, next)=> {
    console.error("[error]", err);
    const message = err.message || "Error internal";
    const status = err.statusCode || 500;

    response.error(req, res, message, status);
}

module.exports = errors;
