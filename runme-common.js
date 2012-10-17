var SimpleFinder = require('./finder').SimpleFinder
var IndexedFinder = require('./finder').IndexedFinder


function time() {
    return (new Date()).getTime();
}

var startTime = time();

console.log('Init collection');
var collection = [];

collection.push({
    sex: 0,
    age: 15,
    height: 80,
    index: 199,
    amount: 30455.3
});

for (var i = 1; i < 10*1000*1000; i++) {
    collection.push({
        sex: Math.round(Math.random()),
        age: Math.round(Math.random() * 100),
        height: Math.round(Math.random() * 300),
        index: Math.round(Math.random() * 1000000),
        amount: Math.round(Math.random() * 1000000)
    });
}

console.log('Init done in ', (time() - startTime) / 1000, 'sec. Total items in collection:', collection.length);
console.log('Memory usage:', process.memoryUsage());

var condition = {
    sex: 0,
    // age: { $gte: 10, $lte: 15 }, // > 10 && < 15
    height: 11
    // amount: 30455.3
};

console.log('');

console.log('Start searching...');
console.log('Query', condition);

console.log('');

var startTime = time();
console.log('Simple search start');
var finder = new SimpleFinder(collection);
var result = finder.search(condition);
console.log('Simple search finish in ', (time() - startTime) / 1000, 'sec');
console.log('Result:', result.length, 'items');
var simpleResult = result.length;


// console.log('Result:', result);

console.log('');

var startTime = time();
console.log('Indexed search start');
var finder = new IndexedFinder(collection, ['height', 'sex']/*, 'age', 'height', 'index', 'amount']*/);
console.log('Indexed created in', (time() - startTime) / 1000, 'sec');
console.log('Memory usage:', process.memoryUsage());

var startTime = time();
console.log('Indexed search start');

var result = finder.search(condition);
console.log('Indexed search finish in ', (time() - startTime) / 1000, 'sec');
console.log('Result:', result.length, 'items');

if (result.length != simpleResult) { throw "Not eq" }