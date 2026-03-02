const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const AdmZip = require('adm-zip');
require('colors');

const CHROME_PATH_DEFAULT = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CONFIG_FILE = 'chrome_path.txt';
const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

// ВАЛИДАТОР ЮЗЕРНЕЙМОВ
// Нормализует регистр, обрезает мусор, проверяет длину и символы
function validateUsername(str) {
    if (typeof str !== 'string') return null;
    const normalized = str.trim().toLowerCase();
    if (normalized.length < 1 || normalized.length > 30) return null;
    if (!/^[a-z0-9._-]+$/.test(normalized)) return null;
    return normalized;
}

// УНИВЕРСАЛЬНЫЙ ПАРСЕР (поддерживает все форматы Instagram)
function parseInstagramJson(data) {
    const users = new Set();
    const ignoreList = ['p', 'reels', 'explore', 'stories', 'direct', 'accounts', 'hashtag'];

    const addUser = (str) => {
        const username = validateUsername(str);
        if (username && !ignoreList.includes(username)) {
            users.add(username);
        }
    };

    const walk = (obj) => {
        if (!obj) return;

        if (Array.isArray(obj)) {
            obj.forEach(item => walk(item));
        } else if (typeof obj === 'object') {
            if (obj.title && typeof obj.title === 'string' && obj.title.trim()) {
                addUser(obj.title);
                return;
            }
            if (obj.string_list_data && Array.isArray(obj.string_list_data)) {
                obj.string_list_data.forEach(item => {
                    if (item.value) addUser(item.value);
                    else if (item.href) {
                        const m = item.href.match(/instagram\.com\/(?!_u\/)([a-zA-Z0-9._]+)/);
                        if (m) addUser(m[1]);
                    }
                });
                return;
            }
            Object.values(obj).forEach(val => walk(val));
        }
    };

    walk(data);
    return [...users];
}

// ЛОГИРОВАНИЕ ОШИБОК
function logError(err) {
    console.log(`\n❌ ОШИБКА: ${err.message}`.red);
    const timestamp = new Date().toISOString();
    fs.appendFileSync('error.log', `\n[${timestamp}]\n${err.stack}\n`);
}

// ПОЛУЧЕНИЕ ПУТИ ДО CHROME
async function getChromePath(rl) {
    if (fs.existsSync(CONFIG_FILE)) {
        const saved = fs.readFileSync(CONFIG_FILE, 'utf-8').trim();
        if (fs.existsSync(saved)) return saved;
    }

    if (fs.existsSync(CHROME_PATH_DEFAULT)) return CHROME_PATH_DEFAULT;

    console.log('\n⚠️  Chrome не найден по стандартному пути.'.yellow);
    console.log('   Найди chrome.exe у себя и скопируй путь сюда.'.gray);
    console.log('   Обычно это: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'.gray);

    const path = await new Promise(resolve => {
        rl.question('\n📂 Введи путь до chrome.exe: '.cyan.bold, answer => {
            resolve(answer.trim().replace(/^["'']|["'']$/g, ''));
        });
    });

    if (!fs.existsSync(path)) {
        console.log('❌ По этому пути Chrome не найден. Проверь и запусти снова.'.red);
        process.exit(1);
    }

    fs.writeFileSync(CONFIG_FILE, path, 'utf-8');
    console.log('✅ Путь сохранён, в следующий раз спрашивать не буду.'.green);
    return path;
}

// ФУНКЦИЯ СКРОЛЛА ДЛЯ РЕЖИМА 1
async function scrollAndCollect(page) {
    const users = new Set();
    let previousSize = 0;
    let attempts = 0;

    process.stdout.write('\n');

    while (true) {
        const currentBatch = await page.$$eval('div[role=dialog] a', as => as.map(a => a.href));
        currentBatch.forEach(link => {
            const match = link.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?/);
            const ignoreList = ['p', 'reels', 'explore', 'stories', 'direct', 'accounts', 'hashtag'];
            if (match && match[1] && !ignoreList.includes(match[1])) {
                const username = validateUsername(match[1]);
                if (username) users.add(username);
            }
        });

        if (users.size !== previousSize) {
            process.stdout.write(`\r   🔍 Собрано аккаунтов: ${users.size}`.cyan);
            previousSize = users.size;
            attempts = 0;
        } else {
            attempts++;
        }

        const scrolled = await page.evaluate(() => {
            const dialog = document.querySelector("div[role=dialog]");
            if (!dialog) return false;
            const scrollableDiv = Array.from(dialog.querySelectorAll('div')).find(div => div.scrollHeight > div.clientHeight);
            if (!scrollableDiv) return false;
            const oldTop = scrollableDiv.scrollTop;
            scrollableDiv.scrollTop += 300;
            return scrollableDiv.scrollTop > oldTop;
        });

        if (!scrolled) {
            await delay(3000);
        } else {
            await delay(500);
        }

        if (attempts > 15) break;
    }

    console.log('\n');
    return [...users];
}

// ОТРИСОВКА МЕНЮ
function printMenu() {
    console.log('╔════════════════════════════════════════╗'.magenta);
    console.log('║   🕵️‍♂️  INSTAGRAM TRACKER : DUAL MODE    ║'.white.bold);
    console.log('╚════════════════════════════════════════╝'.magenta);
    console.log('');
    console.log('  Программа показывает кто не подписан на тебя в ответ.'.gray);
    console.log('  Результат сохраняется в .csv и .txt файл рядом с программой.'.gray);
    console.log('');
    console.log('──────────────────────────────────────────'.magenta);
    console.log('  1. 🚀 ТУРБО  —  через браузер'.white.bold);
    console.log('──────────────────────────────────────────'.magenta);
    console.log('  Как работает:'.gray);
    console.log('  → Открывается Chrome, ты вручную входишь в Instagram'.gray);
    console.log('  → Программа сама листает подписчиков и подписки'.gray);
    console.log('  → Сравнивает и выдаёт результат'.gray);
    console.log('');
    console.log('  ✅ Самые точные данные — всё в реальном времени'.green);
    console.log('  ✅ Удалённые аккаунты не попадают в список крыс'.green);
    console.log('  ⚠️  Нужен Google Chrome на компьютере'.yellow);
    console.log('  ⚠️  Нужно вручную войти в аккаунт'.yellow);
    console.log('  ⚠️  Инста иногда просит капчу или код из SMS'.yellow);
    console.log('  ⚠️  Чем больше подписок — тем дольше (~1 мин на 500 чел)'.yellow);
    console.log('');
    console.log('──────────────────────────────────────────'.magenta);
    console.log('  2. 📦 АРХИВ  —  через выгрузку данных'.white.bold);
    console.log('──────────────────────────────────────────'.magenta);
    console.log('  Как получить архив:'.gray);
    console.log('  → Инстаграм → Настройки → В поиск ввести "Скачивание вашей информации"'.gray);
    console.log('     или "Экспорт вашей информации"'.gray);
    console.log('  → Подготовить файлы экспорта'.gray);
    console.log('  → Выбрать информацию → Убрать галочки со всего кроме "Подписки и подписчики"'.gray);
    console.log('  → Диапазон дат → Всё время → Формат → JSON'.gray);
    console.log('  → Instagram пришлёт ссылку на почту'.gray);
    console.log('  → Скачай .zip и положи рядом с программой'.gray);
    console.log('');
    console.log('  ✅ Не нужен браузер и вход в аккаунт'.green);
    console.log('  ✅ Работает быстро — результат за секунду'.green);
    console.log('  ✅ Безопасно — данные не покидают твой компьютер'.green);
    console.log('  ✅ Точность тоже 100%'.green);
    console.log('  ⚠️  Архив нужно заказывать заранее (ждать от 10 минут до 1-2 дня)'.yellow);
    console.log('  ⚠️  Удалённые аккаунты могут попасть в список крыс'.yellow);
    console.log('');
    console.log('──────────────────────────────────────────'.magenta);
}

// ОСНОВНОЙ ЦИКЛ
(async () => {
    console.clear();
    printMenu();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    while (true) {
        const MODE = await new Promise(resolve => {
            rl.question('\n🎯 Выбери режим (введи 1 или 2): '.cyan.bold, answer => {
                resolve(answer.trim());
            });
        });

        if (MODE === '1') {
            // РЕЖИМ 1: PUPPETEER
            const USERNAME = await new Promise(resolve => {
                rl.question('\n🎯 Введи СВОЙ никнейм: '.cyan.bold, target => {
                    resolve(target.trim().toLowerCase());
                });
            });

            if (!USERNAME) {
                console.log('❌ Никнейм не введен.'.red);
            } else {
                const CHROME_PATH = await getChromePath(rl);
                let browser = null;

                process.on('SIGINT', async () => {
                    console.log('\n⚠️  Прерывание! Закрываю браузер...'.yellow);
                    if (browser) await browser.close();
                    process.exit(0);
                });

                try {
                    browser = await puppeteer.launch({
                        headless: false,
                        executablePath: CHROME_PATH,
                        defaultViewport: null,
                        args: ['--start-maximized']
                    });

                    const page = await browser.newPage();
                    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

                    console.log('\n🚀 Открыт браузер!'.yellow);
                    console.log('👉 Войди в свой аккаунт ВРУЧНУЮ (логин + пароль).'.cyan);
                    console.log('🔒 Скрипт НЕ видит твои пароли. Просто ждет входа...'.gray);

                    await page.waitForSelector('svg[aria-label="Home"], svg[aria-label="Главная"], a[href="/"]', { timeout: 0 });

                    console.log('✅ Вход выполнен! Начинаем сбор данных...'.green);
                    await delay(3000);

                    await page.goto(`https://www.instagram.com/${USERNAME}/`, { waitUntil: 'networkidle2' });

                    console.log('\n👥 Собираем подписчиков...'.cyan);
                    await page.click(`a[href="/${USERNAME}/followers/"]`);
                    await page.waitForSelector('div[role=dialog]', { timeout: 15000 });
                    const followers = await scrollAndCollect(page);

                    await page.reload({ waitUntil: 'networkidle2' });
                    await delay(3000);

                    console.log('👤 Собираем подписки...'.cyan);
                    await page.click(`a[href="/${USERNAME}/following/"]`);
                    await page.waitForSelector('div[role=dialog]', { timeout: 15000 });
                    const following = await scrollAndCollect(page);

                    const followersSet = new Set(followers);
                    const followingSet = new Set(following);

                    const notFollowingBack = following.filter(u => !followersSet.has(u));
                    const fans = followers.filter(u => !followingSet.has(u));
                    const mutual = following.filter(u => followersSet.has(u));

                    console.log('\n--- ИТОГОВЫЙ СПИСОК ---'.bold);
                    notFollowingBack.forEach(u => console.log(`[КРЫСА] ${u}`.red));
                    fans.forEach(u => console.log(`[ФАНАТ] ${u}`.blue));
                    mutual.forEach(u => console.log(`[ВЗАИМНО] ${u}`.green));

                    let csv = '\ufeffUsername,Status,Type\n';
                    notFollowingBack.forEach(u => (csv += `${u},🔴 Не подписан в ответ,Крыса\n`));
                    fans.forEach(u => (csv += `${u},🔵 Твой фанат,Фанат\n`));
                    mutual.forEach(u => (csv += `${u},🟢 Взаимно,Друг\n`));

                    const fileName = `${USERNAME}_followers.csv`;
                    fs.writeFileSync(fileName, csv, 'utf-8');

                    console.log('\n======================================'.magenta);
                    console.log(`✅ Готово! Файл сохранен как: ${fileName}`.green.bold);
                    console.log(`   🔴 Крыс:     ${notFollowingBack.length}`.red);
                    console.log(`   🔵 Фанатов:  ${fans.length}`.blue);
                    console.log(`   🟢 Взаимных: ${mutual.length}`.green);
                    console.log('======================================'.magenta);

                } catch (err) {
                    logError(err);
                } finally {
                    if (browser) await browser.close();
                }
            }

        } else if (MODE === '2') {
            // РЕЖИМ 2: АРХИВ .ZIP
            try {
                console.log('\n🔎 Ищу .zip архив в текущей папке...'.yellow);

                const files = fs.readdirSync('./');
                const zipFileName = files.find(file => file.endsWith('.zip'));

                if (!zipFileName) {
                    console.log('❌ ОШИБКА: Архив .zip не найден!'.red);
                } else {
                    console.log(`📦 Найден архив: ${zipFileName}`.cyan);
                    console.log('🛡️  Извлекаю данные прямо из памяти...\n'.green);

                    const zip = new AdmZip(zipFileName);
                    const zipEntries = zip.getEntries();

                    const skipWords = ['close_friends', 'requests', 'blocked', 'muted', 'hashtags', 'removed', 'hide_story', 'unfollowed', 'pending'];

                    let followersData = null;
                    let followingData = null;

                    for (const entry of zipEntries) {
                        const name = entry.name.toLowerCase();
                        const fullPath = entry.entryName.toLowerCase();

                        if (!name.endsWith('.json')) continue;
                        if (skipWords.some(w => fullPath.includes(w))) continue;
                        if (!fullPath.includes('followers_and_following')) continue;

                        const isFollowers = name.startsWith('followers');
                        const isFollowing = name.startsWith('following');

                        if (!isFollowers && !isFollowing) continue;

                        let parsed;
                        try {
                            parsed = JSON.parse(zip.readAsText(entry));
                        } catch (parseErr) {
                            console.log(`⚠️  Пропущен битый файл: ${entry.name}`.yellow);
                            continue;
                        }

                        if (isFollowers) {
                            console.log(`   📄 Читаю (подписчики): ${entry.name}`.gray);
                            if (!followersData) followersData = [];
                            followersData.push(parsed);
                        } else if (isFollowing) {
                            console.log(`   📄 Читаю (подписки):   ${entry.name}`.gray);
                            if (!followingData) followingData = [];
                            followingData.push(parsed);
                        }
                    }

                    if (!followersData || !followingData) {
                        console.log('\n❌ ОШИБКА: Нужные JSON файлы не найдены внутри архива!'.red);
                    } else {
                        const followers = parseInstagramJson(followersData);
                        const following = parseInstagramJson(followingData);

                        console.log(`\n📊 Статистика из архива:`.yellow);
                        console.log(`   Подписчиков: ${followers.length}`);
                        console.log(`   Подписок:    ${following.length}`);

                        const followersSet = new Set(followers);
                        const followingSet = new Set(following);

                        const notFollowingBack = following.filter(u => !followersSet.has(u));
                        const fans = followers.filter(u => !followingSet.has(u));
                        const mutual = following.filter(u => followersSet.has(u));

                        console.log(`\n🔴 КРЫСЫ — не подписаны в ответ (${notFollowingBack.length}):`.red.bold);
                        if (notFollowingBack.length === 0) {
                            console.log('   Крыс не обнаружено! 🎉'.green);
                        } else {
                            notFollowingBack.forEach(u => console.log(`   ${u}`.red));
                        }

                        let csv = '\ufeffUsername,Status\n';
                        notFollowingBack.forEach(u => (csv += `${u},🔴 Крыса\n`));
                        fans.forEach(u => (csv += `${u},🔵 Фанат\n`));
                        mutual.forEach(u => (csv += `${u},🟢 Взаимно\n`));
                        fs.writeFileSync('archive_report.csv', csv, 'utf-8');

                        let report = `ОТЧЕТ АНАЛИЗА ИНСТАГРАМ\n`;
                        report += `Подписчиков: ${followers.length} | Подписок: ${following.length}\n\n`;
                        report += `🔴 КРЫСЫ (${notFollowingBack.length}):\n` + notFollowingBack.join('\n') + '\n\n';
                        report += `🔵 ФАНАТЫ (${fans.length}):\n` + fans.join('\n') + '\n\n';
                        report += `🟢 ВЗАИМНО (${mutual.length}):\n` + mutual.join('\n');
                        fs.writeFileSync('archive_report.txt', report, 'utf-8');

                        console.log('\n======================================'.magenta);
                        console.log(`✅ Готово! Сохранены файлы:`.green.bold);
                        console.log(`   📄 archive_report.txt`);
                        console.log(`   📊 archive_report.csv`);
                        console.log(`   🔴 Крыс:     ${notFollowingBack.length}`.red);
                        console.log(`   🔵 Фанатов:  ${fans.length}`.blue);
                        console.log(`   🟢 Взаимных: ${mutual.length}`.green);
                        console.log('======================================'.magenta);
                    }
                }
            } catch (err) {
                logError(err);
            }

        } else {
            console.log('❌ Неверный выбор. Введи 1 или 2.'.red);
        }

        // Пауза перед возвратом в меню
        await new Promise(resolve => {
            rl.question('\n↩️  Нажми Enter чтобы вернуться в меню...'.gray, () => resolve());
        });

        console.clear();
        printMenu();

    }
})();