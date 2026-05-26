const { previewStudents }    = require('./preview/previewStudents');
const { previewCourses }     = require('./preview/previewCourses');
const { previewEnrollments } = require('./preview/previewEnrollments');
const { syncStudents }       = require('./sync/syncStudents');
const { syncCourses }        = require('./sync/syncCourses');
const { syncEnrollments }    = require('./sync/syncEnrollments');

module.exports = {
    previewStudents,
    previewCourses,
    previewEnrollments,
    syncStudents,
    syncCourses,
    syncEnrollments
};