// index.js

const fs = require('fs');
const clear = require('console-clear');
const figlet = require('figlet');
const colors = require('colors');
const prompt = require('prompt-sync')({ sigint: true });
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const Table = require('cli-table3');

const { 
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

// Función para firmar mensajes usando nacl
const signMessage = (privateKeyBase58, message) => {
    try {
        // Decodificar la clave privada de Base58
        const secretKey = bs58.decode(privateKeyBase58);
        console.log(`Decoding private key... Length: ${secretKey.length} bytes`);

        if (secretKey.length !== 64) {
            throw new Error(`Invalid secret key length: ${secretKey.length} bytes. Expected 64 bytes.`);
        }

        // Firmar el mensaje usando nacl.sign.detached con la clave secreta completa
        const messageBytes = Buffer.from(message, 'utf-8');
        const signature = nacl.sign.detached(messageBytes, secretKey); // Usar los 64 bytes completos

        // Convertir la firma a Base58
        const signatureBase58 = bs58.encode(signature);

        // Retornar la firma en Base58
        return signatureBase58;
    } catch (error) {
        console.error(colors.red(`❌ Failed to sign message: ${error.message}`));
        throw error;
    }
};

// Función auxiliar para sincronizar wallets
async function synchronizeWallet(user, tokens) {
    const syncChoice = prompt('Do you wish to sign a Wallet from wallets.json file? (y/n): '.blue).toLowerCase();
    let walletAddress, privateKey;

    if (syncChoice === 'y') {
        // Obtener la wallet correspondiente desde wallets.json
        try {
            const walletsData = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));
            const wallet = walletsData.find(w => w.id === user.counterId); // Match via counterId
            if (!wallet) {
                console.log(`🆘 No wallet found in wallets.json for account ${user.username}`.red);
                return;
            }
            // Limpieza adicional de espacios y caracteres invisibles
            walletAddress = wallet.wallet.trim().replace(/\s+/g, '');
            privateKey = wallet.privateKey.trim().replace(/\s+/g, '');
        } catch (error) {
            console.error(`❌ Failed to read wallets.json: ${error.message}`.red);
            return;
        }
    } else if (syncChoice === 'n') {
        // Solicitar al usuario que ingrese la dirección y la clave privada
        walletAddress = prompt('Enter the Wallet Address (BS58): '.blue).trim().replace(/\s+/g, '');
        privateKey = prompt('Enter the Private Key (BS58): '.blue).trim().replace(/\s+/g, '');

        // Opcional: Validación básica de las entradas
        if (!walletAddress || !privateKey) {
            console.log('❌ Wallet Address y Private Key no pueden estar vacíos.'.red);
            return;
        }

        // Validar que la Wallet Address y la Private Key sean válidas en Base58
        try {
            bs58.decode(walletAddress);
            bs58.decode(privateKey);
        } catch (decodeError) {
            console.log('❌ La Wallet Address o la Private Key no son válidas en Base58.'.red);
            return;
        }

        // Validar longitud mínima (ajustar según los requisitos específicos)
        if (walletAddress.length < 32 || privateKey.length < 44) { // Ejemplo de longitud mínima
            console.log('❌ La Wallet Address o la Private Key son demasiado cortas.'.red);
            return;
        }
    } else {
        console.log('Invalid choice. Skipping wallet sync.'.red);
        return;
    }

    try {
        // Obtener el código de sincronización
        const syncData = await getSyncCode(user.accessToken);
        const signMessageText = syncData.signMessage;

        console.log(`\nPlease sign the following message using your Solana wallet:\n"${signMessageText}"`.yellow);

        // Firmar el mensaje usando la función signMessage
        const signatureBase58 = signMessage(privateKey, signMessageText);

        // Preparar el payload para verificar el enlace
        const payload = {
            address: walletAddress,
            oneTimeCode: syncData.oneTimeCode,
            signature: signatureBase58,
            user: user.platformId // Usar el ID del usuario en la plataforma
        };

        // Verificar y vincular la wallet
        const verifyResponse = await verifyLink(user.accessToken, payload);
        console.log(`API Response:`, verifyResponse); // Información de depuración

        // Confirmar que la wallet está sincronizada
        const updatedSyncedAddresses = await checkSyncedAddress(user.accessToken);
        if (updatedSyncedAddresses.length > 0) {
            const newAddress = updatedSyncedAddresses[0].address;
            console.log(`${user.username} has successfully synced the Wallet Address: ${newAddress}`.green);
            // Actualizar el estado de walletConnected
            user.walletConnected = 'YES';
        } else {
            console.log(`❌ Failed to sync wallet for ${user.username}`.red);
            user.walletConnected = 'N/A';
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌ Failed to sync wallet for ${user.username}: ${error.response.status} - ${error.response.data.message || error.message}`.red);
        } else {
            console.error(`❌ Failed to sync wallet for ${user.username}: ${error.message}`.red);
        }
        user.walletConnected = 'N/A';
    }

    // Agregar una demora de 500ms antes de finalizar la función
    await wait(500);
}

// Función para mostrar el banner
function showBanner() {
    console.log(figlet.textSync('MoonCoin BOT', {
        horizontalLayout: 'default',
        verticalLayout: 'default'
    }).green);
    console.log('✨ MoonCoin Client Bot created by Naeaex'.yellow);
    console.log('📩 Social: www.x.com/naeaex_dev - www.github.com/Naeaerc20'.yellow);
    console.log('👋 Hello, we\'re fetching your data. Please wait...'.yellow);
}

// Función principal
async function main() {
    let exit = false;

    while (!exit) {
        clear(); // Limpiar la consola

        // Mostrar el banner
        showBanner();

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
                    // Verificar si el usuario tiene una wallet sincronizada
                    const syncedAddresses = await checkSyncedAddress(accessToken);
                    const walletConnected = syncedAddresses.length > 0 ? 'YES' : 'N/A';

                    usersData.push({
                        counterId: i + 1, // Counter ID
                        platformId: userInfo.id, // Platform user ID
                        username: userInfo.username,
                        points: userInfo.balance,
                        countSpin: userInfo.countSpin,
                        accessToken: accessToken,
                        accountData: account,
                        walletConnected: walletConnected // Nueva propiedad
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
                            // Verificar si el usuario tiene una wallet sincronizada
                            const syncedAddresses = await checkSyncedAddress(accessToken);
                            const walletConnected = syncedAddresses.length > 0 ? 'YES' : 'N/A';

                            usersData.push({
                                counterId: i + 1,
                                platformId: userInfo.id,
                                username: userInfo.username,
                                points: userInfo.balance,
                                countSpin: userInfo.countSpin,
                                accessToken: accessToken,
                                accountData: account,
                                walletConnected: walletConnected
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to get user info for account ${i + 1} after regenerating token.`.red);
                    }
                } else {
                    console.error(`Failed to get user info for account ${i + 1}.`.red);
                }
            }

            // Agregar una demora de 500ms entre cada cuenta
            await wait(500);
        }

        // Verificar si usersData no está vacío
        if (usersData.length > 0) {
            // Crear una nueva tabla
            const table = new Table({
                head: ['ID', 'Username', 'Points', 'Chances to Spin', 'Wallet Connected'],
                colWidths: [5, 20, 15, 20, 20],
                style: {
                    head: ['cyan'],
                    border: ['grey']
                }
            });

            // Añadir las filas a la tabla
            usersData.forEach(user => {
                table.push([
                    user.counterId,
                    user.username,
                    user.points,
                    user.countSpin,
                    user.walletConnected
                ]);
            });

            // Imprimir la tabla
            console.log('\n🔗 Data Obtained:'.blue);
            console.log(table.toString());

            // Mostrar el menú
            console.log('\n📆 1. Check-In'.green);
            console.log('📝 2. Auto-Complete Tasks'.green);
            console.log('🎮 3. Play to Spin'.green);
            console.log('💼 4. Check Wallet & Sync'.green); // Nueva opción
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
                                tokens[user.counterId - 1] = newToken;
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
                                            tokens[user.counterId - 1] = newToken;
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
                                tokens[user.counterId - 1] = newToken;
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
                console.log(`\n🎮 Playing Spin for ${user.username} - Please wait 7 seconds to claim points`.blue);
                await wait(7000); // Esperar 7 segundos antes de enviar la solicitud

                try {
                    // Definir las opciones de premios disponibles
                    const spinOptions = [
                        { amount: 1000, key: "s1", type: "point" },
                        { amount: 2000, key: "s2", type: "point" },
                        { amount: 1, key: "s3", type: "spin" },
                        { amount: 4000, key: "s4", type: "point" },
                        { amount: 7000, key: "s7", type: "point" },
                        // Agrega más premios aquí si es necesario
                    ];

                    // Seleccionar una opción de premio aleatoria
                    const randomIndex = Math.floor(Math.random() * spinOptions.length);
                    const selectedPrize = spinOptions[randomIndex];

                    const { amount, key, type } = selectedPrize;

                    // Ejecutar la solicitud para jugar al Spin
                    const spinResult = await playSpin(user.accessToken, amount, key, type);

                    // Verificar si la respuesta contiene los campos esperados
                    if (spinResult && typeof spinResult.amount === 'number' && typeof spinResult.type === 'string') {
                        const pointsWon = spinResult.amount;
                        const prizeType = spinResult.type;

                        if (prizeType === 'point') {
                            console.log(`👑 ${user.username} Won ${pointsWon} points in Spinning Game`.green);
                            user.points += pointsWon; // Añadir puntos al usuario
                        } else if (prizeType === 'spin') {
                            console.log(`🎟️  ${user.username} Won ${pointsWon} Spin(s) in Spinning Game`.green);
                            user.countSpin += pointsWon; // Añadir Spins al usuario
                        } else {
                            console.log(`❓ ${user.username} Won an unknown prize type: ${prizeType}`.yellow);
                        }

                        // Opcional: Puedes guardar los nuevos puntos y Spins en un archivo si es necesario
                    } else {
                        console.log(`❌ Spin failed for ${user.username}. Invalid response from API.`.red);
                    }
                } catch (error) {
                    if (error.message.includes('Failed to play spin')) {
                        console.log(`❌ Failed to play spin for ${user.username}: ${error.message}`.red);
                    } else if (error.message.includes('Token expired')) {
                        // Token expirado, regenerar y reintentar
                        console.log(`\n⚠️  Token expired for ${user.username}. Generating a new token...`.yellow);
                        try {
                            const newToken = await getAuthenticationToken(user.accountData);
                            user.accessToken = newToken;
                            tokens[user.counterId - 1] = newToken;
                            saveAccessTokens(tokens);
                            console.log(`🔑 New token generated for ${user.username}. You may need to retry the Spin.`.green);
                        } catch (tokenError) {
                            console.log(`❌ Failed to regenerate token for ${user.username}: ${tokenError.message}`.red);
                        }
                    } else {
                        console.log(`❌ Failed to play spin for ${user.username}: ${error.message}`.red);
                    }
                }

                // Esperar 1 segundo antes de realizar el próximo juego de Spin
                await wait(1000);
            }
        } else {
            console.log(`❌ No attempts left to play Spin for ${user.username}`.red);
        }

        // Esperar 500 ms antes de pasar al siguiente usuario
        await wait(500);
    }
    break;

                    break;
                case '4':
                    // Nueva opción: Check Wallet & Sync
                    for (let user of usersData) {
                        console.log(`\n🔍 Checking Wallet for ${user.username}`.yellow);
                        try {
                            const syncedAddresses = await checkSyncedAddress(user.accessToken);
                            if (syncedAddresses.length > 0) {
                                const address = syncedAddresses[0].address;
                                console.log(`${user.username} has already synced the Wallet Address: ${address}`.cyan);
                                
                                const change = prompt('Do you wish to change the current wallet address? (y/n): '.blue).toLowerCase();
                                if (change === 'y') {
                                    // Desconectar la wallet existente
                                    try {
                                        await deleteAddress(user.accessToken, address);
                                        console.log(`Wallet Removed for ${user.username}`.green);
                                        user.walletConnected = 'N/A'; // Actualizar estado
                                    } catch (error) {
                                        console.error(`❌ Failed to remove wallet for ${user.username}: ${error.response ? error.response.status : error.message}`.red);
                                        continue; // Saltar al siguiente usuario
                                    }

                                    // Proceder a sincronizar una nueva wallet
                                    await synchronizeWallet(user, tokens);
                                } else {
                                    console.log(`Skipping wallet sync for ${user.username}`.yellow);
                                }
                            } else {
                                // No hay wallet sincronizada, proceder a sincronizar
                                await synchronizeWallet(user, tokens);
                            }
                        } catch (error) {
                            console.error(`❌ Failed to check wallet for ${user.username}: ${error.response ? error.response.status : error.message}`.red);
                        }
                        await wait(500); // Esperar antes de la siguiente cuenta
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
                // Esperar que el usuario presione Enter para volver al menú
                prompt('\nPress Enter to back to the Menu...'.blue);
            }
        } else {
            console.log('No user data available.'.red);
            // Esperar que el usuario presione Enter para volver al menú
            prompt('\nPress Enter to back to the Menu...'.blue);
        }

        await wait(500); // Esperar 500 ms antes de la siguiente iteración
    }
}

main();
