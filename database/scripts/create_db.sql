-- Script para crear la base de datos Journey en pgAdmin
-- Paso 1: Ejecuta solo esta línea en una query conectada a 'postgres' o tu BD principal:
-- CREATE DATABASE journey_db;
-- Luego, conecta pgAdmin a 'journey_db' y ejecuta el resto del script.

-- Si ya tienes la BD, ejecuta todo desde aquí.

-- Tabla de usuarios (estudiantes y docentes)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    firstname VARCHAR(100),
    lastname VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255), -- Hashed
    city VARCHAR(100),
    country VARCHAR(100),
    role VARCHAR(50) DEFAULT 'student', -- 'student' o 'teacher'
    moodle_id INTEGER, -- ID en Moodle después de creación
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255),
    shortname VARCHAR(100) UNIQUE,
    categoryid INTEGER,
    idnumber VARCHAR(100),
    summary TEXT,
    visible BOOLEAN DEFAULT TRUE,
    format VARCHAR(50) DEFAULT 'topics',
    numsections INTEGER DEFAULT 10,
    moodle_id INTEGER, -- ID en Moodle
    seed_course_id INTEGER, -- ID del curso semilla si aplica
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de matrículas
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    userid INTEGER REFERENCES users(id),
    courseid INTEGER REFERENCES courses(id),
    role VARCHAR(50) DEFAULT 'student', -- 'student' o 'teacher'
    moodle_enrollment_id INTEGER, -- ID en Moodle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de calificaciones
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    userid INTEGER REFERENCES users(id),
    courseid INTEGER REFERENCES courses(id),
    grade DECIMAL(5,2),
    itemname VARCHAR(255),
    moodle_grade_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(userid, courseid);