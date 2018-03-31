# win-bt
Pair and unpair Bluetooth devices in Windows 10.

## Contents
* [Known Issues](#known-issues)
* [Installation](#installation)
* [Usage](#usage)
    * [Bluetooth Device Object](#bluetooth-device-object)
    * [(Un)Pairing Result Object](#unpairing-result-object)
    * [Bluetooth Address](#bluetooth-address)
    * [API](#api)
    * [Events](#events)
* [Issues/Requests](#issuesrequests)

## Known Issues
* Issues with pairing to devices using pairing modes other than `display pin`.  
    * I personally was unable to use this library to pair to devices using pairing modes other than `display pin`.  `confirm pin` and `confirm only` both failed in my attempts.

## Installation

This module requires *a piece but not all* of the [Windows 10 SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-10-sdk) module to install properly. You can download the [specific files](https://github.com/obermillerk/win-bt/blob/master/UnionMetadata.zip) and place them yourself (see the contained README.txt), or download the whole [Windows 10 SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-10-sdk).

```
npm install win-bt
```

## Usage

```javascript
const winbt = reqiure('win-bt');

// Check if Bluetooth is supported.
winbt.isSupported().then((supported) => {
    if (!supported) 
        throw new RuntimeError('Bluetooth not supported on this device');
    // If supported, check if it's enabled.
    return winbt.isEnabled();
}).then((enabled) => {
    if (!enabled)
        // If it's not enabled, attempt to enable it.
        return winbt.enable();
}).then(() => {
    // Bluetooth is supported and enabled
    console.log('Bluetooth is supported and enabled!');
}).catch((err) => {
    // Bluetooth is not supported or there was an error while enabling.
    console.error('Bluetooth is not supported or couldn\'t be enabled!');
    console.error(err);
});

// Scan for unpaired devices.
// Takes about 30 seconds to scan and then returns all results.
winbt.listUnpaired().then((unpaired) => {
    let first = unpaired[0];
    //  {
    //      name: 'BTHeadphones',
    //      paired: false,
    //      canPair: true,
    //      address: '01:23:45:67:89:af',
    //      class: {
    //          major: 4,
    //          minor: 1,
    //          raw: 2360324
    //      },
    //     connected: false,
    //     protection: 'none'
    //  }
    ...
});

// List paired devices.
winbt.listPaired().then((paired) => {
    let first = paired[0];
    ...
});


// Pair to a device using it's address.
winbt.pair('FF:FF:FF:FF:FF:FF').then((result) => {
    // Pairing successful or already paired.
    console.log('Paired to your device!');
    result.status; // Contains status message.
    result.device; // Contains updated device object.
}).catch((err) => {
    // Pairing failed.
    console.error(err);
});


// Unpair a device using it's address.
winbt.unpair('FF:FF:FF:FF:FF:FF').then((result) => {
    // Unpairing successful or already not paired.
    console.log('Paired to your device!');
    result.status; // Contains status message.
    result.device; // Contains updated device object.
}).catch((err) => {
    // Unpairing failed.
    console.error(err);
});

// List all devices (paired and unpaired).
winbt.listAll().then((devices) => {
    let first = devices[0];
    ...
});

// Get a Bluetooth device object from an address.
// Works with hex string, hex string separated by
// colons every two characters, or numbers.
winbt.fromAddress('FF:FF:FF:FF:FF:FF').then(...);
winbt.fromAddress('FFFFFFFFFFFF').then(...);
winbt.fromAddress(0xffffffffffff).then(...);
winbt.fromAddress(1234567890).then((device) => {
    ...
});
```

### Bluetooth Device Object

#### `name`
A string, the name of the Bluetooth device.

#### `paired`
A boolean, whether this device is paired with the machine.

#### `canPair`
A boolean, whether this device can be paired with this computer.  
This is false if the device is paired already.

#### `address`
A string, the address of this device. Represented by a hex string in the format 'XX:XX:XX:XX:XX:XX', where all X's are replaced by hexadecimal digits.

#### `class`
An object, contains information about the device's Bluetooth class.
* `major` - the major class of the device (an integer).
* `minor` - the minor class of the device (an integer).
* `raw` - the raw representation of the device class, encompassing both major and minor class (an integer).

#### `connected`
A boolean, whether this device is currently connect to the machine.

#### `protection`
A string, describes the device's protection level (encryption, authentication and ecryption, or none).


### (Un)Pairing Result Object
When pairing or unpairing, an object with these properties is resolved in a Promise on success. On failure, the Promise is rejected with an error with a message containing the `status`.

#### `status`
A string, the status message of the (un)pairing attempt (`'paired', 'unpaired'`).

#### `device`
A [`BT Device` Object](#bluetooth-device-object), updated according to the result of the (un)pairing attempt.


### Bluetooth Address

For input of Bluetooth addresses, this library can take a variety of forms:

* Colon-Separated Hex String - a string in the form of `'XX:XX:XX:XX:XX:XX'`.
* Hex String - a string in the form of `'XXXXXXXXXXXX'` (12 or fewer characters, fewer assumed to be padded with leading zeros).
* Integer - an integer, either a decimal number (`1234567890`) or a hexadecimal number (`0x1234567890AF`).

Where addresses are taken as input, if the input is invalid in any way (out of range, not a string or number, or an invalid string format), the function will reject with an error.



### API
Due to the asynchronus nature of many Bluetooth operations, all functions in this API return [Promises](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Using_promises) that resolve different values. The use of [`await`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/await) is highly recommended for making these operations behave synchronously; however, it's important to note that the `await` keyword can only be used in an `async` context, either with the `async` keyword or inside of a Promise. To this end, one could simply wrap all Bluetooth code inside of a Promise or `async` function, but be aware of and account for the fact that the rest of the code will not wait for this Promise.

#### `winbt.isSupported()`
* Returns a Promise(Boolean).

Determines if the machine supports Bluetooth or not (if there is a Bluetooth radio). Resolves the boolean result in a Promise.

Rejects with an error if there is an error while checking for Bluetooth radios.

#### `winbt.isEnabled()`
* Returns a Promise(Boolean).

Determines if Bluetooth is enabled on the machine or not. Resolves the boolean result in a Promise. This returns false if Bluetooth is not supported on the device.

Rejects with an error if there is an error while checking Bluetooth radios.

#### `winbt.enable()`
* Returns a Promise().

Attempts to enable Bluetooth on the device. Resolves in a Promise with no value if successful, otherwise rejects the Promise with a string message.  

Rejects with an error if there is an error while accessing Bluetooth radios.

#### `winbt.listUnpaired()`
* Returns a Promise(Array of [`BT Device` Object](#bluetooth-device-object)).

Initiates a scan for unpaired Bluetooth devices and returns the results in an Array of [`BT Device` Object](#bluetooth-device-object). The scan takes around 30 seconds.

May reject with any errors from the Windows BT interface.

#### `winbt.listPaired()`
* Returns a Promise(Array of [`BT Device` Object](#bluetooth-device-object)).

Returns an Array of currently paired [`BT Device` Objects](#bluetooth-device-object). This operation does *not* require a Bluetooth scan.

May reject with any errors from the Windows BT interface.

#### `winbt.listAll()`
* Returns a Promise(Array of [`BT Device` Object](#bluetooth-device-object)).

Initiates a scan for unpaired Bluetooth devices, combines the results with currently paired devices, and returns the results in an Array of [`BT Device` Object](#bluetooth-device-object). The scan takes around 30 seconds.

May reject with any errors from the Windows BT interface.

#### `winbt.fromAddress(address)`
* Parameters:
  * `address` *required* - a [Bluetooth Address](#bluetooth-address). See the section on [Bluetooth Addresses](#bluetooth-address) for details.
* Returns a Promise([`BT Device` Object](#bluetooth-device-object)).

Returns a [`BT Device` Object](#bluetooth-device-object) for the specified address.  This does not scan for the specified Bluetooth device if it is unknown, this will simply return the information that the machine has about the device with the specified address. This means that an unpaired device and a paired device should return in about the same amount of time, and an unpaired device may not have complete information on a device.

 May reject with any errors from the Windows BT interface.

#### `winbt.pair(address)`
* Parameters:
  * `address` *required* - a [Bluetooth Address](#bluetooth-address). See the section on [Bluetooth Addresses](#bluetooth-address) for details.
* Returns a Promise([`Pairing Result` Object](#unpairing-result-object)).

Attempts to pair to the device at the given address.  If the device is already paired, this will still resolve successfully since the desired result is alraedy achieved and the status of the [`Pairing Result` Object](#unpairing-result-object) will reflect this.

This function will reject with an error if the pairing fails, or if the Windows BT interface throws an error.

#### `winbt.unpair(address)`
* Parameters:
  * `address` *required* - a [Bluetooth Address](#bluetooth-address). See the section on [Bluetooth Addresses](#bluetooth-address) for details.
* Returns a Promise([`Unpairing Result` Object](#unpairing-result-object)).

Attempts to unpair from the device at the given address.  If the device is already unpaired, this will still resolve successfully since the desired result is alraedy achieved and the status of the [`Unpairing Result` Object](#unpairing-result-object) will reflect this.

This function will reject with an error if the unpairing fails, or if the Windows BT interface throws an error.

## Issues/Requests
Issues and requests should be directed to the git repository.
http://github.com/obermillerk/win-bt/issues