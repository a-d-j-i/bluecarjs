//window.jQuery = $ = require("jquery");
require('./node_modules/bulma/css/bulma.css');
const nipplejs = require('nipplejs');

const manager = nipplejs.create(
    {
        zone: document.getElementById('zone_joystick'),
        mode: 'static',
        size: 200,
        position: {
            left: '50%',
            top: '50%'
        },
        color: 'blue'
    }
).on('start', function (event, nipple) {
    console.log("Movement start");
}).on('move', function (event, nipple) {
    console.log("Moving");
}).on('end', function () {
    console.log("Movement end");
});
window.addEventListener("keydown", function (e) {
    // space and arrow keys
    console.log("You pressed", e);
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);
let terminalContainer = document.getElementById('terminal');
let inputField = document.getElementById('input');
let connectStatus = document.getElementById('connect_status');
let acelerometer = document.getElementById('acelerometer');
// Connect to the device on Connect button click
document.getElementById('connect').addEventListener('click', connect);
document.getElementById('disconnect').addEventListener('click', disconnect);

/*let sendForm = document.getElementById('send-form');
sendForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form sending
    send(inputField.value); // Send text field contents
    inputField.value = ''; // Zero text field
    inputField.focus(); // Focus on text field
});*/


let logBuf = [];

function log(data, type = '') {
    logBuf.push(data);
    if (logBuf.length > 20) {
        logBuf.shift();
    }
    console.log(logBuf.length, logBuf);
    terminalContainer.innerHTML = '<div' + (type ? ' class="' + type + '"' : '') + '>' + logBuf.join("<br>") + '</div>';
}


// Characteristic object cache
let characteristicCache = null;

async function handleDisconnection(event) {
    let device = event.target;
    log('"' + device.name + '" bluetooth device disconnected, trying to reconnect...');
    connectStatus.innerHTML = "DISCONNECTED";
    await disconnect();
    await connect();
}

function handleCharacteristicValueChanged(event) {
    // Limiter to 21 chars (DataView)
    let value = new TextDecoder().decode(event.target.value);
    console.log(event.target.uuid + ":" + value, 'in');
}

function getSupportedProperties(characteristic) {
    let supportedProperties = [];
    for (const p in characteristic.properties) {
        if (characteristic.properties[p] === true) {
            supportedProperties.push(p);
        }
    }
    return '[' + supportedProperties.join(', ') + ']';
}

function arrayBufferToBufferCycle(ab) {
    var buffer = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

async function connect() {
    try {
        logBuf = [];
        log('Requesting bluetooth device...');
        const device = await navigator.bluetooth.requestDevice({
            // filters: [...] <- Prefer filters to save energy & show relevant devices.
            acceptAllDevices: true,
            optionalServices: [
                "6e400001-b5a3-f393-e0a9-e50e24dcca9e".toLowerCase(),
                "00001800-0000-1000-8000-00805f9b34fb".toLowerCase(),
                "00001801-0000-1000-8000-00805f9b34fb".toLowerCase(),
            ]
        })
        log('> Name:             ' + device.name);
        log('> Id:               ' + device.id);
        log('> Connected:        ' + device.gatt.connected);
        log('"' + device.name + '" bluetooth device selected');
        device.addEventListener('gattserverdisconnected', handleDisconnection);

        log('Connecting to GATT server...');
        let server = await device.gatt.connect();
        log('> GATT server Connected:        ' + device.gatt.connected);
        const services = await server.getPrimaryServices();
        for (let service of services) {
            log('> Service: ' + service.uuid);
            const characteristics = await service.getCharacteristics();
            log('cs', characteristics);
            for (const characteristic of characteristics) {
                const props = characteristic.properties;
                log('      Characteristic: ' + characteristic.uuid + " " + getSupportedProperties(characteristic));
                if (props ['write']) {
                    log('Write ' + await characteristic.writeValue(Buffer.from('XXXX')));
                }
                if (props ['read']) {
                    log('Read ' + (arrayBufferToBufferCycle(await characteristic.readValue()).toString('hex')));
                }
                if (props ['notify'] || props ['indicate']) {
                    log('Starting notifications...');
                    log(await characteristic.startNotifications());
                    characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                    characteristicCache = characteristic;
                }
            }
        }
        log("DONE");
    } catch (err) {
        log("ERROR " + err);
        console.error("ERROR ", err, err.stackTrace);
        disconnect();
    } finally {
    }
}

async function send(data, skiplog) {
    data = String(data);
    if (!data || !characteristicCache) {
        return;
    }
    await characteristicCache.writeValue(new TextEncoder().encode(data));
    if (!skiplog) {
        log(data, 'out');
    }
}

async function disconnect() {
    if (characteristicCache) {
        characteristicCache.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        characteristicCache = null;
    }
    /*if (deviceCache) {
        log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
        deviceCache.removeEventListener('gattserverdisconnected', handleDisconnection);
        if (deviceCache.gatt.connected) {
            await deviceCache.gatt.disconnect();
            log('"' + deviceCache.name + '" bluetooth device disconnected');
        } else {
            log('"' + deviceCache.name + '" bluetooth device is already disconnected');
        }
        deviceCache = null;
    }*/
}


let actions = {
    "forward": 's255,255',
    "left": 's-255,255',
    "stop": 'st',
    "right": 's255,-255',
    "back": 's-255,-255'
};
Object.keys(actions).forEach(key => {
    document.getElementById(key).addEventListener('click', () => {
        send(actions[key], true);
    });
});


let stopped = true;

function handleOrientation(event) {
    var x = event.beta;  // In degree in the range [-180,180]
    var y = event.gamma; // In degree in the range [-90,90]

    acelerometer.innerHTML = "x : " + x + "  y: " + y;
    if (x < -15) {
        stopped = false;
        send(actions["forward"], true);
    } else if (x > 50) {
        stopped = false;
        send(actions["back"], true);
    } else if (y < -15) {
        stopped = false;
        send(actions["left"], true);
    } else if (y > 15) {
        stopped = false;
        send(actions["right"], true);
    } else {
        if (!stopped) {
            send(actions["stop"], true);
            stopped = true;
        }
    }
}

window.addEventListener('deviceorientation', handleOrientation);