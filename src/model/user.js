"use strict";
const couchbase = require('../database/couchbase');
const Role = require('./role');

var addUser = async function (user, callback) {
    try {
        await couchbase.connectToDatabase();
        const key = `user::${user.username}`;
        const doc = {
            username: user.username,
            last_name: user.last_name,
            first_name: user.first_name,
            email: user.email,
            password: user.password,
            role: Role.User,
            access_type: user.access_type
        };
        const result = await couchbase.Users.insert(key, doc);
        callback(null, { insertedId: key, result });
    } catch (err) {
        var error = new Error("addUser()." + err.message);
        error.status = err.status;
        callback(error);
    }
};

var addAdmin = async function (user, callback) {
    try {
        await couchbase.connectToDatabase();
        const key = `user::${user.username}`;
        const doc = {
            last_name: user.last_name,
            first_name: user.first_name,
            email: user.email,
            password: user.password,
            username: user.username,
            role: Role.Admin,
            access_type: "both"
        };
        const result = await couchbase.Users.insert(key, doc);
        callback(null, { insertedId: key, result });
    } catch (err) {
        var error = new Error("addAdmin()." + err.message);
        error.status = err.status;
        callback(error);
    }
};

var getUser = async function (emailId, callback) {
    try {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "SELECT Users.* FROM Users WHERE email = $1 LIMIT 1",
            { parameters: [emailId] }
        );
        if (result.rows.length === 0) {
            var error1 = new Error("getUser(). \nMessage: No User Found. One Requested.");
            error1.status = 404;
            callback(error1);
            return;
        }
        callback(null, result.rows[0]);
    } catch (err) {
        var error = new Error("getUser()." + err.message);
        error.status = 500;
        callback(error);
    }
};

var getEmailIdByUserName = async function (username) {
    try {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "SELECT Users.email FROM Users WHERE username = $1 LIMIT 1",
            { parameters: [username] }
        );
        if (result.rows.length > 0) {
            return result.rows[0].email;
        }
        return "abhinovpankaj1@gmail.com";
    } catch (err) {
        console.error("getEmailIdByUserName error:", err);
        return "abhinovpankaj1@gmail.com";
    }
};

var getUserbyUsername = async function (username, callback) {
    if (username === undefined) {
        var error1 = new Error("getUser(). \nMessage: No User Found. username undefined.");
        error1.status = 404;
        callback(error1);
        return;
    }
    try {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "SELECT Users.* FROM Users WHERE username = $1 LIMIT 1",
            { parameters: [username] }
        );
        if (result.rows.length === 0) {
            var error2 = new Error("getUser(). \nMessage: No User Found. One Requested.");
            error2.status = 404;
            callback(error2);
            return;
        }
        callback(null, result.rows[0]);
    } catch (err) {
        var error = new Error("getUserbyUsername()." + err.message);
        error.status = 500;
        callback(error);
    }
};

var updateUser = async function (user, callback) {
    try {
        await couchbase.connectToDatabase();
        const fields = Object.entries(user).filter(([k]) => k !== 'username');
        if (fields.length === 0) {
            callback(null, { status: 409, message: "No fields to update." });
            return;
        }
        const setClause = fields.map(([k], i) => `\`${k}\` = $${i + 2}`).join(', ');
        const params = [user.username, ...fields.map(([, v]) => v)];
        const result = await couchbase.prod_scope.query(
            `UPDATE Users SET ${setClause} WHERE username = $1`,
            { parameters: params }
        );
        const mutationCount = result.meta && result.meta.metrics ? result.meta.metrics.mutationCount : 0;
        if (mutationCount < 1) {
            var error = new Error("No User found, please register user.");
            error.status = 401;
            callback(error);
        } else {
            callback(null, { status: 201, message: "User details updated successfully." });
        }
    } catch (err) {
        var error = new Error("updateUser()." + err.message);
        error.status = 500;
        callback(error);
    }
};

var getAllUser = async function (callback) {
    try {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "SELECT Users.* FROM Users LIMIT 50"
        );
        if (result.rows.length === 0) {
            var error = new Error("getAllUser(). \nMessage: No Users Found. All Requested.");
            error.status = 401;
            callback(error);
            return;
        }
        const users = result.rows.map(item => {
            delete item.password;
            return item;
        });
        callback(null, { status: 200, users });
    } catch (err) {
        var error = new Error("getAllUser()." + err.message);
        error.status = 500;
        callback(error);
    }
};

var removeUser = async function (user, callback) {
    try {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "DELETE FROM Users WHERE username = $1",
            { parameters: [user.username] }
        );
        const mutationCount = result.meta && result.meta.metrics ? result.meta.metrics.mutationCount : 0;
        if (mutationCount === 1) {
            callback(null, { status: 201, message: "User deleted successfully." });
        } else {
            var error = new Error("Error occurred. Didn't remove user.");
            error.status = 500;
            callback(error);
        }
    } catch (err) {
        var error = new Error("removeUser()." + err.message);
        error.status = 500;
        callback(error);
    }
};


module.exports = {
    addUser: addUser,
    getUser: getUser,
    addAdmin:addAdmin,
    getAllUser: getAllUser,
    removeUser: removeUser,
    getUserbyUsername,
    updateUser,
    getEmailIdByUserName
};