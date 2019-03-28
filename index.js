// This code is a part of MagicCap which is a MPL-2.0 licensed project.
// Copyright (C) Jake Gealer <jake@gealer.email> 2019.
// Copyright (C) Rhys O'Kane <SunburntRock89@gmail.com> 2019.

// Defines the required imports.
const { ipcMain, BrowserWindow, app } = require("electron");
const uuidv4 = require('uuid/v4');
const os = require("os");
const path = require("path");
const asyncChildProcess = require("async-child-process");
const b64 = require("base64-async");
const { spawn } = require("child_process");
const { get } = require("chainfetch");

// Defines the platform.
const platform = os.platform();
let fullPlatform = platform;
if (platform === "win32") {
    fullPlatform += ".exe";
}

// Defines the HTTP server.
const screenshotServer = spawn(`${__dirname}${path.sep}bin${path.sep}screenshot-display-${fullPlatform}`, {
    detached: false,
});
let screenshotServerKey;
screenshotServer.stdout.on("data", key => {
    if (!screenshotServerKey) {
        screenshotServerKey = key;
    }
})

// Spawns all browser windows.
const spawnWindows = displays => {
    const windows = [];
    for (let i of displays) {
        let win = new BrowserWindow({
            frame: false,
            alwaysOnTop: true,
            show: false,
            width: i.bounds.width,
            height: i.bounds.height,
        })
        win.setVisibleOnAllWorkspaces(true)
        win.setPosition(i.bounds.x, i.bounds.y)
        win.setMovable(false)
        windows.push(win)
    }
    return windows;
};

// Gets the displays in order.
const getOrderedDisplays = () => {
    const electronScreen = require("electron").screen;
    return electronScreen.getAllDisplays().sort((a, b) => {
        let sub = a.bounds.x - b.bounds.x;
        if (sub === 0) {
            if (a.bounds.y > b.bounds.y) {
                sub -= 1;
            } else {
                sub += 1;
            }
        }
        return sub;
    });
};

// Defines all of the spawned windows.
let spawnedWindows;
const appPrep = () => {
    if (platform !== "linux") {
        const spawnEm = () => {
            const displays = getOrderedDisplays();
            spawnedWindows = spawnWindows(displays);
        };
        spawnEm();
        const electronScreen = require("electron").screen;
        electronScreen.on("display-added", spawnEm);
        electronScreen.on("display-removed", spawnEm);
    }
};
app.on("ready", appPrep);

// Gets the values of a object.
const values = item => {
	const x = [];
	for (const i in item) {
		x.push(item[i]);
	}
	return x;
};

// Defines if the selector is active.
let selectorActive = false;

// Decodes all of the base 64.
const decodeB64 = async shotList => {
    const promises = [];
    for (const shot of shotList) {
        promises.push(b64.decode(shot));
    }
    return Promise.all(promises);
};

// Opens the region selector.
module.exports = async buttons => {
    if (selectorActive) {
        return;
    }

    const electronScreen = require("electron").screen;

    const displays = getOrderedDisplays();

    let primaryId = 0;
    const x = electronScreen.getPrimaryDisplay().id;
    for (const display of displays) {
        if (display.id === x) {
            primary = display;
            break;
        }
        primaryId += 1;
    }

    const activeWindows = [];
    if (os.platform() === "darwin") {
        const { stdout } = await asyncChildProcess.execAsync(`"${__dirname}${path.sep}bin${path.sep}get-visible-windows-darwin"`);
        const windowsSplit = stdout.trim().split("\n");
        for (const window of windowsSplit) {
            const intRectangleParts = [];
            for (textRectangle of window.split(" ")) {
                intRectangleParts.push(parseInt(textRectangle));
            }
            activeWindows.push({
                x: intRectangleParts[0],
                y: intRectangleParts[1],
                width: intRectangleParts[2],
                height: intRectangleParts[3],
            });
        }
    }

    const displayPromise = async display => {
        const data = await get(`http://127.0.0.1:63431/?key=${screenshotServerKey}&display=${display}`).toBuffer();
        return b64.encode(data.body);
    }

    const promises = [];

    // Shoves everything in the background.
    (() => {
        for (const displayId in displays) {
            const promise = displayPromise(displayId);
            promise;
            promises.push(promise);
        }
    })();

    let screenshots = await Promise.all(promises);

    let screens;
    if (!spawnedWindows) {
        screens = spawnWindows(displays);
    } else {
        screens = spawnedWindows;
    }

    const uuidDisplayMap = {};
    for (const screenNumber in screens) {
        const screen = screens[screenNumber];
        screen.loadURL(`file://${__dirname}/selector.html#${screenNumber}`);
        const uuid = uuidv4();
        uuidDisplayMap[screenNumber] = uuid;
        await ipcMain.once(`screen-${screenNumber}-load`, async() => {
            await screen.webContents.send("load-reply", {
                mainDisplay: screenNumber == primaryId,
                screenshot: screenshots[screenNumber],
                buttons: buttons,
                displayNumber: screenNumber,
                uuid: uuid,
                bounds: displays[screenNumber].bounds,
                activeWindows: activeWindows,
            });
        });
        setTimeout(() => {
            screen.show();
            screen.setFullScreen(true);
        }, 150);
        ipcMain.on(`${uuid}-event-send`, (_, args) => {
            for (const browser of screens) {
                browser.webContents.send("event-recv", {
                    type: args.type,
                    display: screenNumber,
                    args: args.args,
                });
            }
        });
    }
    selectorActive = true;
    const r = await new Promise(res => {
        ipcMain.once("screen-close", async(_, args) => {
            for (const uuid of values(uuidDisplayMap)) {
                await ipcMain.removeAllListeners(`${uuid}-event-send`);
            }
            await ipcMain.removeAllListeners("event-recv");
            selectorActive = false;
            const these = screens;
            for (const screen of these) {
                await screen.setFullScreen(false);
                await screen.setSimpleFullScreen(false);
                await screen.setSize(0, 0);
                await screen.close();
            }
            screens = [];
            if (args === undefined) {
                res(null);
            } else {
                res({
                    start: {
                        x: args.startX,
                        y: args.startY,
                        pageX: args.startPageX,
                        pageY: args.startPageY,
                    },
                    end: {
                        x: args.endX,
                        y: args.endY,
                        pageX: args.endPageX,
                        pageY: args.endPageY,
                    },
                    display: args.display,
                    screenshots: await decodeB64(screenshots),
                    activeWindows: activeWindows,
                    selections: args.selections,
                    width: args.width,
                    height: args.height,
                })
            }
        })
    });
    appPrep();
    return r;
};
