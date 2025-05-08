const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const stream = require("stream");

const app = express();
const port = 5000;

// Connect to LocalStack S3
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "test";

app.get("/*name", async (req, res) => {
  const key = req.path === "/" ? "index.html" : req.path.slice(1);

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const data = await s3.send(command);

    res.setHeader("Content-Type", mime.lookup(key) || "application/octet-stream");
    stream.Readable.from(data.Body).pipe(res);
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      res.status(404).send("File not found in S3");
    } else {
      console.error("S3 error:", err);
      res.status(500).send("Internal server error");
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 S3 static server running at http://localhost:${port}`);
});