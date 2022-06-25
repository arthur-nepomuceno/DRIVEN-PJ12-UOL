import express from "express";
import joi from "joi";

const server = express();
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
        response.status(201).send(`Welcome, ${body.name}!`) 
    }

})

server.get("/participants", (request, response) => {
    response.send("ok")
})

server.listen(5000);