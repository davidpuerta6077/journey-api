const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const { moodleRequest } = require('../../services/moodleService');

// ─── MAPEO DE ROLES ───────────────────────────────────────────────────────────
const ROLE_MAP = {
    'ESTUDIANTE':    'student',
    'DOCENTE':       'editingteacher',
    'TUTOR':         'teacher'
}

// Rol (string) guardado localmente en enrollments → roleid numérico que espera Moodle.
const ROLE_ID_MAP = {
    student:        5,
    editingteacher: 3,
    teacher:        4
};

// ─── CARGA MASIVA (EXCEL) ──────────────────────────────────────────────────────
const ALLOWED_ROLES = ['gestor', 'editingteacher', 'teacher', 'student', 'revisor'];

// Sin catálogo real de estados: 1 = Matriculado, cualquier otro valor = Pendiente.
function mapEnrollmentState(state) {
    return Number(state) === 1 ? 'Matriculado' : 'Pendiente';
}

// Excel puede entregar la fecha como número serial (celda con formato Fecha) o como texto.
function parseExcelDate(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') {
        const parsed = xlsx.SSF.parse_date_code(value);
        if (!parsed) return null;
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const str = String(value).trim();
    const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
        const y = ymd[1];
        let m = parseInt(ymd[2], 10);
        let d = parseInt(ymd[3], 10);
        // Si el mes es inválido (>12) y el día sí podría ser mes, estaban al revés (AAAA-DD-MM).
        if (m > 12 && d <= 12) { [m, d] = [d, m]; }
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        let [, a, b, y] = dmy;
        a = parseInt(a, 10);
        b = parseInt(b, 10);
        // Si uno de los dos no puede ser mes (>12), ese es el día. Ambiguo → DD/MM/YYYY.
        const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
        return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return str;
}

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    async function addElement(enrollmentData) {
        return data.insertEnrollment(enrollmentData);
    }

    async function updateElement(enrollmentData) {
        return data.updateEnrollment(enrollmentData);
    }

    async function deleteElement(id) {
        return data.deleteEnrollment(id);
    }

    // ─── SYNC ─────────────────────────────────────────────────────────────────

    async function listEnrollmentsForSync() {
        return data.getEnrollmentsForSync();
    }

    async function updateEnrollmentMoodleId(id, moodleEnrollmentId) {
        return data.setEnrollmentMoodleId(id, moodleEnrollmentId);
    }

    async function markEnrollmentAsSynchronized(id) {
        return data.updateEnrollmentSyncStatus(id, true);
    }

    // ─── JOURNEY ──────────────────────────────────────────────────────────────

    async function saveJourneyEnrollment(enr) {
        const moodleRole = ROLE_MAP[enr.role?.toUpperCase()] || enr.role || 'student';
        const codigoJourney = enr.codigo_journey || `${enr.codigo_asignatura}${enr.periodo}${enr.grupo}`;

        const existing = await data.findEnrollmentByUserAndCourse(enr.userid, codigoJourney);
        if (existing.length > 0) {
            throw new Error('Ya existe una matrícula para este estudiante en esa asignatura, periodo y grupo');
        }

        const result = await data.insertEnrollment({
            userid:                 enr.userid,
            courseid:               enr.courseid             || null,
            role:                   moodleRole,
            moodle_enrollment_id:   null,
            codigo_asignatura:      enr.codigo_asignatura,
            nombre_asignatura:      enr.nombre_asignatura,
            programa:               enr.programa,
            periodo:                enr.periodo,
            grupo:                  enr.grupo,
            codigo_journey:         codigoJourney,
            estado:                 enr.estado               || 'Matriculado',
            fecha_creacion_journey: new Date().toISOString().split('T')[0]
        });
        return result[0];
    }

    async function updateJourneyEnrollment(enr) {
        const moodleRole = ROLE_MAP[enr.role?.toUpperCase()] || enr.role || 'student';
        const result = await data.updateJourneyEnrollment({ ...enr, role: moodleRole });
        return result[0];
    }

    async function listEnrollmentsWithUsers() {
        return data.listAllEnrollmentsWithUsers();
    }

    function readExcel(filePath) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    }

    async function generateErrorExcel(errors) {
        if (errors.length === 0) return null;
        const ws = xlsx.utils.json_to_sheet(errors);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Errores de Carga');
        const fileName = `errores_carga_matriculas_${Date.now()}.xlsx`;
        const outputPath = path.join(__dirname, '../../uploads', fileName);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        xlsx.writeFile(wb, outputPath);
        return outputPath;
    }

    function validateEnrollmentRow(row, extended) {
        const errors = [];
        row.code   = row.code   != null ? String(row.code).trim()   : '';
        row.email  = row.email  != null ? String(row.email).trim()  : '';
        row.rol    = row.rol    != null ? String(row.rol).trim().toLowerCase() : '';
        row.period = row.period != null ? String(row.period).trim() : '';

        if (!row.code)  errors.push('El código de curso (code) es obligatorio.');
        if (!row.email || !/\S+@\S+\.\S+/.test(row.email)) errors.push('El email es inválido.');
        if (!ALLOWED_ROLES.includes(row.rol)) errors.push(`Rol inválido "${row.rol}". Debe ser uno de: ${ALLOWED_ROLES.join(', ')}`);
        if (!row.period) errors.push('El periodo (period) es obligatorio.');
        if (row.state === undefined || row.state === '') errors.push('El estado (state) es obligatorio.');

        if (extended) {
            row.name      = row.name      != null ? String(row.name).trim()      : '';
            row.last_name = row.last_name != null ? String(row.last_name).trim() : '';
            row.document  = row.document  != null ? String(row.document).trim() : '';
            if (!row.name)      errors.push('El nombre es obligatorio.');
            if (!row.last_name) errors.push('El apellido es obligatorio.');
            if (!row.document)  errors.push('El documento es obligatorio.');
        }
        return errors;
    }

    async function processExcelAndEnrolUsers(filePath) {
        const excelData = readExcel(filePath);
        const errors = [];
        let successCount = 0;
        let errorCount = 0;

        for (const row of excelData) {
            const extended = row.document !== undefined && row.document !== '' && row.document !== null;
            const validationErrors = validateEnrollmentRow(row, extended);
            if (validationErrors.length > 0) {
                errors.push({ ...row, errors: validationErrors.join(', ') });
                errorCount++;
                continue;
            }
            try {
                const courses = await data.findCourseSicau(row.code);
                if (courses.length === 0) {
                    errors.push({ ...row, errors: `No existe un curso con code "${row.code}"` });
                    errorCount++;
                    continue;
                }
                const course = courses[0];

                let userid;
                const existingUsers = await data.findUserSicau(row.email, row.email);
                if (existingUsers.length > 0) {
                    userid = existingUsers[0].id;
                } else if (extended) {
                    const created = await data.insertUser({
                        username:               row.email,
                        firstname:              row.name,
                        lastname:               row.last_name,
                        email:                  row.email,
                        password:               row.document,
                        city:                   'Medellín',
                        country:                'CO',
                        documento:              row.document,
                        correo_personal:        row.personalMail            || null,
                        telefono:               row.phone                   || null,
                        celular:                row.cellPhone               || null,
                        fecha_nacimiento:       parseExcelDate(row.Fecha_de_Nacimiento),
                        jornada:                row.jornada                  || null,
                        departamento_academico: row.departamento             || null,
                        plan_estudios:          row.plan_estudios            || null,
                        moodle_id:              null,
                        sincronizado:           false
                    });
                    userid = created[0].id;
                } else {
                    errors.push({ ...row, errors: `No existe un usuario con email "${row.email}"` });
                    errorCount++;
                    continue;
                }

                const existingEnrollment = await data.findEnrollmentByUserAndCourse(userid, course.idnumber);
                if (existingEnrollment.length > 0) {
                    errors.push({ ...row, errors: 'Ya existe una matrícula para este estudiante en este curso.' });
                    errorCount++;
                    continue;
                }

                await data.insertEnrollment({
                    userid,
                    courseid:               course.id,
                    role:                   row.rol,
                    moodle_enrollment_id:   null,
                    codigo_asignatura:      course.codigo_asignatura,
                    nombre_asignatura:      course.nombre_asignatura,
                    programa:               course.programa,
                    periodo:                course.periodo,
                    grupo:                  course.grupo,
                    codigo_journey:         course.idnumber,
                    estado:                 mapEnrollmentState(row.state),
                    fecha_creacion_journey: new Date().toISOString().split('T')[0]
                });
                successCount++;
            } catch (err) {
                errors.push({ ...row, errors: `Error: ${err.message}` });
                errorCount++;
            }
        }
        return { successCount, errorCount, errors };
    }

    // ─── CARGA MASIVA DE DESMATRÍCULAS (SUSPENSIÓN EN MOODLE) ───────────────────

    function validateSuspendRow(row) {
        const errors = [];
        row.code  = row.code  != null ? String(row.code).trim()  : '';
        row.email = row.email != null ? String(row.email).trim() : '';
        if (!row.code) errors.push('El código de curso (code) es obligatorio.');
        if (!row.email || !/\S+@\S+\.\S+/.test(row.email)) errors.push('El email es inválido.');
        return errors;
    }

    async function processExcelAndSuspendUsers(filePath) {
        const excelData = readExcel(filePath);
        const errors = [];
        let successCount = 0;
        let errorCount = 0;

        for (const row of excelData) {
            const validationErrors = validateSuspendRow(row);
            if (validationErrors.length > 0) {
                errors.push({ ...row, errors: validationErrors.join(', ') });
                errorCount++;
                continue;
            }
            try {
                const users = await data.findUserSicau(row.email, row.email);
                if (users.length === 0 || !users[0].moodle_id) {
                    errors.push({ ...row, errors: `Usuario "${row.email}" no existe o no está sincronizado con Moodle.` });
                    errorCount++;
                    continue;
                }
                const user = users[0];

                const enrollments = await data.findEnrollmentByUserAndCourse(user.id, row.code);
                if (enrollments.length === 0) {
                    errors.push({ ...row, errors: `No existe matrícula local para "${row.email}" en el curso "${row.code}".` });
                    errorCount++;
                    continue;
                }
                const enrollment = enrollments[0];

                const courses = await data.findCourseSicau(row.code);
                if (courses.length === 0 || !courses[0].moodle_id) {
                    errors.push({ ...row, errors: `Curso "${row.code}" no existe o no está sincronizado con Moodle.` });
                    errorCount++;
                    continue;
                }
                const course = courses[0];

                const roleid = ROLE_ID_MAP[enrollment.role];
                if (!roleid) {
                    errors.push({ ...row, errors: `Rol "${enrollment.role}" de la matrícula no tiene roleid de Moodle asignado.` });
                    errorCount++;
                    continue;
                }

                const result = await moodleRequest('enrol_manual_enrol_users', {
                    'enrolments[0][userid]':   user.moodle_id,
                    'enrolments[0][courseid]': course.moodle_id,
                    'enrolments[0][roleid]':   roleid,
                    'enrolments[0][suspend]':  1
                });
                if (result && result.exception) {
                    errors.push({ ...row, errors: `Moodle: ${result.message}` });
                    errorCount++;
                    continue;
                }

                await data.updateEnrollmentEstado(enrollment.id, 'Suspendido');
                successCount++;
            } catch (err) {
                errors.push({ ...row, errors: `Error: ${err.message}` });
                errorCount++;
            }
        }
        return { successCount, errorCount, errors };
    }

    return {
        list,
        addElement,
        updateElement,
        deleteElement,
        listEnrollmentsForSync,
        updateEnrollmentMoodleId,
        markEnrollmentAsSynchronized,
        saveJourneyEnrollment,
        updateJourneyEnrollment,
        listEnrollmentsWithUsers,
        generateErrorExcel,
        processExcelAndEnrolUsers,
        processExcelAndSuspendUsers
    };
};