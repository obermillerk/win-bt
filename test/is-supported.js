const BT = require('../bt');

BT.isSupported().then((supported) => {
    console.log(supported);
});