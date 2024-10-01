// index.js

const fs = require('fs');
const clear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const prompt = require('prompt-sync')({ sigint: true });

const { 
    getAuthenticationToken, 
    getUserInfo, 
    playSpin, 
    getTasks, 
    completeTask,
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
    // Mostrar el banner con el ASCII art usando figlet
    figlet('MoonCoin BOT', function(err, data) {
        if (err) {
            console.log('Something went wrong...');
            console.dir(err);
            return;
        }
        console.log(data.green);

        // Agregar las líneas adicionales en color amarillo
        console.log('✨ MoonCoin Client Bot created by Naeaex'.yellow);
        console.log('📩 Social: www.x.com/naeaex_dev - www.github.com/Naeaerc20'.yellow);

        console.log('👋 Hello, we\'re fetching your data. Please wait...'.yellow);

        // Continuar con el resto del código después de mostrar el banner
        (async () => {
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
                            countSpin: userInfo.countSpin,
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
                                    countSpin: userInfo.countSpin,
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
                let exit = false;
                while (!exit) {
                    // Imprimir los datos obtenidos
                    console.log('\n🔗 Data Obtained:'.blue);
                    console.log('🟢 | ID | Username | Points | Chances to Spin'.green);
                    usersData.forEach(user => {
                        console.log(`🟡 | ${user.id} | ${user.username} | ${user.points} | ${user.countSpin}`.yellow);
                    });

                    // Mostrar el menú
                    console.log('\n📆 1. Check-In'.green);
                    console.log('📝 2. Auto-Complete Tasks'.green);
                    console.log('🎮 3. Play to Spin'.green);
                    console.log('🚪 0. Exit'.green);

                    const option = prompt('👉 Insert the number of your choice: '.blue);

                    switch (option) {
                        case '1':
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
                            break;
                        case '2':
                            // Auto-Completar Tareas para todas las cuentas
                            for (let user of usersData) {
                                console.log(`\n⚙️  Auto Completing Tasks for ${user.username}`.yellow);
                                try {
                                    const tasks = await getTasks(user.accessToken);
                                    for (let task of tasks) {
                                        console.log(`🔄 Auto completing Task ${task.title}`.yellow);
                                        if (!task.isCompleted) {
                                            try {
                                                const completeResult = await completeTask(user.accessToken, task.id);
                                                if (completeResult && completeResult.success) {
                                                    console.log(`🟢 Task ${task.title} successfully completed`.green);
                                                }
                                            } catch (error) {
                                                if (error.response && error.response.status === 401) {
                                                    // Token expirado, regenerar y reintentar
                                                    console.log(`\nToken expired for ${user.username}. Generating a new token...`.yellow);
                                                    const newToken = await getAuthenticationToken(user.accountData);
                                                    user.accessToken = newToken;
                                                    tokens[user.id - 1] = newToken;
                                                    saveAccessTokens(tokens);
                                                    // Reintentar la tarea si lo deseas
                                                } else {
                                                    console.log(`❌ Failed to complete task ${task.title} for ${user.username}`.red);
                                                }
                                            }
                                        } else {
                                            console.log(`🟡 Task ${task.title} already completed`.cyan);
                                        }
                                        await wait(500); // Esperar 500 ms antes de la siguiente tarea
                                    }
                                    // Actualizar puntos
                                    const updatedUserInfo = await getUserInfo(user.accessToken);
                                    user.points = updatedUserInfo.balance;
                                    console.log(`🏆 Your points are now: ${updatedUserInfo.balance}`.cyan);
                                } catch (error) {
                                    if (error.response && error.response.status === 401) {
                                        // Token expirado, regenerar y reintentar
                                        console.log(`\nToken expired for ${user.username}. Generating a new token...`.yellow);
                                        const newToken = await getAuthenticationToken(user.accountData);
                                        user.accessToken = newToken;
                                        tokens[user.id - 1] = newToken;
                                        saveAccessTokens(tokens);
                                        // Reintentar la acción si lo deseas
                                    } else {
                                        console.log(`❌ Failed to get tasks for ${user.username}`.red);
                                    }
                                }
                                await wait(500); // Esperar 500 ms antes de la siguiente cuenta
                            }
                            break;
                        case '3':
                            // Jugar al Spin para todas las cuentas
                            for (let user of usersData) {
                                if (user.countSpin > 0) {
                                    for (let i = 0; i < user.countSpin; i++) {
                                        console.log(`\n🎮 Playing Spin for ${user.username} - Please wait 10 seconds to claim points`.blue);
                                        await wait(10000); // Esperar 10 segundos

                                        try {
                                            // Preparar datos aleatorios para el payload
                                            const amountOptions = [1000, 2000, 4000, 5000, 6000, 7000];
                                            const keyOptions = ['s1', 's2', 's4', 's5', 's6', 's7'];
                                            const typeOptions = ['point']; // Suponiendo que 'point' es el único tipo

                                            const randomIndex = Math.floor(Math.random() * amountOptions.length);
                                            const amount = amountOptions[randomIndex];
                                            const key = keyOptions[randomIndex];
                                            const type = typeOptions[0];

                                            const spinResult = await playSpin(user.accessToken, amount, key, type);
                                            if (spinResult && spinResult.success) {
                                                const pointsWon = spinResult.data.amount;
                                                console.log(`👑 ${user.username} Won ${pointsWon} in Spinning Game`.green);
                                                // Actualizar información del usuario
                                                const updatedUserInfo = await getUserInfo(user.accessToken);
                                                user.points = updatedUserInfo.balance;
                                                user.countSpin = updatedUserInfo.countSpin;
                                            }
                                        } catch (error) {
                                            if (error.response && error.response.status === 401) {
                                                // Token expirado, regenerar y reintentar
                                                console.log(`\nToken expired for ${user.username}. Generating a new token...`.yellow);
                                                const newToken = await getAuthenticationToken(user.accountData);
                                                user.accessToken = newToken;
                                                tokens[user.id - 1] = newToken;
                                                saveAccessTokens(tokens);
                                                // Puedes reintentar la acción aquí si lo deseas
                                            } else {
                                                console.log(`❌ Failed to play spin for ${user.username}`.red);
                                            }
                                        }
                                        await wait(500); // Esperar 500 ms antes del siguiente spin
                                    }
                                } else {
                                    console.log(`❌ No attempts left to play Spin for ${user.username}`.red);
                                }
                                await wait(500); // Esperar 500 ms antes del siguiente usuario
                            }
                            break;
                        case '0':
                            console.log('Exiting...'.green);
                            exit = true;
                            break;
                        default:
                            console.log('Invalid option.'.red);
                    }

                    if (!exit) {
                        await wait(500);
                    }
                }
            } else {
                console.log('No user data available.'.red);
            }
        })();
    });
}

main();
