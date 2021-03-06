/**
 * @fileoverview A parser for command line options. This parser supports
 * various option formats:
 *
 * <ul>
 *   <li><code>-a -b -c</code> (multiple short options)</li>
 *   <li><code>-abc</code> (multiple short options combined into one)</li>
 *   <li><code>-a value</code> (short option with value)</li>
 *   <li><code>-avalue</code> (alternative short option with value)</li>
 *   <li><code>--option value</code> (long option with value)</li>
 *   <li><code>--option=value</code> (alternative long option with value)</li>
 * </ul>
 *
 * @example // ringo parserExample.js -v --size 123 -p 45678
 *
 * include('ringo/term');
 * var system = require('system');
 * var {Parser} = require('ringo/args');
 *
 * var parser = new Parser();
 * parser.addOption('s', 'size', 'SIZE', 'Sets the size to SIZE');
 * parser.addOption('p', 'pid', 'PID', 'Kill the process with the PID');
 * parser.addOption('v', 'verbose', null, 'Verbosely do something');
 * parser.addOption('h', 'help', null, 'Show help');
 *
 * var options = parser.parse(system.args.slice(1));
 * if (options.help) {
 *   writeln(parser.help());
 *} else {
 *   if (options.size) {
 *      writeln('Set size to ' + parseInt(options.size));
 *   }
 *
 *   if (options.pid) {
 *      writeln('Kill process ' + options.pid);
 *   }
 *
 *   if (options.verbose) {
 *      writeln('Verbose!');
 *   }
 *}
 *
 * if (!Object.keys(options).length) {
 *   writeln("Run with -h/--help to see available options");
 * }
 */

var strings = require("ringo/utils/strings");

/**
 * Create a new command line option parser.
 */
exports.Parser = function() {
    var options = [];

    /**
     * Add an option to the parser.
     * @param {String} shortName the short option name (without leading hyphen)
     * @param {String} longName the long option name (without leading hyphens)
     * @param {String} argument display name of the option's value, or null if the argument is a singular switch
     * @param {String} helpText the help text to display for the option
     * @returns {Object} this parser for chained invocation
     */
    this.addOption = function(shortName, longName, argument, helpText) {
        if (shortName && shortName.length != 1) {
            throw new Error("Short option must be a string of length 1");
        }
        longName = longName || "";
        argument = argument || "";
        options.push({
            shortName: shortName,
            longName: longName,
            argument: argument,
            helpText: helpText
        });
        return this;
    };

    /**
     * Get help text for the parser's options suitable for display in command line scripts.
     * @returns {String} a string explaining the parser's options
     */
    this.help = function() {
        var lines = [];
        for each (var opt in options) {
            var flags;
            if (opt.shortName !== undefined && opt.shortName !== null) {
                flags = " -" + opt.shortName;
            } else {
                flags = "   ";
            }
            if (opt.longName) {
                flags += " --" + opt.longName;
            }
            if (opt.argument) {
                flags += " " + opt.argument;
            }
            lines.push({flags: flags, helpText: opt.helpText});
        }
        var maxlength = lines.reduce(function(prev, val) Math.max(val.flags.length, prev), 0);
        return lines.map(
            function(s) strings.pad(s.flags, " ", 2 + maxlength) + s.helpText
        ).join("\n");
    };

    /**
     * Parse an arguments array into an option object. If a long option name is defined,
     * it is converted to camel-case and used as property name. Otherwise, the short option
     * name is used as property name.
     *
     * Passing an result object as second argument is a convenient way to define default
     * options:
     * @param {Array} args the argument array. Matching options are removed.
     * @param {Object} result optional result object. If undefined, a new Object is created.
     * @returns {Object} the result object
     * @see <a href="../../ringo/utils/strings/index.html#toCamelCase">toCamelCase()</a>
     * @example parser.parse(system.args.slice(1), {myOption: "defaultValue"});
     */
    this.parse = function(args, result) {
        result = result || {};
        while (args.length > 0) {
            var option = args[0];
            if (!strings.startsWith(option, "-")) {
                break;
            }
            if (strings.startsWith(option, "--")) {
                parseLongOption(option.substring(2), args, result);
            } else {
                parseShortOption(option.substring(1), args, result);
            }
        }
        return result;
    };

    function parseShortOption(opt, args, result) {
        var length = opt.length;
        var consumedNext = false;
        for (var i = 0; i < length; i++) {
            var def = null;
            var c = opt.charAt(i);
            for each (var d in options) {
                if (d.shortName == c) {
                    def = d;
                    break;
                }
            }
            if (def == null) {
                unknownOptionError("-" + c);
            }
            var optarg = null;
            if (def.argument) {
                if (i == length - 1) {
                    if (args.length <= 1) {
                        missingValueError("-" + def.shortName);
                    }
                    optarg = args[1];
                    consumedNext = true;
                } else {
                    optarg = opt.substring(i + 1);
                    if (optarg.length == 0) {
                        missingValueError("-" + def.shortName);
                    }
                }
                i = length;
            }
            var propertyName = def.longName || def.shortName;
            result[strings.toCamelCase(propertyName)] = optarg || true;
        }
        args.splice(0, consumedNext ? 2 : 1);
    }

    function parseLongOption(opt, args, result) {
        var def = null;
        for each (var d in options) {
            if (opt == d.longName || (strings.startsWith(opt, d.longName)
                    && opt.charAt(d.longName.length) == '=')) {
                def = d;
                break;
            }
        }
        if (def == null) {
            unknownOptionError("--" + opt);
        }
        var optarg = null;
        var consumedNext = false;
        if (def.argument) {
            if (opt == def.longName) {
                if (args.length <= 1) {
                    missingValueError("--" + def.longName);
                }
                optarg = args[1];
                consumedNext = true;
            } else {
                var length = def.longName.length;
                if (opt.charAt(length) != '=') {
                    missingValueError("--" + def.longName);
                }
                optarg = opt.substring(length + 1);
            }
        }
        result[strings.toCamelCase(def.longName)] = optarg || true;
        args.splice(0, consumedNext ? 2 : 1);
    }
};

function missingValueError(option) {
    throw new Error(option + " option requires a value.");
}


function unknownOptionError(option) {
    throw new Error("Unknown option: " + option);
}
