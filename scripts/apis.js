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
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json' // Asegura que el Content-Type sea JSON
    };
    const payload = { amount, key, type };

    try {
        const response = await axios.put(url, payload, { headers });
        return response.data; // Retornar directamente los datos de la respuesta
    } catch (error) {
        if (error.response) {
            // Error relacionado con la respuesta de la API
            console.error(`❌ Error en playSpin - Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
            throw new Error(`Failed to play spin: ${error.response.data.message || error.message}`);
        } else if (error.request) {
            // Error relacionado con la solicitud realizada pero sin respuesta
            console.error('❌ No se recibió respuesta de la API durante playSpin.');
            throw new Error('No response received from the API.');
        } else {
            // Otro tipo de error
            console.error(`❌ Error en playSpin: ${error.message}`);
            throw error;
        }
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

async function checkSyncedAddress(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/wallet-link';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.get(url, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data.data; // Devuelve el array de wallets sincronizadas
    } else {
        throw new Error('Failed to check synced addresses.');
    }
}

// 9. Desconectar una wallet existente
async function deleteAddress(bearerToken, address) {
    const url = `https://moonapp-api.mooncoin.co/api/wallet-link/disconnect?address=${address}`;
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.delete(url, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data;
    } else {
        throw new Error('Failed to delete wallet address.');
    }
}

// 10. Obtener código de sincronización
async function getSyncCode(bearerToken) {
    const url = 'https://moonapp-api.mooncoin.co/api/wallet-link/create-link';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.put(url, {}, { headers });
    if (response.status === 200 && response.data.success) {
        return response.data.data; // Contiene oneTimeCode, verifyTimeOut, signMessage
    } else {
        throw new Error('Failed to get sync code.');
    }
}

// 11. Verificar y vincular la wallet
async function verifyLink(bearerToken, payload) {
    const url = 'https://moonapp-api.mooncoin.co/api/wallet-link/verify-link';
    const headers = {
        Authorization: `Bearer ${bearerToken}`
    };

    const response = await axios.post(url, payload, { headers });
    if (response.status === 201 && response.data.success) {
        return response.data;
    } else {
        throw new Error('Failed to verify wallet link.');
    }
}

module.exports = {
    getAuthenticationToken,
    getUserInfo,
    playSpin,
    getTasks,
    completeTask,
    canPerformCheckIn,
    performCheckIn,
    checkSyncedAddress,
    deleteAddress,
    getSyncCode,
    verifyLink
};
