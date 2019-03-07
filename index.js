// This code is a part of MagicCap which is a MPL-2.0 licensed project.
// Copyright (C) Jake Gealer <jake@gealer.email> 2019.
// Copyright (C) Rhys O'Kane <SunburntRock89@gmail.com> 2019.

// Defines the main IPC.
const { ipcMain, BrowserWindow, Rectangle } = require("electron");
const uuidv4 = require('uuid/v4');
const os = require("os");
const path = require("path");
const asyncChildProcess = require("async-child-process");

// Defines the platform.
const platform = os.platform();
let fullPlatform = platform;
if (platform === "win32") {
    fullPlatform += ".exe";
}

// Spawns all browser windows.
const spawnWindows = displays => {
    const windows = [];
    for (let i of displays) {
        let win = new BrowserWindow({
            frame: false,
            simpleFullscreen: true,
            fullscreen: true,
            alwaysOnTop: true,
            show: false,
        })
        win.once("ready-to-show", () => {
            win.show();
        })
        win.setPosition(i.bounds.x, i.bounds.y)
        win.setMovable(false)
        windows.push(win)
    }
    return windows;
};

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

// Opens the region selector.
module.exports = async buttons => {
    if (selectorActive) {
        return;
    }

    const electronScreen = require("electron").screen;

    const displays = electronScreen.getAllDisplays().sort((a, b) => {
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
        for (window of windowsSplit) {
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
        const { stdout } = await asyncChildProcess.execAsync(`"${__dirname}${path.sep}bin${path.sep}screenshot-display-${fullPlatform}" ${display}`, {
            maxBuffer: 999999999,
        });
        return new Buffer.from(stdout, "base64");
    }

    const promises = [];
    for (const displayId in displays) {
        promises.push(displayPromise(displayId));
    }

    let screenshots = await Promise.all(promises);

    const screens = spawnWindows(displays);

    const uuidDisplayMap = {};
    for (const screenNumber in screens) {
        const screen = screens[screenNumber];
        screen.loadURL(`file://${__dirname}/selector.html#${screenNumber}`);
        const uuid = uuidv4();
        uuidDisplayMap[screenNumber] = uuid;
        ipcMain.once(`screen-${screenNumber}-load`, event => {
            event.returnValue = {
                mainDisplay: screenNumber == primaryId,
                screenshot: screenshots[screenNumber],
                buttons: buttons,
                displayNumber: screenNumber,
                uuid: uuid,
                activeWindows: activeWindows,
            };
        });
        ipcMain.on(`${uuid}-event-send`, (_, args) => {
            for (const otherUuid of values(uuidDisplayMap)) {
                if (otherUuid !== uuid) {
                    for (const browser of screens) {
                        browser.webContents.send(`${otherUuid}-event-recv`, {
                            type: args.type,
                            display: screenNumber,
                            args: args.args,
                        });
                    }
                }
            }
        });
    }
    selectorActive = true;
    return await new Promise(res => {
        ipcMain.once("screen-close", async(_, args) => {
            for (const uuid of values(uuidDisplayMap)) {
                await ipcMain.removeAllListeners(`${uuid}-event-send`);
                await ipcMain.removeAllListeners(`${uuid}-event-recv`);
            }
            selectorActive = false;
            for (screen of screens) {
                await screen.hide();
                await screen.close();
            }
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
                    screenshots: screenshots,
                    activeWindows: activeWindows,
                })
            }
        })
    });
};