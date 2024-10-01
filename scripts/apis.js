// scripts/apis.js

const axios = require('axios');

// 1. Obtener Bearer de Autenticación
async function getAuthenticationToken(accountData) {
    const url = 'https://moonapp-api.mooncoin.co/api/user/login';
    const refCode = '717163';  // Valor por defecto
    const payload = {
        data: accountData,
        refCode: refCode
    };

    const response = await axios.post(url, payload);
    if (response.status === 201 && response.data.success) {
        return response.data.data.accessToken;
    } else {
        throw new Error('Failed to authenticate.');
    }
}

// 2. Obtener información del usuario
async function getUserInfo(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/user/me';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.get(url, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data.data;
    } else {
        throw new Error('Failed to retrieve user info.');
    }
}

// 3. Jugar a girar el Spin
async function playSpin(bearerToken, amount, key, type) {
    const url = 'https://moonapp-api.mooncoin.co/api/spin';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };
    const payload = { amount, key, type };

    const response = await axios.put(url, payload, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data;
    } else {
        throw new Error('Failed to play spin.');
    }
}

// 4. Obtener listas de tareas
async function getTasks(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/task';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.get(url, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data.data;
    } else {
        throw new Error('Failed to retrieve tasks.');
    }
}

// 5. Completar una tarea
async function completeTask(bearerToken, taskId) {
    const url = `https://moonapp-api.mooncoin.co/api/task/check/${taskId}`;
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.get(url, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data;
    } else {
        throw new Error(`Failed to complete task ${taskId}.`);
    }
}

// 6. Verificar si el usuario puede hacer Check-In
async function canPerformCheckIn(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/check-in';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.get(url, { headers });
    return response.data;
}

// 7. Realizar Check-In
async function performCheckIn(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/check-in';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.put(url, {}, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data;
    } else {
        throw new Error('Failed to perform check-in.');
    }
}

module.exports = {
    getAuthenticationToken,
    getUserInfo,
    playSpin,
    getTasks,
    completeTask,
    canPerformCheckIn,
    performCheckIn
};
