let express = require('express');
let path = require('path');
let fs = require('fs');
let MongoClient = require('mongodb').MongoClient;
let app = express();
let PORT = 8020

// App
let client = require('prom-client');
let collectDefaultMetrics = client.collectDefaultMetrics;
// Probe every 5th second.
collectDefaultMetrics({ timeout: 5000 });

// bodyParser was deprecated: https://stackoverflow.com/a/59892173
let counter = new client.Counter({
  name: 'node_request_operations_total',
  help: 'The total number of processed requests'
});

let histogram = new client.Histogram({
  name: 'node_request_duration_seconds',
  help: 'Histogram for the duration in seconds.',
  buckets: [1, 2, 5, 6, 10]
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', function (req, res) {
  //Simulate a sleep
  let start = new Date()
  let simulateTime = 1000

  setTimeout(function (argument) {
    // execution time simulated with setTimeout function
    let end = new Date() - start
    histogram.observe(end / 1000); //convert to seconds
  }, simulateTime)

  counter.inc();
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);

  try {
    // Wait for the promise to resolve
    const metricsString = await client.register.metrics();

    // Ensure that the resolved value is a string
    if (typeof metricsString === 'string') {
      res.end(metricsString);
    } else {
      console.error('Metrics is not a string:', metricsString);
      res.status(500).end(); // Or handle the error appropriately
    }
  } catch (err) {
    console.error('Error generating metrics:', err);
    res.status(500).end(); // Or handle the error appropriately
  }
});

app.get('/profile-picture', function (req, res) {
  let img = fs.readFileSync(path.join(__dirname, "images/profile-1.jpg"));
  res.writeHead(200, { 'Content-Type': 'image/jpg' });
  res.end(img, 'binary');
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});

// use when starting application locally with node command
let mongoUrlLocal = "mongodb://admin:password@localhost:27017";

// use when starting application as a separate docker container
let mongoUrlDocker = "mongodb://admin:password@host.docker.internal:27017";

// use when starting application as docker container, part of docker-compose
let mongoUrlDockerCompose = "mongodb://admin:password@mongodb";

let mongoUrlK8s = `mongodb://${process.env.USER_NAME}:${process.env.USER_PWD}@${process.env.DB_URL}`

// pass these options to mongo client connect request to avoid DeprecationWarning for current Server Discovery and Monitoring engine
let mongoClientOptions = { useNewUrlParser: true, useUnifiedTopology: true };

// "user-account" in demo with docker. "my-db" in demo with docker-compose
let databaseName = "my-db";

app.post('/update-profile', function (req, res) {
  let userObj = req.body;

  MongoClient.connect(mongoUrlK8s, mongoClientOptions, function (err, client) {
    if (err) throw err;

    let db = client.db(databaseName);
    userObj['userid'] = 1;

    let myquery = { userid: 1 };
    let newvalues = { $set: userObj };

    db.collection("users").updateOne(myquery, newvalues, { upsert: true }, function (err, res) {
      if (err) throw err;
      client.close();
    });

  });
  // Send response
  res.send(userObj);
});

app.get('/get-profile', function (req, res) {
  let response = {};
  // Connect to the db
  MongoClient.connect(mongoUrlK8s, mongoClientOptions, function (err, client) {
    if (err) throw err;

    let db = client.db(databaseName);

    let myquery = { userid: 1 };

    db.collection("users").findOne(myquery, function (err, result) {
      if (err) throw err;
      response = result;
      client.close();

      // Send response
      res.send(response ? response : {});
    });
  });
});

app.listen(PORT, function () {
  console.log(`app listening on port ${PORT}!`);
});

