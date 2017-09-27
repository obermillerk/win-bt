const BT = require('../bt');

BT.listUnpaired().then(
    paired => console.log(paired),
    err => console.log(err)
);