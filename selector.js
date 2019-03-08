// Requires the various things which are needed.
const { ipcRenderer } = require("electron");

// Gets the display number.
const screenNumber = Number(window.location.hash.substr(1));

// Gets information about this display.
const displayInfo = ipcRenderer.sendSync(`screen-${screenNumber}-load`);

// Handles when keys are pushed.
document.addEventListener("keydown", async event => {
    switch (event.key) {
        case "Escape": {
            await ipcRenderer.send("screen-close");
            break;
        }
    }
});

// Sets the background to the screenshot taken before.
document.body.style.backgroundImage = `url("file://${__dirname}/dimmer.png"), url("data:image/png;base64,${displayInfo.screenshot.toString("base64")}")`

// Defines the position of the first click.
let firstClick = null;

// This is the element for the selection.
const element = document.getElementById("selection");

// Handles when the mouse is down.
document.body.onmousedown = async e => {
    firstClick = require("electron").screen.getCursorScreenPoint();
    firstClick.pageX = e.pageX;
    firstClick.pageY = e.pageY;
}

// Called when a event is recieved from another screen.
ipcRenderer.on(`${displayInfo.uuid}-event-recv`, (_, res) => {
    switch (res.type) {
        case "invalidate-selections": {
            element.style.width = "0px";
            element.style.height = "0px";
            break;
        }
    }
});

// Checks if a number is between other numbers. NUMBERRRRRRS!
function between(x, min, max) {
    return x >= min && x <= max;
}

// Gets the inbetween windows.
const getInbetweenWindows = electronMouse => {
    const inThese = [];

    for (const x of displayInfo.activeWindows) {
        if (between(electronMouse.x, x.x, x.x + x.width) && between(electronMouse.y, x.y, x.y + x.height)) {
            inThese.push(x);
        }
    }

    inThese.sort((a, b) => {
        return a.width - b.width;
    });

    return inThese;
}

// Called when the mouse moves.
document.body.onmousemove = e => {
    thisClick = require("electron").screen.getCursorScreenPoint();
    ipcRenderer.send(`${displayInfo.uuid}-event-send`, {
        type: "invalidate-selections",
    });
    
    if (firstClick) {
        element.style.width = `${Math.abs(e.pageX - firstClick.pageX)}px`;
        element.style.height = `${Math.abs(e.pageY - firstClick.pageY)}px`;
        element.style.left = (e.pageX - firstClick.pageX < 0) ? `${e.pageX}px` : `${firstClick.pageX}px`;
        element.style.top = (e.pageY - firstClick.pageY < 0) ? `${e.pageY}px` : `${firstClick.pageY}px`;
    } else {
        const inThese = getInbetweenWindows(thisClick);

        if (inThese.length === 0) {
            return;
        }

        const screenPart = inThese[0];
        element.style.width = `${screenPart.width}px`;
        element.style.height = `${screenPart.height}px`;
        element.style.left = `${screenPart.x - displayInfo.bounds.x}px`;
        element.style.top = `${screenPart.y - displayInfo.bounds.y}px`;
    }
}

// Called when the mouse button goes up.
document.body.onmouseup = async e => {
    let final = require("electron").screen.getCursorScreenPoint();

    if (e.pageX === firstClick.pageX) {
        firstClick = null;
        const inThese = getInbetweenWindows(thisClick);

        if (inThese.length === 0) {
            return;
        }

        const screenPart = inThese[0];

        firstClick = {
            x: screenPart.x,
            y: screenPart.y,
            pageX: element.clientLeft,
            pageY: element.clientTop,
        }

        final = {
            x: screenPart.x + screenPart.width,
            y: screenPart.y + screenPart.height,
            pageX: element.clientLeft + element.clientWidth,
            pageY: element.clientTop + element.clientHeight,
        }
    }

    final.pageX = e.pageX;
    final.pageY = e.pageY;
    let start = firstClick;
    let end = final;
    if (start.x > end.x) {
        end = start;
        start = final;
    }
    await ipcRenderer.send("screen-close", {
        startX: start.x,
        startY: start.y,
        startPageX: start.pageX,
        startPageY: start.pageY,
        endX: end.x,
        endY: end.y,
        endPageX: end.pageX,
        endPageY: end.pageY,
        display: screenNumber,
    });
}
