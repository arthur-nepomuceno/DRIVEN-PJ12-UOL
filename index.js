import express from "express";
import cors from "cors";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient, ObjectId} from "mongodb";
import dotenv from "dotenv";
dotenv.config()

const server = express();
server.use(cors());
server.use(express.json());

let dbUol;
const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect().then(() => {
    dbUol = mongoClient.db("uolDataBase");
})

let onlineUser;

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
            onlineUser = {name: body.name};
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

// POST,GET and DELETE messages
server.post("/messages", async (request, response) => {
    const body = request.body;
    const {to, text, type} = body;
    const participantName = request.headers.user;
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
    const participantName = request.headers.user;
    
    try{
        const allMessages = await messages.find().toArray();

        let participantMessages = [];
        let lastMessagePosition = participantMessages.length - 1;        
        let messagesList = [];

        for(let i = 0; i < allMessages.length; i++){
            const message = allMessages[i];
            if(message.type === "message" || message.type === "status"){
                participantMessages.push(message);
            }
            if(message.type === "private_message" && message.from === participantName){
                participantMessages.push(message);
            }
            if(message.type === "private_message" && message.to === participantName){
                participantMessages.push(message);
            }
        }

        if(limit > lastMessagePosition || !limit){
            response.send(participantMessages);
        } else if(limit < lastMessagePosition){
            for(let i = 0; i < limit; i++){
                const lastMessage = participantMessages[lastMessagePosition - i];
                messagesList.push(lastMessage);                
            }
            response.send(messagesList);
        }
    } catch(error){
        response.status(500).send("Server error :(")
    }
})

server.delete("/messages/:id", async (request, response) => {
    const messageID = request.params.id;
    const userName = request.headers.user;
    const messageCollection = dbUol.collection("messages");

    try{
        const message = await messageCollection.findOne({_id: new ObjectId(messageID)});
        if(message.from === userName){
            await messageCollection.deleteOne({_id: new ObjectId(messageID)});
            response.status(200).send(`Message deleted successfully.`);
        } else {
            response.status(401).send(`User "${userName}" unauthorized. It wasn't you who sent this message.`);
        }
        
    } catch(error){
        response.status(404).send(`Message ${messageID} not found.`)
    }
})

// POST status
server.post("/status", async(request, response) => {
    const participantName = request.headers.user;
    const participants = dbUol.collection("participants");
    const time = Date.now();
    try{
        const register = await participants.find({name: participantName}).toArray();
        
        if(register.length !== 0){
            await participants.updateOne({name: participantName}, {$set: {lastStatus: time}});
            response.status(200).send(`Participant "${participantName}" time-status updated.`)
        } else {
            response.status(404).send("Participant not found.");
        }

    } catch(error){
        response.status(500).send("Server error :(");
    }
})

// Removing non-active participants
async function removeParticipant(){
    const timeStamp = Date.now();
    const time = dayjs().format("HH:mm:ss");
    const usersCollection = dbUol.collection("participants");
    const messageCollection = dbUol.collection("messages");
    const usersList = await usersCollection.find().toArray();
    const messageList = await messageCollection.find().toArray();

    usersList.map(async (user) => {
        const timeGap = timeStamp - user.lastStatus;
        if(timeGap > 10000){
            await usersCollection.deleteOne({name: user.name});
            await messageCollection.insertOne({from: user.name, 
                                               to: "Todos", 
                                               text: "sai da sala...", 
                                               type: "status", 
                                               time});
        }
    })
}

// Ensuring that current user stays online
async function stayOnline(){
    const timeStamp = Date.now();
    const usersCollection = dbUol.collection("participants");
    try{
        const user = await usersCollection.findOne(onlineUser);
        await usersCollection.updateOne({name: user.name}, {$set: {lastStatus: timeStamp}})
    } catch(error){
        console.log("User not found.")
    }

}

setInterval(stayOnline, 5000)
setInterval(removeParticipant, 15000);

server.listen(5000);