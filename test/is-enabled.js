const BT = require('../bt');

BT.isEnabled().then((enabled) => {
    console.log(enabled);
});