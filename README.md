# Direktor: Execute remote tasks via SSH with Node.js

Direktor connects to an arbitrary number of remote machines via SSH and performs one or more commands on them. It uses Brian White's [ssh2](https://github.com/mscdex/ssh2) library, which is written in pure JavaScript and has no external dependencies.

Individual commands, specified either as strings or closures that are free to interact directly with the SSH session, are grouped in tasks and executed in a strictly serialized manner against a single server. Multiple tasks can be executed in parallel—each in its own SSH session against an arbitrary host—to increase performance.

## Example

    var dir = require('direktor');

    // Create a new session, which manages the overall operations
    // against each machine
    
    var session = new dir.Session();
    
    // Create a task, which identifies a group of commands to be
    // executed against a given server. The options provided
    // are passed directly to the SSH2 library.
    
    var task = new dir.Task({
        host : 'remote1.local',
        port : 22,
        username : 'mine',
        privateKey : require('fs').readFileSync('/home/marco/.ssh/id_rsa')
    });
    
    // Add commands to a task

    task.before = 'mkdir test';
    task.commands = 'echo 1 > test/test.txt';
    task.after = 'echo 1 > test/test2.txt';
    
    // Add the task to the session

    session.tasks.push(task);
    
    // If you want to run the same set of commands against a different host,
    // you can use the clone method:
    
    var newTask = task.clone({
        host : 'remote2.local',
        port : 22,
        username : 'mine',
        privateKey : require('fs').readFileSync('/home/marco/.ssh/id_rsa')
    });
    
    session.tasks.push(newTask);
    
    // Execute the tasks. Individual commands are serialized, while
    // tasks are parallelized for performance

    session.execute(function(err) {
        console.log(err);
    });
    
## Tasks

A task is a queue of commands that are executed in a strictly serialized manner against a specific target, which you describe when you instantiate the task:

    new Direktor.task(options)
    
The `options` parameters is an object and is passed directly to the SSH2 library's [connection object](https://github.com/mscdex/ssh2). You can connect to a host using password, public key, or any other method supported by SSH2.

A task contains an arbitrary number of commands, which can either be specified as strings, in which case they are executed directly against the SSH session, or as closures, which are passed references to the task object (from whence the SSH session can be derived) and a callback to call when done. For example:

    function customCommand(task, callback) {
        task.connection.exec('<remote commands>, function(err) {
            if (err) return callback(err);
            
            // Do your work, then call callback when you're done.
        });
    }

Tasks expose four properties, each representing a different phase of their execution:

- `before` is a single command or closure that is executed as soon as a connection with the remote host is established.
- `commands` is an array of commands or closures that are executed in series right after `before`. Commands and closures can be mixed as needed.
- `after` is a single command or closure that is executed after the last command.
- `error` is a single command or closure that is executed if, at any point during the execution of the task, an error is reported by one of the commands. You can use this to attempt to recover from an error gracefully.

All the properties are optional—although, of course, a task without any commands will simply connect to the remote host and disconnect right away.

### Handling errors

For string commands, Direktor automatically checks for nonzero exit codes and reports the appropriate error. Closure-style commands are responsible for checking and reporting their own errors.

When an error occurs at any point during a task's execution, the task stops running immediately. If the `error` command is specified, the tasks executes it, and then closes the connections, reporting the error to the session that owns it.

### Cloning tasks

A task can only be executed against the host passed to its constructor. If you want to run the same set of commands against a different host, you can use the `clone` method _after_ you've populated all of its properties.

## Sessions

In order to be executed, tasks must be added to a session, which executes them all in parallel, reporting any errors as appropriate. Session's constructor takes an array of tasks and, optionally, a Bunyan logger (see _Logging,_ below).

In order to execute all the tasks associated with a session, you can call the `execute` method:

    session.execute(finalCallback, stepCallback);
    
The `finalCallback` closure is called when all the tasks have finished executing. It receives an array of errors (if any). The `stepCallback` closure is called every time _one_ task finishes running, and receives a reference to the task and an optional error as its parameters.

## Logging

Direktor incorporates Trent Mick's [Bunyan](https://github.com/trentm/node-bunyan) for logging. You can specify your own logger by passing it as the second parameter to Session's constructor. If you do not specify a logger, Direktor will create one for you and output logs to the console.