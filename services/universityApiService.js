const axios = require('axios');
const config = require('../config');

async function getStudents() {
  const response = await axios.get(`${config.university_api.base_url}/students`);
  return response.data;
}

async function getTeachers() {
  const response = await axios.get(`${config.university_api.base_url}/teachers`);
  return response.data;
}

async function getEnrollments() {
  const response = await axios.get(`${config.university_api.base_url}/enrollments`);
  return response.data;
}

async function getCourses() {
  const response = await axios.get(`${config.university_api.base_url}/courses`);
  return response.data;
}

module.exports = {
  getStudents,
  getTeachers,
  getEnrollments,
  getCourses
};