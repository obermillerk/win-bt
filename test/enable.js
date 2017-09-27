const BT = require('../bt');

BT.enable().then(
    () => console.log('enabled'),
    (err) => console.log(err)
);