var Connection = require('ssh2');
var async = require('async');

var Task = function Task(options) {
    this.connection = new Connection();
    this.connectionOptions = options;
    
    this.before = undefined;
    this.after = undefined;
    this.error = undefined;
    
    this.commands = [];
}

Task.prototype.clone = function cloneTask(options) {
    var task = new Task(options);
    
    task.before = this.before;
    task.commands = this.commands;
    task.after = this.after;
};

Task.prototype._performCommand = function _performCommand(command, callback, error) {
    if (command instanceof Function) return command(this, callback, error);
    
    this.log.info('Executing command ' + command);
    
    var _this = this;
    
    this.connection.exec(command, function(err, stream) {
        if (err) {
            _this.log.error(err.message);
            return callback(err);
        }
        
        stream.on('data', function(data, extended) {
            _this.log.info(extended + ':' + data.toString());
        });
        
        stream.on('exit', function(code, signal) {
            if (code !== 0) {
                var err = new Error('Task ' + command + ' exited with non-zero code ' + code);
                _this.log.error(err.message);
                return callback(err);
            }
            
            _this.log.info('Task exited with zero code');
            callback();
        });
    }); 
};

Task.prototype._performCommandOrSequence = function _performCommandOrSequence(command, callback) {
    if (!command || (command.length && command.length === 0)) callback();
    
    if (command instanceof Array) {
        var _this = this;
        
        async.eachSeries(
            command,
            function commandSequenceIterator(item, callback) {
                _this._performCommand.call(_this, item, callback);
            },
            function commandSequenceFinalCallback(err) {
                callback(err);
            }
        )
    } else {
        this._performCommand(command, callback);
    }
};

Task.prototype._connect = function _connect(callback) {
    var _this = this;
    
    this.connection.on('connect', function() {
        _this.log.info('Connected to remote host');
    });
    
    this.connection.on('banner', function(banner) {
        _this.log.info(banner);
    });
    
    this.connection.on('close', function() {
        _this.log.info('Connection to remote host closed.');
    })
    
    this.connection.on('ready', callback);
    this.connection.on('error', callback);
    this.connection.connect(this.connectionOptions);
};

Task.prototype._perform = function _perform(callback) {
    var _this = this;
    
    async.eachSeries(
        [ this.before, this.commands, this.after ],
        function(item, callback) {
            _this._performCommandOrSequence.call(_this, item, callback);
        },
        callback
    )
};

Task.prototype._disconnect = function _disconnect(callback) {
    this.connection.end();
};

Task.prototype.perform = function perform(callback, log) {
    var _this = this;
    
    this.log = log.child({ task : this.connectionOptions.username + '@' + this.connectionOptions.host + ':' + this.connectionOptions.port });
    
    async.series(
        [
            function(callback) {
                _this._connect.call(_this, callback);
            },
            function(callback) {
                _this._perform.call(_this, callback);
            },
        ],
        function(err) {
            if (err && _this.error) {
                _this._performCommand(_this.error, function() {
                    _this._disconnect.call(_this);
                    callback(err);
                }, err);
            } else {
                _this._disconnect.call(_this);
                callback(err);
            }
        }
    );
};

Task.prototype.toString = function toString() {
    var result = [];
    
    function renderCommand(command) {
        if (command instanceof Function) {
            result.push('    [Function]');
        } else {
            result.push('    ' + command);
        }
    }
    
    function renderCommandOrList(listOrCommand) {
        if (listOrCommand instanceof Array) {
            listOrCommand.forEach(renderCommand);
        } else {
            renderCommand(listOrCommand);
        }
    }
    
    result.push('Host: ' + this.connectionOptions.host);
    
    if (this.connectionOptions.password) {
        result.push('Password: ' + this.connectionOptions.password);
    }
    
    if (this.connectionOptions.privateKey) {
        result.push('Private key: ' + this.connectionOptions.privateKey);
    }
    
    result.push('BEFORE');
    renderCommandOrList(this.before);
    result.push('COMMANDS');
    renderCommandOrList(this.commands);
    result.push('AFTER');
    renderCommandOrList(this.after);
    result.push('ERROR');
    renderCommandOrList(this.error);
    
    return result.join('\n');
}

module.exports = Task;