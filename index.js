#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

// puppeteer-extra is a drop-in replacement for puppeteer, 
// it augments the installed puppeteer with plugin functionality 
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth') 
puppeteer.use(StealthPlugin()) 

const {executablePath} = require('puppeteer')

const argv = yargs(hideBin(process.argv))
    .option('mode', {
        alias: 'm',
        describe: 'which bulk search mode to use',
        choices: ['file', 'combo']
    })
    .option('output', {
        alias: 'o',
        describe: 'file to output available plates',
    })
    .option('outputUnavailable', {
        describe: 'file to output UNavailable plates (for whatever reason)',
    })
    .option('showUnavailable', {
        describe: 'display unavailable tested plates alongside available ones when finished',
    })
    .option('queueSize', {
        describe: 'how many requests to send at once (more = faster but more intensive)',
        type: 'number',
        default: 200
    })
    .option('count', {
        describe: '(combo mode) how many characters for generating combinations',
        default: 2,
        type: 'number'
    })
    .option('chars', {
        describe: '(combo mode) which characters for generating combinations',
        default: 'abcdefghijklmnopqrstuvwxyz0123456789',
        type: 'string'
    })
    .option('countUp', {
        describe: '(combo mode) whether to generate strings of length 2-count rather than just count (i.e. --count 6 --countUp will generate plates that are 2, 3, 4, 5 and 6 characters in length)',
    })
    .option('file', {
        describe: '(file mode) file to pull plates from (newline separated)',
        type: 'string'
    })
    .option('progUpdate', {
        describe: 'how often to update the progress bar (in milliseconds)',
        type: 'number',
        default: 100
    })
    .option('progSize', {
        describe: 'how many characters wide the progress bar is',
        type: 'number',
        default: 30
    })
    .option('progFill', {
        describe: 'character to use for the "full" part of the progress bar',
        type: 'string',
        default: '='
    })
    .option('progEmpty', {
        describe: 'character to use for the "empty" part of the progress bar',
        type: 'string',
        default: ' '
    })
    .argv;

function programCallback(val) {
    console.log('Done!');
    if(val.available.length > 0)
    {
        console.log('Available plates: ');
        console.log(val.available);
    }
    else
    {
        console.log('None of those plates were available :(');
    }

    if(argv.showUnavailable)
    {
        console.log('Unavailable plates: ');
        console.log(val.unavailable);
    }

    if(argv.output)
        fs.writeFileSync(argv.output, val.available.toString());
    if(argv.outputUnavailable)
        fs.writeFileSync(argv.outputUnavailable, val.unavailable.toString());
}

function getValidPlate(line) {
    const regex = RegExp('^[a-zA-Z0-9]*$');
    line = line.toString().toUpperCase();
    let result = { plate: line, available: false };
    if (!regex.test(line))
    {
        result.error = "Non-alphanumeric character(s)";
        return new Promise((res, rej) => {
            res(result);
        });
    }
    return puppeteer.launch({ headless: true, executablePath: executablePath() }).then(async browser => { 
        const page = await browser.newPage() 
        await page.goto(`https://vplates.com.au/vplatesapi/checkcombo?vehicleType=car&combination=${line}&_=${Date.now()}`);
        const html = await page.evaluate(() => document.body.innerHTML);
        const json = JSON.parse(html.match(/<pre.*>([\s\S]*)<\/pre>/)[1]);
        if (json.success) {
            result.available = true;
        } else {
            result.error = "Failed to get JSON from website";
        }
        await browser.close() 
        return result;
    })
    .catch(error => {
        result.error = error;
        return result;
    });   
}

function getValidPlates(arr) {
    let lastPrintTime = Date.now();
    let printInterval = argv.progUpdate ?? 100;
    let totalItems = arr.length;
    console.log(`Getting available plates of ${totalItems} items`);
    return new Promise((res, rej) => {
        const QUEUE_SIZE = argv.queueSize ?? 200;
        let processing = 0;
        let valids = [];
        let invalids = [];

        function popCallback() {
            let startedCallback = false;
            while (arr.length > 0 && processing < QUEUE_SIZE) {
                processing++;
                startedCallback = true;
                process.setMaxListeners(QUEUE_SIZE);
                getValidPlate(arr.pop())
                    .then((val) => {
                        processing--;
                        if (val.available)
                            valids.push(val.plate);
                        else
                            invalids.push(val.plate);
                        
                        let totalProcessed = valids.length + invalids.length;
                        if(Date.now() - lastPrintTime >= printInterval || totalProcessed == totalItems)
                        {
                            lastPrintTime = Date.now();

                            let percentageComplete = totalProcessed / totalItems;
                            const progressBarSize = argv.progSize ?? 30;
                            const filledChar = argv.progFill ?? '=';
                            const emptyChar = argv.progEmpty ?? ' ';

                            let progressBar = "";
                            for(let i = 0; i < progressBarSize; ++i)
                            {
                                if(i/progressBarSize < percentageComplete)
                                    progressBar += filledChar;
                                else
                                    progressBar += emptyChar;
                            }

                            let msg = `[${progressBar}] ${Math.floor(percentageComplete*100)}% complete (${totalProcessed}/${totalItems} - ${valids.length} available plates)`;

                            if(process.stdout.isTTY)
                            {
                                process.stdout.clearLine();
                                process.stdout.cursorTo(0);
                                process.stdout.write(msg);
                            }
                            else
                            {
                                console.log(msg);
                            }
                        }
                        
                        popCallback();
                    });
            }

            if (!startedCallback && processing == 0 && arr.length == 0) {
                valids = valids.sort();
                invalids = invalids.sort();

                let result = {available: valids, unavailable: invalids};

                console.log('');
                res(result);
            }
        }

        popCallback();
    });
}

function getLinesFromFile(filename) {
    return new Promise((resolve, reject) => {
        let allLines = [];

        const rd = readline.createInterface({
            input: fs.createReadStream(filename),
            console: false
        });

        rd.on('line', function (line) {
            allLines.push(line);
        });

        rd.on('close', function () {
            resolve(allLines);
        });
    });
}

function getValidPlatesFromFile(filename) {
    return getLinesFromFile(filename)
        .then((vals) => getValidPlates(vals));
}

function getCombinationsOfLength(letters, length) {
    let combinations = [];
    let indices = [];
    for(let i = 0; i < length; ++i)
        indices.push(0);
    
    function iterate(combs, lets, thisIndex, allIndices) {
        if(thisIndex >= allIndices.length)
            return;

        let thisString = "";
        for(let i = 0; i < allIndices.length; ++i)
            thisString += lets[allIndices[i]];
        if(!combs.includes(thisString))
            combs.push(thisString);

        if(allIndices[thisIndex] + 1 < lets.length)
        {
            let newIndices = Array.from(allIndices);
            newIndices[thisIndex]++;
            iterate(combs, lets, thisIndex, newIndices);
        }

        if(thisIndex + 1 < allIndices.length && allIndices[thisIndex+1] < lets.length)
        {
            let moreIndices = Array.from(allIndices);
            iterate(combs, lets, thisIndex+1, moreIndices);
        }
    }

    iterate(combinations, letters, 0, indices);

    return combinations;
}

if(argv.mode == 'combo')
{
    let comboCount = argv.count ?? 2;
    let comboLetters = argv.chars ?? 'abcdefghijklmnopqrstuvwxyz0123456789';

    console.log(`Generating every ${argv.countUp ? '2-' : ''}${comboCount} character combination of the characters '${comboLetters}'`);
    let combinations = getCombinationsOfLength(comboLetters, comboCount);

    if(argv.countUp)
    {
        for(let i = comboCount-1; i >= 2; --i)
        {
            combinations = combinations.concat(getCombinationsOfLength(comboLetters, i));
        }
    }

    getValidPlates(combinations).then(programCallback);
}
else if(argv.mode == 'file')
{
    if(argv.file == null)
    {
        throw new Error("'--mode file' needs a --file parameter (--file [filename])");
    }
    getValidPlatesFromFile(argv.file).then(programCallback);
}
else
{
    let singlePlate = argv._[0];
    if(singlePlate)
    {
        getValidPlate(singlePlate).then((val) => { console.log(`'${val.plate}' is ${val.available ? 'AVAILABLE!' : 'unavailable'}`);});
    }
    else
    {
        throw new Error("invalid input");
    }
}