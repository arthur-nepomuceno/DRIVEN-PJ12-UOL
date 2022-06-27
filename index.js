import express from "express";
import cors from "cors";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config()

const server = express();
server.use(cors());
server.use(express.json());

let dbUol;
const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");
mongoClient.connect().then(() => {
    dbUol = mongoClient.db("uolDataBase");
})

// POST and GET participants
server.post("/participants", async (request, response) => {
    const body = request.body;
    const {name} = body;
    const lastStatus = Date.now();
    const time = dayjs().format('HH:mm:ss');
    let repeatedName = false;

    const nameSchema = joi.object({name: joi.string().required()});
    const validation = nameSchema.validate(body, {abortEarly: false});
    
    const participants = dbUol.collection("participants");
    const messages = dbUol.collection("messages");
    
    try {
        const sameNameList = await participants.find({name}).toArray();

        if(sameNameList.length > 0){
            repeatedName = true;
        }

        if(validation.error){
            response.status(422).send("Something went wrong :/");
        } else if(repeatedName){
            response.status(409).send("Username already logged. Please choose another one.")
        } else {
            participants.insertOne({name: body.name, lastStatus: lastStatus});
            messages.insertOne({from: body.name, to: "Todos", text: "Entra na sala...", type: "status", time})  
            response.status(201).send(`Welcome, ${body.name}! At ${time}`);
        }

    } catch(error){
        response.status(500).send("Server error :(");
    }
})

server.get("/participants", async (request, response) => {
    const participants = dbUol.collection("participants");

    try {
        const participantsList = await participants.find().toArray();
        response.send(participantsList);
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

// POST and GET messages
server.post("/messages", async (request, response) => {
    const body = request.body;
    const participantName = "Joaninha"; // request.header.user;
    const {to, text, type} = body;
    const time = dayjs().format('HH:mm:ss')
    const participants = dbUol.collection("participants");
    const messages = dbUol.collection("messages");
    
    // initiating validation
    const participantsList = await participants.find({name: participantName}).toArray();
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required()
    })

    try {
        // after finishing validation schema, modify condition
        if(participantsList.length > 0){
            const newMessage = {from: participantName, to, text, type, time};
            await messages.insertOne(newMessage);
            response.status(201).send(`Message sent succeffuly!`)
        } else {
            response.status(201).send(`Participant not on the list.`)
        }
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

server.get("/messages", async (request, response) => {
    const messages = dbUol.collection("messages");
    
    try{
        const messagesList = await messages.find().toArray();
        response.send(messagesList);
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

server.listen(5000);