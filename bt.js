(function() {

const DevEnum = require('windows.devices.enumeration');
const DevInfo = DevEnum.DeviceInformation;
const BT = require('windows.devices.bluetooth');
const BTDevice = BT.BluetoothDevice;
const Radios = require('windows.devices.radios');
const Radio = Radios.Radio;
const RadioKind = Radios.RadioKind;
const RadioState = Radios.RadioState;

var Bluetooth = {};

Bluetooth.isSupported = isSupported = async function () {
    let radios = await new Promise((res, rej) => {
        Radio.getRadiosAsync(_promiseWrapperCB(res, rej));
    });
    radios = radios.first();
    while (radios.hasCurrent) {
        let radio = radios.current;
        if(radio.kind == RadioKind.bluetooth)
            return true;
        
        radios.moveNext();
    }
    return false;
}

Bluetooth.isEnabled = isEnabled = async function () {
    let radios = await new Promise((res, rej) => {
        Radio.getRadiosAsync(_promiseWrapperCB(res, rej));
    });
    radios = radios.first();
    while (radios.hasCurrent) {
        let radio = radios.current;
        if(radio.kind == RadioKind.bluetooth && radio.state == RadioState.on)
            return true;
        
        radios.moveNext();
    }
    return false;
}

Bluetooth.enable = enable = function () {
    return new Promise((resolve, reject) => {
        Radio.getRadiosAsync((err, radios) => {
            if (err) {
                return reject(err);
            }
            radios = radios.first();
            let promises = [];
            while (radios.hasCurrent) {
                radio = radios.current;
                if(radio.kind == RadioKind.bluetooth) {
                    promises.push(new Promise((resolve, reject) => {
                        if (radio.state != RadioState.on) {
                            radio.setStateAsync(RadioState.on, (err, result) => {
                                if (result == Radios.RadioAccessStatus.allowed) {
                                    reject(); // Inverted, actually resolves
                                } else {
                                    resolve(); // Inverted, actually rejects
                                }
                            });
                        } else {
                            reject(); // Inverted, actually resolves
                        }
                    }));
                }
                radios.moveNext();
            }

            // All promises are inverted from what they should be,
            // so invert again to resolve on the first promise that
            // would actually resolve (if uninverted)
            Promise.all(promises).then(() => reject('Failed to enable any radios'), resolve);
        });
    });
}

let pairedQuery = BTDevice.getDeviceSelectorFromPairingState(true);
let unpairedQuery = BTDevice.getDeviceSelectorFromPairingState(false);


function _BTAddressToHexString(address) {
    if (typeof address !== 'number') {
        throw new Error(`Parameter address must be a number between 0 and #ffffffffffff (281474976710655).`)
    }
    if (address > 0xffffffffffff || address < 0) { // max bluetooth address value (ff:ff:ff:ff:ff:ff), must be positive
        throw new Error(`Address ${address} out of range. Must be between 0 and #ffffffffffff (281474976710655).`);
    }

    let hex = address.toString(16);
    while (hex.length < 12) {
        hex = '0' + hex;
    }
    address = '';
    for(let i = 0; i < hex.length; i += 2) {
        if (i > 0) {
            address += ':'
        }
        address += hex.substr(i,2);
    }
    return address;
}

function _BTAddressToInt(address) {
    if (typeof address !== 'string') {
        throw new Error('Parameter address must be a string of twelve hexidecimal digits, optionally separated by a colon (:) every two digits.')
    }
    if (!address.match(/(?:^[0-9a-f]{12}$)|(?:^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$)/i)) {
        throw new Error(`Invalid address string '${address}'. Must be twelve hexidecimal digits, optionally separated by a colon (:) every two digits.`);
    }

    address = address.replace(/:/g, '');
    address = parseInt(address, 16);
    return address;
}

async function _parseBTDevice(devInfo) {
    let btd = devInfo;
    if (devInfo instanceof DevInfo) {
        // btd = deasync(BTDevice.fromIdAsync)(devInfo.id);
        btd = await new Promise((res, rej) => {
            BTDevice.fromIdAsync(devInfo.id, _promiseWrapperCB(res, rej));
        });
    } else if (devInfo instanceof BTDevice) {
        devInfo = btd.deviceInformation;
    } else {
        throw new Error('Invalid argument, must be either a DeviceInformation or BluetoothDevice object.');
    }
    
    return {
        name: devInfo.name,
        paired: devInfo.pairing.isPaired,
        canPair: devInfo.pairing.canPair,
        address: _BTAddressToHexString(btd.bluetoothAddress),
        class: {
            major: btd.classOfDevice.majorClass,
            minor: btd.classOfDevice.minorClass,
            raw: btd.classOfDevice.rawValue
        },
        connected: _parseEnumValue(btd.connectionStatus, BT.BluetoothConnectionStatus) == 'connected',
        protection: _parseEnumValue(devInfo.pairing.protectionLevel, DevEnum.DevicePairingProtectionLevel)
    };
}

function _parseEnumValue(val, enumeration) {
    let keys = Object.keys(enumeration);

    for (key in keys) {
        key = keys[key];
        if(enumeration[key] === val) {
            return key;
        }
    }
    return null;
}

function _treatAddress(address) {
    switch (typeof address) {
        case 'string':
            address = _BTAddressToInt(address);
            // No break intended.
        case 'number':
            if (address > 0xffffffffffff || address < 0) { // max bluetooth address value (ff:ff:ff:ff:ff:ff), must be positive
                throw new Error(`Address ${address} out of range. Must be between 0 and #ffffffffffff (281474976710655).`);
            }
            return address;
        default:
            throw new Error('Invalid address provided. Must be either string or number.');
    }
}

function _promiseWrapperCB(res, rej) {
    return function(err, result) {
        if (err) rej(err);
        else res(result);
    }
}

Bluetooth.listUnpaired = listUnpaired = async function() {
    let unpaired = [];
    // let results = deasync(DevInfo.findAllAsync)(unpairedQuery);
    let results = await new Promise((res, rej) => {
        DevInfo.findAllAsync(unpairedQuery, _promiseWrapperCB(res, rej));
    });
    results = results.first();
    while(results.hasCurrent) {
        let device = await _parseBTDevice(results.current);
        unpaired.push(device);
        results.moveNext();
    }
    return unpaired;
}

Bluetooth.listPaired = listPaired = async function() {
    let paired = [];
    // let results = deasync(DevInfo.findAllAsync)(pairedQuery);
    let results = await new Promise((res, rej) => {
        DevInfo.findAllAsync(pairedQuery, _promiseWrapperCB(res, rej));
    });
    results = results.first();
    while(results.hasCurrent) {
        let device = await _parseBTDevice(results.current);
        paired.push(device);
        results.moveNext();
    }
    return paired;
}

Bluetooth.listAll = listAll = async function() {
    let values = await Promise.all([listPaired(), listUnpaired()]);
    return values[0].concat(values[1]);
}

Bluetooth.fromAddress = fromAddress = async function(address) {
    address = _treatAddress(address);
    let btd = await new Promise((res, rej) => {
        BTDevice.fromBluetoothAddressAsync(address, _promiseWrapperCB(res, rej));
    });

    return await _parseBTDevice(btd);
}

Bluetooth.pair = pair = async function(address) {
    // let btd = deasync(BTDevice.fromBluetoothAddressAsync)(_treatAddress(address)).deviceInformation;
    let btd = (await new Promise((res, rej) => {
        BTDevice.fromBluetoothAddressAsync(_treatAddress(address), _promiseWrapperCB(res, rej));
    })).deviceInformation;
    let pairing = btd.pairing.custom;

    pairing.on('pairingRequested', (custom, request) => {
        request.accept();
    });
    let pairingKinds = DevEnum.DevicePairingKinds;
    pairingKinds = pairingKinds.displayPin; // Only one that seems to work at all reliably from library.
    // pairingKinds = pairingKinds.confirmOnly | pairingKinds.confirmPinMatch | pairingKinds.displayPin | pairingKinds.providePin;
    
    let result = await new Promise((res, rej) => {
        pairing.pairAsync(pairingKinds, btd.pairing.protectionLevel, _promiseWrapperCB(res, rej));
    });
    
    let status = _parseEnumValue(result.status, DevEnum.DevicePairingResultStatus);
    switch(status) {
        case 'paired':
        case 'alreadyPaired':
            let result = {
                status: status,
                device: await fromAddress(address)
            }
            return result;
        default:
            throw new Error(`Pairing failed: ${status}`);
    }
}

Bluetooth.unpair = unpair = async function(address) {
    // let btd = deasync(BTDevice.fromBluetoothAddressAsync)(_treatAddress(address)).deviceInformation;
    let btd = (await new Promise((res, rej) => {
        BTDevice.fromBluetoothAddressAsync(_treatAddress(address), _promiseWrapperCB(res, rej));
    })).deviceInformation;
    let pairing = btd.pairing;

    let result = await new Promise((res, rej) => {
        pairing.unpairAsync(_promiseWrapperCB(res, rej));
    });

    let status = _parseEnumValue(result.status, DevEnum.DeviceUnpairingResultStatus);
    switch(status) {
        case 'unpaired':
        case 'alreadyUnpaired':
            let result = {
                status: status,
                device: await fromAddress(address)
            }
            return result;
        default:
            throw new Error(`Unpairing failed: ${status}`);
    }
}

module.exports = Bluetooth;
}())