import express from "express";
import joi from "joi";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config()


const server = express();
const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db("uolDataBase")
})


server.use(express.json());

server.post("/participants", (request, response) => {
    //gathering meaningfull data
    const body = request.body;
    const lastStatus = Date.now();
    //developing validation schema
    const nameSchema = joi.object({name: joi.string().required()});
    const validation = nameSchema.validate(body, {abortEarly: false});
    //verifying if name already exists
    let isThereName = false;
    db.collection("participants").find({name: body.name}).toArray().then((participant) => {
        if(participant.length > 0){
            isThereName = true;
        }

        console.log(participant);
        console.log(participant.length)
        console.log(isThereName)
    });
    // returning server answers
    if(validation.error){
        response.status(422)
                .send("Something went wrong :/");
    } else {
        db.collection("participants")
          .insertOne({name: body.name, lastStatus: lastStatus});

        response.status(201)
                .send(`Welcome, ${body.name}! ${isThereName}`);
    }
})

server.get("/participants", (request, response) => {
    db.collection("participants").find().toArray().then((participant) => {
        response.send(participant);
    })
})

server.listen(5000);