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

let firstMessageToGeorge = true;
let numVendorOneChatRounds = 0;
let doneNegotiating = false;

let ownerChatHistory = [
    { "role": "system", "content": "" },
];

let vendorOneChatHistory = [
    { "role": "system", "content": "You are a master negotiator for a restaurant in San Francisco. You are talking to a vendor. Using the next message as a reference, extract the ingredients you need to negotiate for. Then talk to me, the vendor, ask for the prices of the ingredients. You will attempt to negotiate these prices to find me a good deal. Don't sound like an AI. don't always use correct grammar. this is happening over whatsapp on a mobile phone keyboard. sound like a normal immigrant restaurant owner." },
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
                if (firstMessageToGeorge) {
                    firstMessageToGeorge = false;
                    await sendMessage(phoneNumberId, RESTAURANT_OWNER, "Okay, got it. I'll go talk to your vendors and create the order for the best prices this week.");
                    vendorOneChatHistory.push({ "role": "system", "content": msgBody });
                    const generatedResponse = await generateGPTResponse(vendorOneChatHistory);
                    vendorOneChatHistory.push({ "role": "assistant", "content": generatedResponse });
                    await sendMessage(phoneNumberId, VENDOR_1, generatedResponse);
                } else {
                    await sendMessage(phoneNumberId, RESTAURANT_OWNER, "I'm busying talking to your vendors right now. I'll come back to you when I'm done and then we can chat further.");
                }

            } else if (senderNum === VENDOR_1) {
                console.log("I got a message from vendor")
                if (numVendorOneChatRounds == 5) {
                    vendorOneChatHistory.push({ "role": "system", "content": "Okay, look at the chat history above and find the best price offered so for the the items. Then give me back a message listing these ingredients and best prices. You are now talking to the restaurant owner, so address the owner in this message." });
                    const generatedResponse = await generateGPTResponse(vendorOneChatHistory);
                    await sendMessage(phoneNumberId, RESTAURANT_OWNER, generatedResponse);
                    doneNegotiating = true;
                }
                console.log("pushing vendor message to");
                console.log(msgBody);
                vendorOneChatHistory.push({ "role": "user", "content": msgBody });
                const generatedResponse = await generateGPTResponse(vendorOneChatHistory);
                vendorOneChatHistory.push({ "role": "assistant", "content": generatedResponse });
                await sendMessage(phoneNumberId, VENDOR_1, generatedResponse);
                numVendorOneChatRounds++;
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
            model: "gpt-4o",
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