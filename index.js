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


server.post("/messages", async (request, response) => {
    const body = request.body;
    const {to, text, type} = body;
    const participantName = request.header.user;
    const time = dayjs().format('HH:mm:ss')
    
    const participants = dbUol.collection("participants");
    const messages = dbUol.collection("messages");
    
    let isParticipantOnline;
    const participantsList = await participants.find({name: participantName}).toArray();
    if(participantsList.length === 0){
        isParticipantOnline = false;
    } else {
        isParticipantOnline = true;
    }
    
    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid("message", "private_message")
    });

    let isValidMessage;
    const messageInfo = {from: participantName, to, text, type};
    const validation = messageSchema.validate(messageInfo, {abortEarly: false})

    if(validation.error || isParticipantOnline === false){
        isValidMessage = false;
    } else {
        isValidMessage = true;
    }

    try {
        if(isValidMessage){
            const newMessage = {from: participantName, to, text, type, time}
            await messages.insert(newMessage);
            response.status(201).send(`Message sent succeffuly!`)
        } else {
            response.status(422).send(`Message not sent. Missing data.`)
        }
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

server.get("/messages", async (request, response) => {
    const messages = dbUol.collection("messages");
    const limit = parseInt(request.query.limit);
    const participantName = request.header.user;
    
    try{
        let messagesList = [];
        const allMessages = await messages.find().toArray();
        let lastMessagePosition = allMessages.length - 1;
        
        //Write routine for selecting participant available messages
        
        if(limit > lastMessagePosition || !limit){
            response.send(allMessages);
        } else if(limit < lastMessagePosition){
            for(let i = 0; i < limit; i++){
                const lastMessage = allMessages[lastMessagePosition - i];
                messagesList.push(lastMessage);                
            }
            response.send(messagesList);
        }
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

server.listen(5000);