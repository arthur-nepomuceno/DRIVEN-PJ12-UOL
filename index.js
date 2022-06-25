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
    
    //receiving info
    const body = request.body;

    //creating validation schema
    const nameSchema = joi.object({name: joi.string().required()});

    //validating
    const validation = nameSchema.validate(body, {abortEarly: false});

    //stablishing conditions
    if(validation.error){
        response.status(422).send("Something went wrong :/")
    } else {
        db.collection("participants").insert({body}) //saving participant on data base
        response.status(201).send(`Welcome, ${body.name}!`) 
    }
})

server.get("/participants", (request, response) => {
    db.collection("participants").find().toArray().then((participant) => {
        console.log(participant);
    })
    response.send("ok")
})

server.listen(5000);