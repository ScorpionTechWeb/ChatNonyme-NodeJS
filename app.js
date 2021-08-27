const path = require("path");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

// MYSQL Config
let config = require("./config.js");
const mysql = require("mysql");
const { cpuUsage } = require("process");
let connection = mysql.createConnection(config);

connection.connect(function (err) {
    if (err) throw err;
    console.log("Mysql Connected!");

    let userList = [];
    let sql;

    app.use(express.static(path.join(__dirname, "/public"))).get(
        "/",
        (req, res) => {
            res.sendFile(__dirname + "/index.html");
        }
    );

    app.get("/login", (req, res) => {
        res.sendFile(__dirname + "/login.html");
    });

    io.on("connection", function (socket) {
        // Mysql selectionner tout les messages
        connection.query("SELECT * FROM messages", function (err, msgs) {
            if (err) throw err;
            socket.emit("load_old_msgs", msgs);
        });

        // Mysql selectionner tout les utilisateurs
        connection.query("SELECT * FROM users", function (err, users) {
            if (err) throw err;
            socket.emit("usersConnected", users);
        });

        socket.on("sendPseudo", (pseudo) => {
            if (userList.includes(pseudo)) {
                socket.emit("pseudoAlreadyUsed");
            } else {
                // Mysql Ajout d'un utilisateur
                sql = "INSERT INTO users (pseudo) VALUES ('" + pseudo + "')";
                connection.query(sql);
                userList.push(pseudo);
                socket.broadcast.emit("newUser", pseudo);
                connection.query("SELECT * FROM users", function (err, users) {
                    if (err) throw err;
                    socket.emit("allUsers", users);
                });
                socket.emit("pseudoValid");
            }
        });

        // Mettre pseudo à jour
        socket.on("updatePseudo", (oldPseudo, newPseudo) => {
            if (userList.includes(newPseudo)) {
                socket.emit("pseudoAlreadyUsed");
            } else {
                sql =
                    "UPDATE users SET pseudo = ('" +
                    newPseudo +
                    "') WHERE pseudo = ('" +
                    oldPseudo +
                    "')";
                connection.query(sql);
                socket.broadcast.emit("updatePseudo", oldPseudo, newPseudo);
                socket.emit("updatePseudoValid");
            }
        });

        // Nouveau message
        socket.on("sendMessage", (pseudo, msg) => {
            connection.query(
                "INSERT INTO messages (pseudo, msg) VALUES('" +
                    pseudo +
                    "', '" +
                    msg +
                    "')",
                function (error, result) {
                    if (error) throw result;
                    socket.broadcast.emit("newMessage", pseudo + " : " + msg);
                }
            );
        });

        // Check Utilisateur
        socket.on("checkConnexion", (pseudo, password) => {
            sql =
                "SELECT * FROM users WHERE pseudo ='" +
                pseudo +
                "' AND password = '" +
                password +
                "'";
            connection.query(sql, function (error, result) {
                if (error) throw result;
                let string = JSON.stringify(result);
                let json = JSON.parse(string);
                if (json[0].pseudo) {
                    console.log("Pseudo Exist!");
                    socket.broadcast.emit("newUser", pseudo);
                    socket.emit("pseudoValid");
                } else {
                    console.log("Pseudo n'existe pas!");
                }
            });
        });
    });
});

server.listen(8080);
