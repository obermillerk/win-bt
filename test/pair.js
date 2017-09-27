require('dotenv').config();
const BT = require('../bt');

var address = process.env.ADDRESS;

BT.pair(address).then(
    device => console.log(device),
    err => console.log(err)
);