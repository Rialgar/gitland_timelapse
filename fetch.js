const simpleGit = require('simple-git/promise');
const fs = require('fs');
const first = "4a9cd04a52a2d92feab9f7757386c5e5dc4124ea";

const latestJSONFile = './work/latest.json';
const mapDataFile = './work/mapData';

const gitlandDir = './work/gitland/';
const currentMapFile = gitlandDir + 'map';

const pagesDir = './doc/';
//https because that works without credentials
const gitlandRepo = 'https://github.com/programical/gitland.git';

const fetchData = async () => {
    await checkFirstRun();

    if (await processNewTurns()) {
        await updatePagesDir();
    }
};

const checkFirstRun = async () => {
    try {
        await fs.promises.mkdir('work');
    } catch (e) {
        if (e.code === 'EEXIST') {
            return;
        } else {
            throw e;
        }
    }

    await Promise.all([
        simpleGit('work').clone(gitlandRepo),
        fs.promises.writeFile(mapDataFile, '', { encoding: 'UTF-8' }),
        fs.promises.writeFile(latestJSONFile, '{}', { encoding: 'UTF-8' }),
        fs.promises.mkdir(pagesDir)
    ]);
}

async function processNewTurns() {
    const gitland = simpleGit(gitlandDir);
    await gitland.checkout('master');
    await gitland.pull();
    const latest = JSON.parse(await fs.promises.readFile(latestJSONFile, { encoding: 'UTF-8' }));
    let mapData = await fs.promises.readFile(mapDataFile, { encoding: 'UTF-8' });
    let latestWidth = 0;
    let latestMap = '';
    if (latest.hash) {
        latestWidth = latest.width;
        latestMap = latest.map;
    }
    const log = await gitland.log({
        from: latest.hash || first,
        to: 'master',
        file: 'map'
    });
    if (log.total === 0) {
        console.log("no new turns");
        return false;
    }
    let writePromise = Promise.resolve(true);
    for (let i = 1; i <= log.all.length; i++) {
        console.log("" + i + " / " + log.all.length);
        const commit = log.all[log.all.length - i];
        await gitland.checkout(commit.hash);
        const map = await fs.promises.readFile(currentMapFile, { encoding: 'UTF-8' });
        const width = map.split('\n')[0].split(',').length;
        const newMap = fullRow(map);
        if (width != latestWidth) {
            mapData += String.fromCharCode(1) + width.toString() + "\n";
            mapData += String.fromCharCode(2) + newMap + "\n";
            latestWidth = width;
        }
        else {
            const theDiff = diff(latestMap, newMap);
            if (theDiff.length < newMap.length + 2) {
                mapData += theDiff + "\n";
            }
            else {
                //full stop is U+002E
                mapData += String.fromCharCode(2) + newMap + "\n";
            }
        }
        latestMap = newMap;
        if (i % 100 === 0) {
            await writePromise;
            writePromise = Promise.all([
                fs.promises.writeFile(mapDataFile, mapData, { encoding: 'UTF-8' }),
                fs.promises.writeFile(latestJSONFile, JSON.stringify({
                    hash: commit.hash,
                    width: latestWidth,
                    map: latestMap
                }), { encoding: 'UTF-8' })
            ]);
        }
    }
    await writePromise;
    await Promise.all([
        fs.promises.writeFile(mapDataFile, mapData, { encoding: 'UTF-8' }),
        fs.promises.writeFile(latestJSONFile, JSON.stringify({
            hash: log.all[0].hash,
            width: latestWidth,
            map: latestMap
        }), { encoding: 'UTF-8' })
    ]);
    return true;
}

const fullRow = map => {
    let out = '';
    const symbols = map.split('\n').join(',').split(',').filter(Boolean);
    for (let i = 0; i < symbols.length; i++) {
        out += toSingleChar(symbols[i]);
    }
    return out;
}

const diff = (oldMap, newMap) => {
    let out = '';
    if (oldMap.length != newMap.length) {
        throw new Error('Can not diff maps of different sizes');
    }
    for (let i = 0; i < oldMap.length; i++) {
        if (oldMap[i] !== newMap[i]) {
            out += String.fromCharCode(i + 20) + newMap[i];
        }
    }
    return out;
}

const toSingleChar = symbol => {
    switch (symbol) {
        case 'ux':
            return 'x';
        case 'ur':
            return 'r';
        case 'ug':
            return 'g';
        case 'ub':
            return 'b';
        case 'cr':
            return 'R';
        case 'cg':
            return 'G';
        case 'cb':
            return 'B';
        default:
            return 0;
    }
}

async function updatePagesDir() {
    const thisRepo = simpleGit('.');
    const status = await thisRepo.status();
    if (['not_added', 'conflicted', 'created', 'deleted', 'modified'].some(key => status[key].length > 0)) {
        console.log('Not updating pages dir, since we have unstaged changes');
    }
    else {
        const publicFiles = await fs.promises.readdir('./public/');
        const filesToCopy = publicFiles.map(file => ({
            from: './public/' + file,
            to: pagesDir + file
        })).concat([{
            from: mapDataFile,
            to: pagesDir + 'mapData'
        }]);
        await Promise.all(filesToCopy.map(({ from, to }) => fs.promises.copyFile(from, to)));
        const filesToDelete = (await (fs.promises.readdir(pagesDir))).map(file => pagesDir + file).filter(file => !filesToCopy.some(({ to }) => to === file));
        await Promise.all(filesToDelete.map(file => fs.promises.unlink(file)));

        await Promise.all(filesToCopy.map(({ to }) => to).concat(filesToDelete).map(file => thisRepo.add(file)));
        await thisRepo.commit("page built at " + new Date().toISOString());
        //TODO: push? */
    }
}

fetchData();