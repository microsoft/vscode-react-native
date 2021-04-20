const express = require("express");
const app = express();

app.use(express.json());

app.get("/", function (req, res) {
    console.log("Got a GET request for /");
   res.send("Test GET");
});

app.get("/get_sample", function (req, res) {
   console.log("Got a GET request for /get_sample");
   res.set("Cache-Control", "no-store");
   res.send(`GET request success: ${req.query.param1}Success`);
});

app.post("/post_sample", function(req, res) {
   console.log("Got a POST request for /post_sample", req.body);
   res.json({
       testStr: req.body.testStr + "Success",
       testNun: 123,
       testArr: [1, 2],
    });
});

const server = app.listen(7321, function () {
   const host = server.address().address;
   const port = server.address().port;

   console.log("Express app is listening at http://%s:%s", host, port);
});