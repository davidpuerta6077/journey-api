// js/config.js

let timeLeft = 3600; 
const maxTime = 3600;

function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const display = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    document.getElementById('timer-display').innerText = display;

    const percentage = (timeLeft / maxTime) * 100;
    document.getElementById('token-progress').style.width = `${percentage}%`;

    if (timeLeft > 0) timeLeft--;
    else timeLeft = 3600;
}

setInterval(updateTimer, 1000);

function testConnection(type) {
    const consoleDiv = document.getElementById('console-output');
    logConsole(type === 'aws' ? "> Conectando con Cognito..." : "> Pidiendo lista de cursos...");
}

function logConsole(text) {
    // Lógica de logging
}

function refreshStatus() {
    // Lógica de actualización
}