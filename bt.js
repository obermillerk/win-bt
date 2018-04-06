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

/**
 * Determines if bluetooth is supported on this device
 * by searching for a bluetooth radio.
 * @returns {Promise} resolves a boolean representing whether
 *                    or not bluetooth is supported.
 */
Bluetooth.isSupported = isSupported = async function () {
    let radios = await _promisify(Radio.getRadiosAsync)();
    radios = radios.first();
    while (radios.hasCurrent) {
        let radio = radios.current;
        if(radio.kind == RadioKind.bluetooth)
            return true;
        
        radios.moveNext();
    }
    return false;
}

/**
 * Determines if bluetooth is enabled on this device
 * by searching for a bluetooth radio that is enabled.
 * @returns {Promise} resolves a boolean representing whether
 *                    or not bluetooth is enabled.
 */
Bluetooth.isEnabled = isEnabled = async function () {
    let radios = await _promisify(Radio.getRadiosAsync)();
    radios = radios.first();
    while (radios.hasCurrent) {
        let radio = radios.current;
        if(radio.kind == RadioKind.bluetooth && radio.state == RadioState.on)
            return true;
        
        radios.moveNext();
    }
    return false;
}

/**
 * Attempts to turn on bluetooth radios.
 * @returns {Promise} resolves if was able to enable any bluetooth radio,
 *                    rejects otherwise.
 */
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

/**
 * Converts an integer bluetooth address into a hexadecimal string.
 * @param {Number} address - integer bluetooth address.
 * @returns {String} hexadecimal bluetooth address string.
 */
function _BTAddressToHexString(address) {
    if (typeof address !== 'number') {
        throw new Error(`Parameter address must be a number between 0 and 0xffffffffffff (281474976710655).`)
    }
    if (address > 0xffffffffffff || address < 0) { // max bluetooth address value (ff:ff:ff:ff:ff:ff), must be positive
        throw new Error(`Address ${address} out of range. Must be between 0 and 0xffffffffffff (281474976710655).`);
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

/**
 * Converts a hexadecimal bluetooth address into an integer.
 * @param {String} address - hexadecimal bluetooth address string.
 * @returns {Number} integer bluetooth address.
 */
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


/**
 * Creates a new object containing information about the bluetooth
 * device. Standard output for devices in this library.
 * @param {DeviceInformation | BluetoothDevice} devInfo - A DeviceInformation or BluetoothDevice to be parsed.
 * @returns {Promise} resolves to representation of a bluetooth device, or rejects with any errors.
 */
async function _parseBTDevice(devInfo) {
    let btd = devInfo;
    if (devInfo instanceof DevInfo) {
        btd = await _promisify(BTDevice.fromIdAsync)(devInfo.id);
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

/**
 * Retrieves the key name for the enum value of the given enum.
 * @param {*} val - the value of the enumeration.
 * @param {*} enumeration - the enumeration from which the value comes from.
 * @returns {String} the key name for the value given in the enumeration given,
 *                   or null if it does not exist.
 */
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

/**
 * Treat the given bluetooth address to ensure that it is a valid bluetooth address
 * and is in the correct integer format.
 * @param {String | Number} address - the hexadecimal string representation of a
 *                                    bluetooth address or the integer representation.
 * @returns {Number} the integer representation of the given bluetooth address.
 * @throws {Error} if the string is malformated or the address is out of range.
 */
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

/**
 * Turns the given function that takes a callback as the last argument
 * into a function that returns a promise.
 */
function _promisify(func) {
    return function(...args) {
        return new Promise((res, rej) => {
            func(...args, (err, data) => {
                if (err) {
                    rej(err);
                } else {
                    res(data);
                }
            });
        });
    }
}

/**
 * Initiates a scan for unpaired bluetooth devices that are turned on within range.
 * @returns {Promise} Resolves an array of bluetooth device objects that are not
 *                    currently paired to this device.
 */
Bluetooth.listUnpaired = listUnpaired = async function() {
    let unpaired = [];
    let results = await _promisify(DevInfo.findAllAsync)(unpairedQuery);
    results = results.first();
    while(results.hasCurrent) {
        let device = await _parseBTDevice(results.current);
        unpaired.push(device);
        results.moveNext();
    }
    return unpaired;
}

/**
 * Lists all bluetooth devices paired to this device.
 * @returns {Promise} Resolves an array of bluetooth device objects that are
 *                    currently paired to this device.
 */
Bluetooth.listPaired = listPaired = async function() {
    let paired = [];
    let results = await _promisify(DevInfo.findAllAsync)(pairedQuery);
    results = results.first();
    while(results.hasCurrent) {
        let device = await _parseBTDevice(results.current);
        paired.push(device);
        results.moveNext();
    }
    return paired;
}

/**
 * Lists all bluetooth devices paired to this device, and all bluetooth devices that
 * are not currently paired and are on within range.
 * @returns {Promise} Resolves an array of bluetooth device objects that are
 *                    or are not paired to this device.
 */
Bluetooth.listAll = listAll = async function() {
    let values = await Promise.all([listPaired(), listUnpaired()]);
    return values[0].concat(values[1]);
}

/**
 * Creates a bluetooth device object from a bluetooth address (number or hex string).
 * @returns {Promise} Resolves a bluetooth device object that represents the device
 *                    with the given address.
 */
Bluetooth.fromAddress = fromAddress = async function(address) {
    address = _treatAddress(address);
    let btd = await _promisify(BTDevice.fromBluetoothAddressAsync)(address);

    return await _parseBTDevice(btd);
}

/**
 * Attempts to pair with the device at the given address.
 * @returns {Promise} Resolves a result object which contains a status string and a
 *                    bluetooth device object for the device. Rejects with and error
 *                    if the pairing fails.
 */
Bluetooth.pair = pair = async function(address) {
    let btd = (await _promisify(BTDevice.fromBluetoothAddressAsync)(_treatAddress(address))).deviceInformation;
    let pairing = btd.pairing.custom;

    pairing.on('pairingRequested', (custom, request) => {
        request.accept();
    });
    let pairingKinds = DevEnum.DevicePairingKinds;
    pairingKinds = pairingKinds.displayPin; // Only one that seems to work at all reliably from library.
    // pairingKinds = pairingKinds.confirmOnly | pairingKinds.confirmPinMatch | pairingKinds.displayPin | pairingKinds.providePin;
    
    let result = _promisify(pairing.pairAsync)(pairingKinds, btd.pairing.protectionLevel);
    
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

/**
 * Attempts to unpair the device at the given address.
 * @returns {Promise} Resolves a result object which contains a status string and a
 *                    bluetooth device object for the device. Rejects with and error
 *                    if the unpairing fails.
 */
Bluetooth.unpair = unpair = async function(address) {
    let btd = (await _promisify(BTDevice.fromBluetoothAddressAsync)(_treatAddress(address))).deviceInformation;
    let pairing = btd.pairing;

    let result = await _promisify(pairing.unpairAsync);

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