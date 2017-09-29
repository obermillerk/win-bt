(function() {

const DevEnum = require('windows.devices.enumeration');
const DevInfo = DevEnum.DeviceInformation;
const BT = require('windows.devices.bluetooth');
const BTDevice = BT.BluetoothDevice;
const Radios = require('windows.devices.radios');
const Radio = Radios.Radio;
const RadioKind = Radios.RadioKind;
const RadioState = Radios.RadioState;
const deasync = require('deasync');

var Bluetooth = {};

Bluetooth.isSupported = isSupported = function () {
    radios = deasync(Radio.getRadiosAsync)();
    radios = radios.first();
    while (radios.hasCurrent) {
        radio = radios.current;
        if(radio.kind == RadioKind.bluetooth)
            return true;
        
        radios.moveNext();
    }
    return false;
}

Bluetooth.isEnabled = isEnabled = function () {
    radios = deasync(Radio.getRadiosAsync)();
    radios = radios.first();
    while (radios.hasCurrent) {
        radio = radios.current;
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
    if (address > 281474976710655 || address < 0) { // max bluetooth address value (ff:ff:ff:ff:ff:ff), must be positive
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
    if (!address.match(/(?:^[0-9a-fA-F]{12}$)|(?:^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$)/)) {
        throw new Error(`Invalid address string '${address}'. Must be twelve hexidecimal digits, optionally separated by a colon (:) every two digits.`);
    }

    address = address.replace(/:/g, '');
    address = parseInt(address, 16);
    return address;
}

function _parseBTDevice(devInfo) {
    let btd = devInfo;
    if (devInfo instanceof DevInfo) {
        btd = deasync(BTDevice.fromIdAsync)(devInfo.id);
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
            if (address > 281474976710655 || address < 0) { // max bluetooth address value (ff:ff:ff:ff:ff:ff), must be positive
                throw new Error(`Address ${address} out of range. Must be between 0 and #ffffffffffff (281474976710655).`);
            }
            return address;
        default:
            throw new Error('Invalid address provided. Must be either string or number.');
    }
}

Bluetooth.listUnpaired = listUnpaired = function() {
    return new Promise((resolve, reject) => {
        let unpaired = [];
        let results = deasync(DevInfo.findAllAsync)(unpairedQuery);
        results = results.first();
        while(results.hasCurrent) {
            let device = _parseBTDevice(results.current);
            unpaired.push(device);
            results.moveNext();
        }
        resolve(unpaired);
    });
}

Bluetooth.listPaired = listPaired = function() {
    return new Promise((resolve, reject) => {
        let paired = [];
        let results = deasync(DevInfo.findAllAsync)(pairedQuery);
        results = results.first();
        while(results.hasCurrent) {
            let device = _parseBTDevice(results.current);
            paired.push(device);
            results.moveNext();
        }
        resolve(paired);
    });
}

Bluetooth.listAll = listAll = function() {
    return new Promise((resolve, reject) => {
        Promise.all([listPaired(), listUnpaired()]).then(values => {
            resolve(values[0].concat(values[1]));
        });
    });
}

Bluetooth.fromAddress = fromAddress = function(address) {
    return new Promise((resolve, reject) => {
        address = _treatAddress(address);
        BTDevice.fromBluetoothAddressAsync(address, (err, btd) => {
            if (err) {
                return reject(err);
            }

            resolve(_parseBTDevice(btd));
        })
    });
}

Bluetooth.pair = pair = function(address) {
    return new Promise((resolve, reject) => {
        try {
            address = _treatAddress(address);
            
            let btd = deasync(BTDevice.fromBluetoothAddressAsync)(address).deviceInformation;
            let pairing = btd.pairing.custom;

            pairing.on('pairingRequested', (custom, request) => {
                request.accept();
            });
            let pairingKinds = DevEnum.DevicePairingKinds;
            pairingKinds = pairingKinds.displayPin; // Only one that seems to work at all reliably from library.
            // pairingKinds = pairingKinds.confirmOnly | pairingKinds.confirmPinMatch | pairingKinds.displayPin | pairingKinds.providePin;
            
            pairing.pairAsync(pairingKinds, btd.pairing.protectionLevel, (err, result) => {
                if (err) {
                    return reject(err);
                }
                let status = _parseEnumValue(result.status, DevEnum.DevicePairingResultStatus);
                switch(status) {
                    case 'paired':
                    case 'alreadyPaired':
                        let result = {
                            status: status,
                            device: _parseBTDevice(deasync(BTDevice.fromBluetoothAddressAsync)(address))
                        }
                        return resolve(result);
                    default:
                        return reject(new Error(`Pairing failed: ${status}`));
                }
            });
        } catch(err) {
            reject(err);
        }
    });
}

Bluetooth.unpair = unpair = function(address) {
    return new Promise((resolve, reject) => {
        try {
            address = _treatAddress(address);
            
            let btd = deasync(BTDevice.fromBluetoothAddressAsync)(address).deviceInformation;
            let pairing = btd.pairing;

            pairing.unpairAsync((err, result) => {
                if (err) {
                    return reject(err);
                }
                let status = _parseEnumValue(result.status, DevEnum.DeviceUnpairingResultStatus);
                switch(status) {
                    case 'unpaired':
                    case 'alreadyUnpaired':
                        let result = {
                            status: status,
                            device: _parseBTDevice(deasync(BTDevice.fromBluetoothAddressAsync)(address))
                        }
                        return resolve(result);
                    default:
                        return reject(new Error(`Unpairing failed: ${status}`));
                }
            });
        } catch(err) {
            reject(err);
        }
    });
}

module.exports = Bluetooth;
}())