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

module.exports = Session;