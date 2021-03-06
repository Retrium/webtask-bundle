'use strict';

const Async = require('async');
const Helpers = require('./helpers');
const Glob = require('glob');
const Path = require('path');
const Semver = require('semver');


module.exports = calculateExternalsStrict;

/**
 * Calculate externals
 * 
 * @param {String} entry - Path to entry-point
 */
function calculateExternalsStrict(entry, cb) {
    const dirname = Helpers.getDirname(entry);
        
    return Async.waterfall([
        (next) => Helpers.loadBuiltins(next),
        (modules, next) => Async.waterfall([
            (next) => listPackageJsonFiles(dirname, next),
            (paths, next) => Async.map(paths, extractDependencies, next),
            (deps, next) => compareToModules(deps, modules, next),
        ], next)
    ], cb);
}

    
function listPackageJsonFiles(dirname, cb) {
    const pathname = Path.join(dirname, 'package.json');
    const paths = [];
    
    try {
        paths.push(pathname);
        
        return Glob('**/package.json', {
            cwd: dirname,
        }, function (err, matches) {
            if (err) return cb(err);
            
            matches
                .map(function (path) { return Path.join(dirname, path); })
                .forEach(pathname => paths.push(pathname));
            
            cb(null, paths);
        });
    } catch (e) {
        cb(e);
    }
}
    
function extractDependencies(pathname, cb) {
    try {
        // See if this succeeds (sync)
        const dependencies = require(pathname).dependencies || {};
        const found = [];
        
        Object.keys(dependencies)
            .forEach(key => found.push({ name: key, spec: dependencies[key] }));
        
        cb(null, found);
    } catch (e) {
        cb(e);
    }
}

// Only mark modules as externals if the range required in the top-most
// package.json dependencies field is satisfied by the first (default)
// version on webtask.io
function compareToModules(dependencies, modules, cb) {
    const context = {
        externals: modules.native,
        bundled: {},
    };
    
    dependencies.forEach(function (dependency) {
        const moduleName = dependency.name;
        const spec = dependency.spec || '*';
        const available = modules.installed[moduleName];
        const defaultWebtaskVersion = available && available[0];
        
        if (defaultWebtaskVersion && Semver.satisfies(defaultWebtaskVersion, spec)) {
            context.externals[moduleName] = true;
        } else {
            context.bundled[moduleName] = {
                available: available,
                spec: spec,
            };
        }
    });
    
    return cb(null, context);
}
