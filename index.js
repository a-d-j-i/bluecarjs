window.jQuery = $ = require("jquery");
require('popper.js/dist/umd/popper');
require('bootstrap/dist/js/bootstrap');
require('./node_modules/bootstrap/dist/css/bootstrap.css');



let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
let connectStatus = document.getElementById('connect_status');
let acelerometer = document.getElementById('acelerometer');
// Connect to the device on Connect button click
document.getElementById('connect').addEventListener('click', connect);
document.getElementById('disconnect').addEventListener('click', disconnect);
sendForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form sending
    send(inputField.value); // Send text field contents
    inputField.value = ''; // Zero text field
    inputField.focus(); // Focus on text field
});

function log(data, type = '') {
    terminalContainer.insertAdjacentHTML('beforeend',
            '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
}


// Characteristic object cache
let characteristicCache = null;
// Selected device object cache
let deviceCache = null;

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
    log(value, 'in');
}



async function connect() {
    if (!deviceCache) {
        try {
            log('Requesting bluetooth device...');
            //let device = await navigator.bluetooth.requestDevice({filters: [{services: [0xFFE0]}]});
            let device = await navigator.bluetooth.requestDevice({
                filters: [{services: [0xFFE0]}]
            });
            /*filters: [{namePrefix: 'HC-05'}]
             let serviceUuid = '00001101-0000-1000-8000-00805f9b34fb';
             log(serviceUuid);*/
            //let device = await navigator.bluetooth.requestDevice({filters: [{services: [serviceUuid]}]});
            log('> Name:             ' + device.name);
            log('> Id:               ' + device.id);
            log('> Connected:        ' + device.gatt.connected);
            log('"' + device.name + '" bluetooth device selected');

            deviceCache = device;
            deviceCache.addEventListener('gattserverdisconnected', handleDisconnection);
            log('Connecting to GATT server...');
            let server = await device.gatt.connect();
            log('> GATT server Connected:        ' + device.gatt.connected);
            let primary = await server.getPrimaryService(0xFFE0);
            console.log("PRIMARY", primary);
            log('got primary ' + primary);
            let characteristic = await primary.getCharacteristic(0xFFE1);
            log('got characteristic');
            characteristicCache = characteristic;
            log('Starting notifications...');
            await characteristic.startNotifications();
            log('Notifications started');
            connectStatus.innerHTML = "CONNECTED";
            characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
            characteristicCache = characteristic;
            log("DONE");
        } catch (err) {
            console.error("ERROR", err);
            log("ERROR" + err);
            disconnect();
        }
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
    if (deviceCache) {
        log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
        deviceCache.removeEventListener('gattserverdisconnected', handleDisconnection);
        if (deviceCache.gatt.connected) {
            await deviceCache.gatt.disconnect();
            log('"' + deviceCache.name + '" bluetooth device disconnected');
        } else {
            log('"' + deviceCache.name + '" bluetooth device is already disconnected');
        }
        deviceCache = null;
    }
}


let actions = {
    "forward": 'f',
    "left": 'l',
    "stop": 's',
    "right": 'r',
    "back": 'b'
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
        send('f', true);
    } else if (x > 50) {
        stopped = false;
        send('b', true);
    } else if (y < -15) {
        stopped = false;
        send('l', true);
    } else if (y > 15) {
        stopped = false;
        send('r', true);
    } else {
        if (!stopped) {
            send('s', true);
            stopped = true;
        }
    }
}
window.addEventListener('deviceorientation', handleOrientation);