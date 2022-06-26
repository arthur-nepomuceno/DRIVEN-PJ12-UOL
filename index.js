import express from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config()

const server = express();
server.use(cors());
server.use(express.json());
const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");


server.post("/participants", async (request, response) => {
    //gathering meaningfull data
    const body = request.body;
    const lastStatus = Date.now();
    //developing validation schema
    const nameSchema = joi.object({name: joi.string().required()});
    const validation = nameSchema.validate(body, {abortEarly: false});
    //verifying if name already exists

    let repeatedName = false;
    try {
        await mongoClient.connect();
        const dbUol = mongoClient.db("uolDataBase");
        const participants = dbUol.collection("participants");
        const sameNameList = await participants.find({name: body.name}).toArray();

        if(sameNameList.length > 0){
            repeatedName = true;
        }

        if(validation.error){
            response.status(422).send("Something went wrong :/");
        } else if(repeatedName){
            response.status(409).send("Username already logged. Please choose another one.")
        } else {
            participants.insertOne({name: body.name, lastStatus: lastStatus});    
            response.status(201).send(`Welcome, ${body.name}!`);
        }        
    } catch(error){
        response.status(500).send("Server error :(");
    }
})

server.get("/participants", (request, response) => {
    db.collection("participants").find().toArray().then((participant) => {
        response.send(participant);
    })
})

server.listen(5000);