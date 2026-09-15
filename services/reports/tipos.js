// Catálogo de tipos de reporte. El front lo consume (GET /reports/tipos) para
// armar el formulario de parámetros dinámicamente.
// type de cada param: 'number' | 'boolean' | 'text' | 'select' (con options[]).
module.exports = [
    { tipo:'moodle_courses_by_category', label:'Cursos y estudiantes por categoría (Moodle)', fuente:'moodle', params:[
        { key:'categoryId', label:'Categoría (id)', type:'number', required:false },
        { key:'incluirSubcategorias', label:'Incluir subcategorías', type:'boolean', default:true },
    ]},
    { tipo:'moodle_students_at_risk_platform', label:'Estudiantes en riesgo por inactividad en la plataforma (Moodle)', fuente:'moodle', params:[
        { key:'diasSinAcceso', label:'Días sin acceso', type:'number', default:30 },
        { key:'categoryId', label:'Limitar a categoría (id)', type:'number', required:false },
    ]},
    { tipo:'moodle_students_at_risk_course', label:'Estudiantes en riesgo por inactividad en un curso (Moodle)', fuente:'moodle', params:[
        { key:'courseid', label:'Curso Moodle (id)', type:'number', required:true },
        { key:'diasSinAcceso', label:'Días sin acceso al curso', type:'number', default:30 },
    ]},
    { tipo:'moodle_enrollment_by_course', label:'Matrículas y profesores por curso (Moodle)', fuente:'moodle', params:[
        { key:'categoryId', label:'Limitar a categoría (id)', type:'number', required:false },
    ]},
    { tipo:'moodle_courses_without_students', label:'Cursos sin estudiantes / con pocos (Moodle)', fuente:'moodle', params:[
        { key:'maxEstudiantes', label:'Máximo de estudiantes', type:'number', default:1 },
        { key:'categoryId', label:'Limitar a categoría (id)', type:'number', required:false },
    ]},
    { tipo:'moodle_hidden_courses', label:'Cursos ocultos por categoría (Moodle)', fuente:'moodle', params:[
        { key:'categoryId', label:'Limitar a categoría (id)', type:'number', required:false },
    ]},
    { tipo:'moodle_courses_without_teacher', label:'Cursos sin profesor asignado (Moodle)', fuente:'moodle', params:[
        { key:'categoryId', label:'Limitar a categoría (id)', type:'number', required:false },
    ]},
    { tipo:'journey_courses_by_sync_status', label:'Cursos por estado de sincronización (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_courses_sync_errors', label:'Cursos con error de sincronización (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_users_not_synced', label:'Usuarios no sincronizados a Moodle (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_enrollments_by_status', label:'Matrículas por estado (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_audit_activity', label:'Actividad de auditoría (Nexo)', fuente:'journey', params:[
        { key:'dias', label:'Últimos N días', type:'number', default:30 },
        { key:'agruparPor', label:'Agrupar por', type:'select', options:['usuario','modulo','dia'], default:'usuario' },
    ]},
    { tipo:'journey_platform_users_by_role', label:'Usuarios de plataforma por rol (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_sync_rules', label:'Reglas de sincronización y su uso (Nexo)', fuente:'journey', params:[] },
    { tipo:'journey_virtual_labs_grades', label:'Calificaciones de laboratorios virtuales (Nexo)', fuente:'journey', params:[
        { key:'agruparPor', label:'Agrupar por', type:'select', options:['curso','estudiante','detalle'], default:'curso' },
    ]},
    { tipo:'journey_permissions_matrix', label:'Matriz de permisos rol / submódulo (Nexo)', fuente:'journey', params:[] },
    { tipo:'sync_discrepancies', label:'Discrepancias de sincronización Nexo ↔ Moodle', fuente:'mixto', params:[
        { key:'categoryId', label:'Limitar a categoría Moodle (id)', type:'number', required:false },
    ]},
    { tipo:'enrollment_moodle_vs_journey', label:'Matriculados Nexo vs Moodle por curso', fuente:'mixto', params:[
        { key:'courseid', label:'Curso Nexo (id)', type:'number', required:true },
    ]},
];
