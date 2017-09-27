const BT = require('../bt');

BT.listPaired().then(
    paired => console.log(paired),
    err => console.log(err)
);