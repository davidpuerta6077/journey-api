const crypto = require('crypto');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, '../../assets/logo-iupb.jpg');

const QUESTION_TYPES = [
    'texto_corto', 'texto_largo', 'numero', 'correo', 'telefono', 'fecha',
    'seleccion_unica', 'seleccion_multiple', 'lista_desplegable', 'aceptacion',
];

const DEFAULT_QUESTIONS = [
    { label: 'Nombre completo', type: 'texto_corto', required: true, position: 0 },
    { label: 'Número de documento', type: 'numero', required: true, position: 1 },
    { label: 'Correo', type: 'correo', required: true, position: 2 },
    { label: 'Teléfono', type: 'telefono', required: false, position: 3 },
    { label: 'Programa / Facultad', type: 'texto_corto', required: false, position: 4 },
];

module.exports = (injectedDB) => {

    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function requireOwnForm(formId, userId) {
        const form = await data.getFormByIdAndUser(formId, userId);
        if (!form) {
            const err = new Error('No tienes permiso sobre este formulario');
            err.status = 403;
            throw err;
        }
        return form;
    }

    // Lectura (ver detalle, inscritos, exportar): dueño, con quien se compartió,
    // o con el permiso "ver todos". Editar y gestionar siempre pasa por
    // requireOwnForm — solo el creador puede.
    async function requireViewAccess(formId, actor) {
        const form = await data.getFormById(formId);
        if (!form) {
            const err = new Error('Formulario no encontrado');
            err.status = 404;
            throw err;
        }
        if (form.user_id === actor.userId || actor.canViewAll) return form;
        const shared = await data.getFormShare(formId, actor.userId);
        if (!shared) {
            const err = new Error('No tienes permiso sobre este formulario');
            err.status = 403;
            throw err;
        }
        return form;
    }

    function sanitizeQuestion(q) {
        if (!QUESTION_TYPES.includes(q.type)) {
            const err = new Error(`Tipo de pregunta inválido: ${q.type}`);
            err.status = 400;
            throw err;
        }
        if (!q.label || !String(q.label).trim()) {
            const err = new Error('Toda pregunta debe tener un texto');
            err.status = 400;
            throw err;
        }
        return {
            label: String(q.label).trim(),
            type: q.type,
            options: Array.isArray(q.options) ? q.options : null,
            required: !!q.required,
            help_text: q.help_text || null,
            position: Number(q.position) || 0,
        };
    }

    // ─── FORMULARIOS ────────────────────────────────────────────────────────────

    async function listVisibleForms(actor) {
        return actor.canViewAll
            ? data.listAllFormsWithOwner(actor.userId)
            : data.listFormsOwnedOrShared(actor.userId);
    }

    async function getFormDetail(formId, actor) {
        const form = await requireViewAccess(formId, actor);
        const questions = await data.listQuestionsByForm(formId);
        return { ...form, questions, is_owner: form.user_id === actor.userId };
    }

    async function createForm(userId, body) {
        const questions = Array.isArray(body.questions) && body.questions.length
            ? body.questions
            : DEFAULT_QUESTIONS;
        const form = await data.insertForm({ ...body, user_id: userId });
        for (const q of questions) {
            await data.insertQuestion(form.id, sanitizeQuestion(q));
        }
        return getFormDetail(form.id, { userId, canViewAll: false });
    }

    async function updateForm(formId, userId, body) {
        await requireOwnForm(formId, userId);
        await data.updateForm(formId, body);

        const incoming = Array.isArray(body.questions) ? body.questions : [];
        const existing = await data.listQuestionsByForm(formId);
        const keepIds = new Set(incoming.filter(q => q.id).map(q => q.id));

        for (const old of existing) {
            if (!keepIds.has(old.id)) await data.softDeleteQuestion(old.id);
        }
        for (const q of incoming) {
            const clean = sanitizeQuestion(q);
            if (q.id) await data.updateQuestion(q.id, clean);
            else await data.insertQuestion(formId, clean);
        }
        return getFormDetail(formId, { userId, canViewAll: false });
    }

    async function publishForm(formId, userId) {
        const form = await requireOwnForm(formId, userId);
        const questions = await data.listQuestionsByForm(formId);
        const hasIdentifierField = questions.some(q => q.type === 'correo' || q.type === 'numero');
        if (!hasIdentifierField) {
            const err = new Error('El formulario debe tener al menos una pregunta de tipo "correo" o "número" para evitar registros duplicados');
            err.status = 400;
            throw err;
        }
        if (!form.public_token) {
            await data.updateFormToken(formId, crypto.randomUUID());
        }
        return data.updateFormStatus(formId, 'publicado');
    }

    async function closeForm(formId, userId) {
        await requireOwnForm(formId, userId);
        return data.updateFormStatus(formId, 'cerrado');
    }

    async function reopenForm(formId, userId) {
        await requireOwnForm(formId, userId);
        return data.updateFormStatus(formId, 'publicado');
    }

    async function duplicateForm(formId, userId) {
        const original = await requireOwnForm(formId, userId);
        const questions = await data.listQuestionsByForm(formId);
        const copy = await data.insertForm({
            user_id: userId,
            title: `${original.title} (copia)`,
            description: original.description,
            event_date: original.event_date,
            location: original.location,
            modality: original.modality,
            opens_at: original.opens_at,
            closes_at: original.closes_at,
            max_capacity: original.max_capacity,
        });
        for (const q of questions) {
            await data.insertQuestion(copy.id, sanitizeQuestion(q));
        }
        return getFormDetail(copy.id, { userId, canViewAll: false });
    }

    async function regenerateLink(formId, userId) {
        await requireOwnForm(formId, userId);
        return data.updateFormToken(formId, crypto.randomUUID());
    }

    async function removeForm(formId, userId) {
        const form = await requireOwnForm(formId, userId);
        await data.softDeleteForm(formId);
        return form;
    }

    // ─── RESPUESTAS (inscritos) ────────────────────────────────────────────────

    function pivotResponses(rows) {
        const byResponse = new Map();
        for (const row of rows) {
            if (!byResponse.has(row.response_id)) {
                byResponse.set(row.response_id, {
                    id: row.response_id,
                    identifier: row.identifier,
                    submitted_at: row.submitted_at,
                    answers: {},
                });
            }
            if (row.question_id) {
                byResponse.get(row.response_id).answers[row.question_label] = row.value;
            }
        }
        return Array.from(byResponse.values());
    }

    async function listResponses(formId, actor) {
        await requireViewAccess(formId, actor);
        const rows = await data.listResponsesByForm(formId);
        const questions = await data.listQuestionsByForm(formId);
        return { questions, responses: pivotResponses(rows) };
    }

    async function removeResponse(formId, responseId, userId) {
        await requireOwnForm(formId, userId);
        return data.deleteResponse(responseId);
    }

    function formatAnswerValue(q, value) {
        if (q.type === 'seleccion_multiple' && value) {
            try { return JSON.parse(value).join(', '); } catch { /* valor ya es texto plano */ }
        }
        return value ?? '';
    }

    function exportFilename(title, ext) {
        const fecha = new Date().toISOString().slice(0, 10);
        const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `${slug}_asistencia_${fecha}.${ext}`;
    }

    async function exportResponsesWorkbook(formId, actor) {
        const form = await requireViewAccess(formId, actor);
        const { questions, responses } = await listResponses(formId, actor);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Asistencia');
        sheet.columns = [
            ...questions.map(q => ({ header: q.label, key: `q_${q.id}` })),
            { header: 'Fecha de registro', key: 'submitted_at' },
        ];
        for (const r of responses) {
            const row = { submitted_at: new Date(r.submitted_at).toLocaleString('es-CO') };
            for (const q of questions) row[`q_${q.id}`] = formatAnswerValue(q, r.answers[q.label]);
            sheet.addRow(row);
        }
        sheet.getRow(1).font = { bold: true };

        return { workbook, filename: exportFilename(form.title, 'xlsx') };
    }

    // Plantilla institucional GDO-FR-29 "Listado de Asistencia" (Pascual Bravo).
    // El pie "Elaboró/Revisó/Aprobó" es el control documental del formato en sí
    // (vigente para todo formulario generado con esta plantilla), no cambia por
    // evento — se reproduce tal cual el documento original.
    const FICHA_TECNICA = {
        codigo: 'GDO-FR-29', version: '002',
        elaboro: { nombre: 'Catalina Martínez Cano', cargo: 'Contratista de Apoyo / Vicerrectoría de Enseñanza y Aprendizaje', fecha: '12/05/2026' },
        reviso: { nombre: 'Zarhid Andrea López Toro', cargo: 'Contratista de apoyo SGI / Dirección de Planeación y Aseguramiento de la Calidad', fecha: '12/05/2026' },
        aprobo: { nombre: 'Lina Maria Ortiz Quimbay', cargo: 'Vicerrectora de Enseñanza y Aprendizaje', fecha: '12/05/2026' },
    };

    async function exportResponsesPdf(formId, actor) {
        const form = await requireViewAccess(formId, actor);
        const { questions, responses } = await listResponses(formId, actor);
        const owner = await data.getPlatformUserById(form.user_id);

        const headers = [...questions.map(q => q.label), 'Fecha de registro', 'Firma'];
        const rows = responses.map(r => [
            ...questions.map(q => String(formatAnswerValue(q, r.answers[q.label]) || '-')),
            new Date(r.submitted_at).toLocaleString('es-CO'),
            formatAnswerValue(questions[0], r.answers[questions[0]?.label]) || '-', // "firma" digital: nombre de quien se registró
        ]);

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: headers.length > 4 ? 'landscape' : 'portrait', bufferPages: true });
        const left = doc.page.margins.left;
        const right = doc.page.width - doc.page.margins.right;
        const contentWidth = right - left;

        function drawHeader() {
            const top = doc.page.margins.top;
            const boxW = 130, boxH = 42;
            const logoW = 120, logoH = 120 * (122 / 668);
            try {
                doc.image(LOGO_PATH, left, top + (boxH - logoH) / 2, { width: logoW });
            } catch { /* si el archivo no está, el PDF sigue sin logo */ }

            doc.rect(right - boxW, top, boxW, boxH).stroke('#94a3b8');
            doc.fontSize(8).font('Helvetica').fillColor('#334155');
            doc.text(`Código: ${FICHA_TECNICA.codigo}`, right - boxW + 4, top + 3, { width: boxW - 8 });
            doc.text(`Versión: ${FICHA_TECNICA.version}`, right - boxW + 4, top + 17, { width: boxW - 8 });
            doc.text('Página', right - boxW + 4, top + 31, { width: boxW - 8 }); // número real se escribe al final (bufferPages)

            doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
                .text('LISTADO DE ASISTENCIA', left + logoW + 10, top + 10, { width: contentWidth - boxW - logoW - 20, align: 'center' });

            let y = top + boxH + 14;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
            const campo = (label, value, x, w) => {
                doc.font('Helvetica-Bold').text(`${label}: `, x, y, { continued: true, width: w });
                doc.font('Helvetica').text(value || '-', { width: w });
            };
            campo('ACTIVIDAD', form.title, left, contentWidth * 0.6);
            doc.font('Helvetica-Bold').text('RESPONSABLE: ', left + contentWidth * 0.62, y, { continued: true });
            doc.font('Helvetica').text(owner?.username || '-');
            y += 14;
            campo('OBJETIVO', form.description, left, contentWidth);
            y += 14;
            const fecha = form.event_date ? new Date(form.event_date).toLocaleDateString('es-CO') : '-';
            const hora = form.event_date ? new Date(form.event_date).toLocaleTimeString('es-CO') : '-';
            doc.y = y;
            doc.font('Helvetica-Bold').text('FECHA: ', left, y, { continued: true });
            doc.font('Helvetica').text(`${fecha}    `, { continued: true });
            doc.font('Helvetica-Bold').text('HORA: ', { continued: true });
            doc.font('Helvetica').text(`${hora}    `, { continued: true });
            doc.font('Helvetica-Bold').text('LUGAR: ', { continued: true });
            doc.font('Helvetica').text(form.location || '-');
            y += 20;
            return y;
        }

        const rowHeight = 22;

        function drawRow(y, cells, { header, num } = {}) {
            doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? 8.5 : 8);
            const numW = 20;
            doc.rect(left, y, numW, rowHeight).fillAndStroke(header ? '#dbeafe' : '#ffffff', '#94a3b8');
            doc.fillColor(header ? '#1e293b' : '#334155').text(header ? '#' : String(num), left + 2, y + 6, { width: numW - 4, align: 'center' });
            const colWidth = (contentWidth - numW) / cells.length;
            cells.forEach((cell, i) => {
                const x = left + numW + i * colWidth;
                doc.rect(x, y, colWidth, rowHeight).fillAndStroke(header ? '#dbeafe' : '#ffffff', '#94a3b8');
                doc.fillColor(header ? '#1e293b' : '#334155')
                    .text(cell, x + 4, y + 6, { width: colWidth - 8, height: rowHeight - 8, ellipsis: true });
            });
        }

        function drawFooterFicha(y) {
            const colW = contentWidth / 3;
            const bloques = [['Elaboró', FICHA_TECNICA.elaboro], ['Revisó', FICHA_TECNICA.reviso], ['Aprobó', FICHA_TECNICA.aprobo]];
            bloques.forEach(([titulo], i) => {
                doc.rect(left + i * colW, y, colW, 16).fillAndStroke('#1e3a8a', '#1e3a8a');
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(titulo, left + i * colW, y + 4, { width: colW, align: 'center' });
            });
            y += 16;
            const lineas = ['nombre', 'cargo', 'fecha'];
            lineas.forEach(campo => {
                const rowH = campo === 'cargo' ? 28 : 14;
                bloques.forEach(([, datos], i) => {
                    doc.rect(left + i * colW, y, colW, rowH).stroke('#cbd5e1');
                    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7)
                        .text(`${campo.charAt(0).toUpperCase() + campo.slice(1)}: `, left + i * colW + 3, y + 2, { continued: true, width: colW - 6 });
                    doc.font('Helvetica').text(String(datos[campo]), { width: colW - 6 });
                });
                y += rowH;
            });
            return y;
        }

        let y = drawHeader();
        drawRow(y, headers, { header: true });
        y += rowHeight;

        rows.forEach((row, i) => {
            if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 70) {
                doc.addPage();
                y = drawHeader();
                drawRow(y, headers, { header: true });
                y += rowHeight;
            }
            drawRow(y, row, { num: i + 1 });
            y += rowHeight;
        });

        if (responses.length === 0) {
            doc.font('Helvetica-Oblique').fontSize(10).fillColor('#94a3b8').text('Aún no hay inscritos.', left, y + 10);
            y += 24;
        }

        if (y + 74 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            y = doc.page.margins.top;
        } else {
            y += 16;
        }
        drawFooterFicha(y);

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica').fillColor('#334155')
                .text(`Página ${i - range.start + 1} de ${range.count}`, right - 126, doc.page.margins.top + 31, { width: 122 });
        }

        return { doc, filename: exportFilename(form.title, 'pdf') };
    }

    // ─── COMPARTIR CON OTROS USUARIOS DE PLATAFORMA ────────────────────────────

    async function searchUsers(q) {
        if (!q || !q.trim()) return [];
        return data.searchPlatformUsersShare(q.trim());
    }

    async function listShares(formId, userId) {
        await requireOwnForm(formId, userId);
        return data.listFormShares(formId);
    }

    async function addShare(formId, userId, targetUserId) {
        const form = await requireOwnForm(formId, userId);
        if (Number(targetUserId) === form.user_id) {
            const err = new Error('El formulario ya es tuyo, no hace falta compartirlo contigo mismo');
            err.status = 400;
            throw err;
        }
        await data.insertFormShare(formId, targetUserId);
        return data.listFormShares(formId);
    }

    async function removeShare(formId, userId, targetUserId) {
        await requireOwnForm(formId, userId);
        await data.deleteFormShare(formId, targetUserId);
        return data.listFormShares(formId);
    }

    // ─── VISTA PÚBLICA ──────────────────────────────────────────────────────────

    function formAvailability(form) {
        const now = new Date();
        if (!form || form.status !== 'publicado') return 'no_disponible';
        if (form.opens_at && now < new Date(form.opens_at)) return 'no_abierto';
        if (form.closes_at && now > new Date(form.closes_at)) return 'cerrado';
        return 'disponible';
    }

    async function getPublicForm(token) {
        const form = await data.getFormByToken(token);
        if (!form) {
            const err = new Error('Formulario no encontrado');
            err.status = 404;
            throw err;
        }
        const availability = formAvailability(form);
        const inscritos = await data.countFormResponsesTotal(form.id);
        const cupoLleno = form.max_capacity != null && inscritos >= form.max_capacity;

        if (availability !== 'disponible' || cupoLleno) {
            return {
                disponible: false,
                motivo: cupoLleno ? 'cupo_lleno' : availability,
                title: form.title,
            };
        }
        const questions = await data.listQuestionsByForm(form.id);
        return {
            disponible: true,
            id: form.id,
            title: form.title,
            description: form.description,
            event_date: form.event_date,
            location: form.location,
            modality: form.modality,
            max_capacity: form.max_capacity,
            inscritos,
            questions: questions.map(q => ({
                id: q.id, label: q.label, type: q.type, options: q.options,
                required: q.required, help_text: q.help_text,
            })),
        };
    }

    function validateAnswer(question, value) {
        const empty = value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0);
        if (question.required && (empty || (question.type === 'aceptacion' && value !== true))) {
            throw Object.assign(new Error(`"${question.label}" es obligatorio`), { status: 400 });
        }
        if (empty) return;
        if (question.type === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw Object.assign(new Error(`"${question.label}" debe ser un correo válido`), { status: 400 });
        }
        if (question.type === 'numero' && isNaN(Number(value))) {
            throw Object.assign(new Error(`"${question.label}" debe ser numérico`), { status: 400 });
        }
        if ((question.type === 'seleccion_unica' || question.type === 'lista_desplegable') &&
            question.options && !question.options.includes(value)) {
            throw Object.assign(new Error(`"${question.label}" tiene un valor inválido`), { status: 400 });
        }
    }

    function buildIdentifier(questions, answersByQuestionId) {
        const idQuestion = questions.find(q => q.type === 'correo') || questions.find(q => q.type === 'numero');
        const raw = idQuestion ? answersByQuestionId[idQuestion.id] : null;
        return raw ? String(raw).trim().toLowerCase() : null;
    }

    async function submitPublicResponse(token, body, ipAddress) {
        const form = await data.getFormByToken(token);
        if (!form) throw Object.assign(new Error('Formulario no encontrado'), { status: 404 });

        const availability = formAvailability(form);
        const inscritosActuales = await data.countFormResponsesTotal(form.id);
        const cupoLleno = form.max_capacity != null && inscritosActuales >= form.max_capacity;
        if (availability !== 'disponible' || cupoLleno) {
            throw Object.assign(new Error('Este formulario ya no acepta registros'), { status: 409 });
        }

        const questions = await data.listQuestionsByForm(form.id);
        const answers = Array.isArray(body.answers) ? body.answers : [];
        const answersByQuestionId = {};
        for (const a of answers) answersByQuestionId[a.question_id] = a.value;

        for (const q of questions) validateAnswer(q, answersByQuestionId[q.id]);

        const identifier = buildIdentifier(questions, answersByQuestionId);
        if (!identifier) {
            throw Object.assign(new Error('No se pudo determinar un identificador (correo o documento) para tu registro'), { status: 400 });
        }
        const existing = await data.getResponseByIdentifier(form.id, identifier);
        if (existing) {
            throw Object.assign(new Error('Ya existe un registro con ese documento o correo para este formulario'), { status: 409 });
        }

        const response = await data.insertResponse(form.id, identifier, ipAddress);
        for (const q of questions) {
            const value = answersByQuestionId[q.id];
            if (value === undefined || value === null || value === '') continue;
            const stored = Array.isArray(value) ? JSON.stringify(value) : value;
            await data.insertAnswer(response.id, q.id, stored);
        }
        return { confirmado: true };
    }

    return {
        listVisibleForms,
        getFormDetail,
        createForm,
        updateForm,
        publishForm,
        closeForm,
        reopenForm,
        duplicateForm,
        regenerateLink,
        removeForm,
        listResponses,
        removeResponse,
        exportResponsesWorkbook,
        exportResponsesPdf,
        searchUsers,
        listShares,
        addShare,
        removeShare,
        getPublicForm,
        submitPublicResponse,
    };
};
