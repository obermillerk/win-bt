const BT = require('../bt');

BT.listAll().then(
    paired => console.log(paired),
    err => console.log(err)
);