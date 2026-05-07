require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mfz0bkx.mongodb.net/studymateDB?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const isValidObjectId = (id) => ObjectId.isValid(id);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB connected");

    const db = client.db("studymateDB");

    const partnersCollection = db.collection("partners");
    const connectionsCollection = db.collection("connections");

    app.get("/", (req, res) => {
      res.send("StudyMate Server is running");
    });


    app.get("/partners", async (req, res) => {
      const search = req.query.search || "";
      const sort = req.query.sort || "";

      const query = search
        ? {
            subject: {
              $regex: search,
              $options: "i",
            },
          }
        : {};

      const partners = await partnersCollection.find(query).toArray();

      const expOrder = {
        Beginner: 1,
        Intermediate: 2,
        Expert: 3,
      };

      if (sort === "asc" || sort === "desc") {
        partners.sort((a, b) => {
          const av = expOrder[a.experienceLevel] || 999;
          const bv = expOrder[b.experienceLevel] || 999;

          return sort === "asc" ? av - bv : bv - av;
        });
      }

      res.send(partners);
    });

 
    app.get("/partners-top", async (req, res) => {
      const limit = Number(req.query.limit || 3);

      const result = await partnersCollection
        .find()
        .sort({ rating: -1 })
        .limit(limit)
        .toArray();

      res.send(result);
    });


    app.get("/partners/:id", async (req, res) => {
      const id = req.params.id;

      if (!isValidObjectId(id)) {
        return res.status(400).send({
          message: "Invalid partner id",
        });
      }

      const result = await partnersCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.post("/partners", async (req, res) => {
      const partner = req.body;

      partner.rating = Number(partner.rating || 0);
      partner.partnerCount = Number(partner.partnerCount || 0);

      const result = await partnersCollection.insertOne(partner);

      res.send(result);
    });


    app.post("/connections", async (req, res) => {
      const { partnerId, requesterEmail } = req.body;

      // validate id
      if (!isValidObjectId(partnerId)) {
        return res.status(400).send({
          message: "Invalid partner id",
        });
      }

      const existing = await connectionsCollection.findOne({
        partnerId,
        requesterEmail,
      });

      if (existing) {
        return res.status(409).send({
          message: "You already sent request to this partner",
        });
      }

      const partner = await partnersCollection.findOne({
        _id: new ObjectId(partnerId),
      });

      if (!partner) {
        return res.status(404).send({
          message: "Partner not found",
        });
      }

      await partnersCollection.updateOne(
        { _id: new ObjectId(partnerId) },
        {
          $inc: {
            partnerCount: 1,
          },
        }
      );

      const requestDoc = {
        partnerId,
        requesterEmail,

        partnerName: partner.name,
        partnerImage: partner.profileimage,
        subject: partner.subject,
        studyMode: partner.studyMode,
        experienceLevel: partner.experienceLevel,

        createdAt: new Date(),
      };

      const result = await connectionsCollection.insertOne(requestDoc);

      res.send(result);
    });


    app.get("/connections", async (req, res) => {
      const email = req.query.email;

      const result = await connectionsCollection
        .find({
          requesterEmail: email,
        })
        .toArray();

      res.send(result);
    });


    app.patch("/connections/:id", async (req, res) => {
      const id = req.params.id;

      if (!isValidObjectId(id)) {
        return res.status(400).send({
          message: "Invalid connection id",
        });
      }

      const updatedData = req.body;

      const result = await connectionsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updatedData,
        }
      );

      res.send(result);
    });


    app.delete("/connections/:id", async (req, res) => {
      const id = req.params.id;

      if (!isValidObjectId(id)) {
        return res.status(400).send({
          message: "Invalid connection id",
        });
      }

      const result = await connectionsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    console.log("All routes ready");
  } catch (error) {
    console.log("MongoDB error:", error.message);
  }
}

run();

app.listen(port, () => {
  console.log(`StudyMate server running on port ${port}`);
});