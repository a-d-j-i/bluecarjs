
// Characteristic object cache
let characteristicCache = null;
// Selected device object cache
let deviceCache = null;

function handleDisconnection(event) {
    let device = event.target;
    log('"' + device.name + '" bluetooth device disconnected, trying to reconnect...');
    deviceCache = null;
    connect();
}

// Intermediate buffer for incoming data
//let readBuffer = '';
function handleCharacteristicValueChanged(event) {
    let value = new TextDecoder().decode(event.target.value);
    log(value, 'in');
    /*for (let c of value) {
     if (c === '\n') {
     let data = readBuffer.trim();
     readBuffer = '';
     if (data) {
     log(data, 'in');
     }
     } else {
     readBuffer += c;
     }
     }*/
}


function log(data, type = '') {
    terminalContainer.insertAdjacentHTML('beforeend',
            '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
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
            characteristic.startNotifications().then(() => {
                log('Notifications started');
                characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                characteristicCache = characteristic;
            });
            log("DONE");
        } catch (err) {
            console.error("ERROR", err);
            log("ERROR" + err);
        }
    }
}
async function send(data) {
    data = String(data);
    if (!data || !characteristicCache) {
        return;
    }
    characteristicCache.writeValue(new TextEncoder().encode(data));
    log(data, 'out');
}

function disconnect() {
    if (deviceCache) {
        log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
        deviceCache.removeEventListener('gattserverdisconnected', handleDisconnection);
        if (deviceCache.gatt.connected) {
            deviceCache.gatt.disconnect();
            log('"' + deviceCache.name + '" bluetooth device disconnected');
        } else {
            log('"' + deviceCache.name + '" bluetooth device is already disconnected');
        }
    }
    if (characteristicCache) {
        characteristicCache.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        characteristicCache = null;
    }
    deviceCache = null;
}




// Get references to UI elements
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
// Connect to the device on Connect button click
connectButton.addEventListener('click', connect);
disconnectButton.addEventListener('click', disconnect);
sendForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form sending
    send(inputField.value); // Send text field contents
    inputField.value = ''; // Zero text field
    inputField.focus(); // Focus on text field
});








const $button = document.getElementById("button");
const $main = document.getElementById("main");
$button.addEventListener("click", async () => {
    try {
        const h2 = document.createElement("h2");
        h2.textContent = "data";
        $main.innerHTML = "<h1>RET:</h1>";
        $main.appendChild(h2);
    } catch (e) {
        const $err = document.createElement("code");
        $err.style.color = "#f66";
        $err.textContent = String(e.message || e);
        $main.appendChild($err);
        throw e;
    }
}
);
