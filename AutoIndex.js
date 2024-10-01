// AutoIndex.js

const fs = require('fs');
const axios = require('axios');
const clear = require('console-clear');
const colors = require('colors');

const { 
    getAuthenticationToken, 
    getUserInfo, 
    canPerformCheckIn,
    performCheckIn
} = require('./scripts/apis');

// Rutas a los archivos
const accountsPath = './accounts.json';
const accessTokenPath = './accessToken.txt';

// Función para esperar un tiempo (en milisegundos)
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para cargar los tokens desde el archivo
function loadAccessTokens() {
    if (fs.existsSync(accessTokenPath)) {
        const data = fs.readFileSync(accessTokenPath, 'utf8').trim();
        if (!data) {
            // Si el archivo está vacío, retornamos un array vacío
            return [];
        }
        try {
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error parsing ${accessTokenPath}: ${error.message}`);
            // Si el JSON es inválido, retornamos un array vacío o puedes manejarlo como prefieras
            return [];
        }
    } else {
        return [];
    }
}

// Función para guardar los tokens en el archivo
function saveAccessTokens(tokens) {
    fs.writeFileSync(accessTokenPath, JSON.stringify(tokens, null, 2));
}

// Función principal
async function main() {
    clear(true);
    console.log('🌓 MoonCoin Auto Check-In Bot'.green);
    console.log('✨ Created by Naeaex'.yellow);
    console.log('📩 Social: www.x.com/naeaex_dev - www.github.com/Naeaerc20'.yellow);
    console.log('👋 Starting the auto check-in process...'.yellow);

    // Cargar las cuentas desde el archivo accounts.json
    const accounts = JSON.parse(fs.readFileSync(accountsPath));
    const tokens = loadAccessTokens();

    const usersData = [];

    // Procesar todas las cuentas
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];

        // Obtener un token válido
        let accessToken = tokens[i];

        // Si no hay token, generar uno nuevo
        if (!accessToken) {
            accessToken = await getAuthenticationToken(account);
            tokens[i] = accessToken;
            saveAccessTokens(tokens);
        }

        try {
            // Obtener la información del usuario
            const userInfo = await getUserInfo(accessToken);
            if (userInfo) {
                usersData.push({
                    id: i + 1,
                    username: userInfo.username,
                    points: userInfo.balance,
                    accessToken: accessToken,
                    accountData: account
                });
            }
        } catch (error) {
            // Si se produce un error 401, regenerar el token
            if (error.response && error.response.status === 401) {
                console.log(`\n⚠️  Token expired for account ${i + 1}. Generating a new token...`.yellow);
                accessToken = await getAuthenticationToken(account);
                tokens[i] = accessToken;
                saveAccessTokens(tokens);

                // Intentar obtener la información del usuario nuevamente
                try {
                    const userInfo = await getUserInfo(accessToken);
                    if (userInfo) {
                        usersData.push({
                            id: i + 1,
                            username: userInfo.username,
                            points: userInfo.balance,
                            accessToken: accessToken,
                            accountData: account
                        });
                    }
                } catch (err) {
                    console.error(`Failed to get user info for account ${i + 1} after regenerating token.`.red);
                }
            } else {
                console.error(`Failed to get user info for account ${i + 1}.`.red);
            }
        }
    }

    // Verificar si usersData no está vacío
    if (usersData.length > 0) {
        // Check-In para todas las cuentas
        for (let user of usersData) {
            console.log(`\nPerforming Check-In for ${user.username}`.yellow);
            try {
                const checkInStatus = await canPerformCheckIn(user.accessToken);
                if (checkInStatus.success) {
                    // El usuario puede realizar el check-in
                    const performResult = await performCheckIn(user.accessToken);
                    if (performResult && performResult.success) {
                        const days = performResult.data.dayInWeek;
                        console.log(`✅ ${user.username} has performed successfully Check-In for ${days} consecutive days`.green);
                    } else {
                        console.log(`⛔️ ${user.username} can't perform Check-In currently. Please wait`.red);
                    }
                } else {
                    // El usuario no puede realizar el check-in
                    console.log(`⛔️ ${user.username} can't perform Check-In currently. Please wait`.red);
                }
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    // Token expirado, regenerar y reintentar
                    console.log(`\nToken expired for ${user.username}. Generating a new token...`.yellow);
                    const newToken = await getAuthenticationToken(user.accountData);
                    user.accessToken = newToken;
                    tokens[user.id - 1] = newToken;
                    saveAccessTokens(tokens);
                    // Reintentar la acción si lo deseas
                } else if (error.response && error.response.status === 400) {
                    // Error 400: No puede hacer Check-In actualmente
                    console.log(`⛔️ ${user.username} can't perform Check-In currently. Please wait`.red);
                } else {
                    console.log(`❌ ${user.username} failed performing Check-In because error ${error.response ? error.response.status : error.message}`.red);
                }
            }
            await wait(500); // Esperar 500 ms antes de la siguiente cuenta
        }
    } else {
        console.log('No user data available.'.red);
    }

    console.log('\n✅ Auto Check-In process completed.'.green);
    console.log('🕒 The next check-in will occur in 24 hours.'.yellow);

    // Programar la siguiente ejecución en 24 horas
    setTimeout(main, 24 * 60 * 60 * 1000); // 24 horas en milisegundos
}

main();
