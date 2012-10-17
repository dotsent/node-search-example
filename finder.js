var _ = require('underscore');

// namespace
Matcher = {}

Matcher.$eq = function (name, value) {
    this.name = name;
    this.value = value;
}

Matcher.$eq.prototype.matchItem = function (item) {
    //TODO стоит ли различать Float и Int (?)
    return (item[this.name] == this.value);
}

Matcher.$eq.prototype.matchValue = function (value) {
    //TODO стоит ли различать Float и Int (?)
    return (value == this.value);
}


Matcher.$gt = function (name, value) {
    this.name = name;
    this.value = value;
}

Matcher.$gt.prototype.matchItem = function (item) {
    return (item[this.name] > this.value);
}


Matcher.$gt.prototype.matchValue = function (value) {
    return (value > this.value);
}


Matcher.$gte = function (name, value) {
    this.name = name;
    this.value = value;
}

Matcher.$gte.prototype.matchItem = function (item) {
    return (item[this.name] >= this.value);
}

Matcher.$gte.prototype.matchValue = function (value) {
    return (value >= this.value);
}


Matcher.$lt = function (name, value) {
    this.name = name;
    this.value = value;
}

Matcher.$lt.prototype.matchItem = function (item) {
    return (item[this.name] < this.value);
}

Matcher.$lt.prototype.matchValue = function (value) {
    return (value < this.value);
}


Matcher.$lte = function (name, value) {
    this.name = name;
    this.value = value;
}

Matcher.$lte.prototype.matchItem = function (item) {
    return (item[this.name] <= this.value);
}

Matcher.$lte.prototype.matchValue = function (value) {
    return (value <= this.value);
}

// constructor
Matcher.ConditionMatcher = function () {
    // matchers list
    this.matchers = []
}

Matcher.ConditionMatcher.prototype.addMatcher = function (matcher) {
    this.matchers.push(matcher);
}

Matcher.ConditionMatcher.prototype.matchItem = function (item) {
    var result = false;
    // если все известные условия сматчились, то и я тоже
    var votes = this.matchers.length;
    for (var i in this.matchers) {
        if (this.matchers[i].matchItem(item)) {
            votes--;
        }
    }

    return (0 == votes);
}

Matcher.ConditionMatcher.prototype.matchValue = function (value) {
    var result = false;
    // если все известные условия сматчились, то и я тоже
    var votes = this.matchers.length;
    for (var i in this.matchers) {
        if (this.matchers[i].matchValue(value)) {
            votes--;
        }
    }

    return (0 == votes);
}


Matcher.create = function (condition) {
    var object = new Matcher.ConditionMatcher();

    for (var name in condition) {
        var value = condition[name];
        if (!_.isObject(value)) {
            object.addMatcher(new Matcher.$eq(name, value));
        } else {
            for (var type in value) {
                switch (type) {
                    case '$gte': var matcher = new Matcher.$gte(name, value[type]); break;
                    case '$gt':  var matcher = new Matcher.$gt(name, value[type]); break;
                    case '$lte': var matcher = new Matcher.$lte(name, value[type]); break;
                    case '$lt':  var matcher = new Matcher.$lt(name, value[type]); break;
                }
                object.addMatcher(matcher);
            }
        }
    }

    return object;
}

SimpleFinder = function(collection) {
    this.collection = collection;
}

SimpleFinder.prototype.search = function (condition) {
    var collection = this.collection;
    var result = [];
// console.log('collection', collection.length);
    var matcher = Matcher.create(condition);

    for (var k = 0; k < collection.length; k++) {
        var item = collection[k];
        if (matcher.matchItem(item)) {
            result.push(item);
        }
    }
    return result;
}

IndexedFinder = function(collection, index) {
    this.collection = collection;
    this.collectionLength = collection.length;
    this.index = {};

    this.createIndex(index)
}

IndexedFinder.prototype.createIndex = function (index) {
    for (var name in index) {
        this.index[index[name]] = {}
    }
    // create index
    var self = this;

    _.each(this.collection, function(item) {
        // console.log(item);
        // var keys = _.keys(item);
        for (var key in index) {
            var keyName = index[key];
            var value = item[keyName]

            if (! (value in self.index[keyName])) {
                self.index[keyName][value] = [];
            }
            self.index[keyName][value].push(item);
        }
    });

}

IndexedFinder.prototype.selectIndex = function (condition) {

    var indexStat = {}
    for (condName in condition) { indexStat[condName] = 0; }

    // пытаемся вычислить какой индекс оптимальнее использовать
    for (condName in condition) {
        var condValue = condition[condName];
        if (! (condName in this.index)) {
            delete indexStat[condName];
            continue;
        }

        var matcher = Matcher.create( {condName: condValue} );
        for (var indexValue in this.index[condName]) {
            if (matcher.matchValue(indexValue)) {
                indexStat[condName] += this.index[condName][indexValue].length;
            }
        }
    }

    var _min = _.values(indexStat).pop();
    var selectedIndexName = _.keys(indexStat).pop();;
    for (var indexName in indexStat) {
        if (_min > indexStat[indexName]) {
            _min = indexStat[indexName]
            selectedIndexName = indexName;
        }
    }

    return {
        stat: indexStat,
        indexName: selectedIndexName
    }
}

IndexedFinder.prototype.search = function (condition) {

function time() {
    return (new Date()).getTime();
}

    var startTime = time();

    var indexStat = this.selectIndex(condition);
    selectedIndexName = indexStat.indexName
    console.log(indexStat);
/**
 * Должен найти самый селективный индекс выбрать его и далее бежать по нему симпл серчем
 *
 * Наиболее слективный индекс  тот в котором результат меньше
 *
 * Cardinality:
 *  высока - userid
 *  нормальная - lastname
 *  низкаая -  active
 *
 * selective = index.length / collection.length
 *
 */

    // если выбрать индекс не удалось
    if (undefined == selectedIndexName) {
        var finder = new SimpleFinder(this.collection);
        return finder.search(condition);
    }

    // найдя индекс, по которому осущесвялем поиск
    var result = [];

    var indexMatcher = Matcher.create( {selectedIndexName: condition[selectedIndexName]} );
    var reducedCondition = _.omit(condition, selectedIndexName)

    for (var indexValue in this.index[selectedIndexName]) {
        if (indexMatcher.matchValue(indexValue)) {
            var finder = new SimpleFinder(this.index[selectedIndexName][indexValue])

            result = result.concat(finder.search(reducedCondition))
        }
    }

    console.log('> Index search in ', (time() - startTime) / 1000, 'sec.');
    var startTime = time();

    return result;


// вычисляем самый селективный индекс
    // Селективность хороша, если мало строк имеют одинаковые ключевые значения.
    //
    // Т.е. мы ищем самое маленькое число
    //
    //


//console.log('age', this.index['age'][8], this.collectionLength);

/**
 * Если же я сделаю составной индекс (как??)
 */
    for (condName in condition) {
        var condValue = condition[condName];
        // console.log(condName, condition[condName]);
        //

        //eq
        // _.union(this.index[condName][condition[condName]], result);
        // result = this.index[condName][condValue];
        result = result.concat(this.index[condName][condValue]);

        // lt gt
        // console.log(condValue.$gte);

        for (var value in this.index[condName]) {
            // console.log(value);

            if ((value >= condValue.$gte) && (value <= condValue.$lte)) {
                // console.log(this.index[condName][value]);
                result = result.concat(this.index[condName][value])
            }
            // запоминаем индексы входящие в массив
        }
    }

    return result;
}

SqliteFinder = function(collection) {
    var sqlite3 = require('sqlite3').verbose();
    var db = new sqlite3.Database(':memory:');
    this.db = db;

    // this.db.run("CREATE TABLE peoples (sex INTEGER, age INTEGER, height INTEGER, 'index' INTEGER, amount REAL)");
    db.run("CREATE TABLE peoples (sex INTEGER)");

    // this.db.run("CREATE INDEX");
    //

    // console.log('DB', this.db);

    db.serialize(function () {
        db.parallelize(function () {
            var stmt = db.prepare("INSERT INTO peoples VALUES (?)");
            _.each(collection, function(item) {
                stmt.run(item.sex);
            });
        })

/*        var stmt = self.db.prepare("INSERT INTO peoples VALUES (?, ?, ?, ?, ?)");
        _.each(collection, function(item) {
            stmt.run([
                item.sex,
                item.age,
                item.height,
                item.index,
                item.amount
            ]);
        });*/
    })
}

SqliteFinder.prototype.search = function(condition) {
    var result = [];
    this.db.each("SELECT * FROM peoples", function(err, row) {
        console.log(row);
    });

    return result;
}

module.exports.SimpleFinder  = SimpleFinder;
module.exports.IndexedFinder = IndexedFinder;
module.exports.SqliteFinder  = SqliteFinder;
