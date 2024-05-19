// Import dependencies
const { OpenAI } = require("openai");
const express = require("express");
const body_parser = require("body-parser");
const axios = require("axios");
require('dotenv').config();

// Constants and configurations
const RESTAURANT_OWNER = "16506759100";
const PORT = process.env.PORT;
const TOKEN = process.env.TOKEN;
const MY_TOKEN = process.env.MYTOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VENDOR_1 = "16315900900";
const VENDOR_2 = "14159993716";
const VENDOR_3 = "";

const initOpenAI = () => {
    console.log("Initializing openai instance");
    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    });
    return openai;
}

const openai = initOpenAI();
const app = express().use(body_parser.json());

let ownerChatHistory = [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Who won the world series in 2020?" },
    { "role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020." },
    { "role": "user", "content": "Where was it played?" }
];

app.listen(PORT || 3000, () => {
    console.log(`Webhook is listening on port ${PORT}`);
});



// Function to handle webhook verification
const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];

    if (mode && token) {
        if (mode === "subscribe" && token === MYTOKEN) {
            res.status(200).send(challenge);
        } else {
            res.status(403).send("Forbidden");
        }
    }
};

// Function to handle incoming messages
const handleMessage = async (req, res) => {
    const bodyParam = req.body;
    console.log(JSON.stringify(bodyParam, null, 2));

    if (bodyParam.object) {
        const entry = bodyParam.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        if (message) {
            const senderNum = message.from;
            const phoneNumberId = changes.value.metadata.phone_number_id;
            const msgBody = message.text.body;

            console.log(`From: ${senderNum}`);
            console.log(`Phone number ID: ${phoneNumberId}`);
            console.log(`Message body: ${msgBody}`);

            if (senderNum === RESTAURANT_OWNER) {
                await sendMessage(phoneNumberId, RESTAURANT_OWNER, "Okay, got it. I'll go talk to your vendors and create the order for the best prices this week.");
                // you neee
                ownerChatHistory.push({ "role": "user", "content": msgBody });
                const generatedResponse = await generateGPTResponse(ownerChatHistory);
                await sendMessage(phoneNumberId, VENDOR_1, generatedResponse);

            } else if (senderNum === VENDOR_1) {
                const response = `Hi.. I'm VENDOR1, your forwarded message is ${msgBody}`;
                await sendMessage(phoneNumberId, RESTAURANT_OWNER, response);
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    }
};

// Function to generate a response using GPT
const generateGPTResponse = async (entireChat) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: entireChat,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error generating response:", error);
        return "Sorry, I couldn't generate a response.";
    }
};

// Function to send a message
const sendMessage = async (phoneNumberId, recipient, message) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v13.0/${phoneNumberId}/messages?access_token=${TOKEN}`,
            {
                messaging_product: "whatsapp",
                to: recipient,
                text: { body: message },
            },
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// Routes
app.get("/webhook", verifyWebhook);
app.post("/webhook", handleMessage);

app.get("/", (req, res) => {
    res.status(200).send("Hello, this is webhook setup");
});

// owner set-up prompts:
// you get the message for what items
// you say, okay, i'll go find these items
// then you pass the message string for the items you were given by the owner in to the ownerChatHistory
// along with a prompt that tells you to negotiate based on these
// the conversation happens with a vendor

// once you have conversrved 6 turns, pass in a prompt to vendorOneChatHistory saying that okay find the best price so far 
// // and return a response in the form of a json
// then we want to post this json to a Firestore backend
// conversation ending prompt

// technical steps
// OWNER logic:
// you have a metaprompt of what needs to happen
// accept a list of items
// say okay, I will go and check and come back to you
// pass this information to the vendor 
// how: you need to pass that string to the vendor whatsapp convo and say: 
// // "here is a list of items you need to inquire on pricing about"

// Vendor 1 Logic: