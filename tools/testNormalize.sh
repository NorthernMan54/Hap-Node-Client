#! /bin/sh

node testNormalize.js samples/jesse.json > after.json

# diff after.json samples/jesse.json

diff after.json samples/jesse_good.json
rm after.json
