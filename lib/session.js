var async = require('async');
var bunyan = require('bunyan');

var Session = function(tasks, logger) {
    
    this.tasks = tasks || [];
    this.logger = logger || bunyan.createLogger({name : 'Direktor session'});
    
}

Session.prototype.execute = function(finalCallback, stepCallback) {
    var _this = this;
    
    async.each(
        this.tasks,
        function taskExecutionIterator(task, callback) {
            task.perform(function(err) {
                if (stepCallback instanceof Function) stepCallback(task, err);
                callback(err);
            }, _this.logger);
        },
        finalCallback
    );
}

Session.prototype.toString = function toString() {
    var result = [];
    
    this.tasks.forEach(function(task) {
        result.push(task.toString());
    });
    
    return result.join('\n\n===\n\n') + '\n\n';
}

module.exports = Session;