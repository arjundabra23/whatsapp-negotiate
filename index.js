const { OpenAI } = require("openai");
const express = require("express");
const body_parser = require("body-parser");
const axios = require("axios");

require('dotenv').config();

const app = express().use(body_parser.json());

const token = process.env.TOKEN;
const mytoken = process.env.MYTOKEN;

console.log("initializing openai instance");

// Set up OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const RESTAURANT_OWNER = "16506759100";
const VENDOR_1 = "16315900900";

app.listen(process.env.PORT || 3000, () => {
    console.log("webhook is listening");
});

// To verify the callback URL from the dashboard side - cloud API side
app.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let challenge = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];

    if (mode && token) {
        if (mode === "subscribe" && token === mytoken) {
            res.status(200).send(challenge);
        } else {
            res.status(403).send("Forbidden");
        }
    }
});

app.post("/webhook", async (req, res) => {
    let body_param = req.body;

    console.log(JSON.stringify(body_param, null, 2));

    if (body_param.object) {
        // We receive a message
        console.log("inside body param");
        if (body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.messages &&
            body_param.entry[0].changes[0].value.messages[0]
        ) {
            let sender_num = body_param.entry[0].changes[0].value.messages[0].from;
            console.log("from " + sender_num);
            let phon_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            let msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;

            console.log("phone number " + phon_no_id);
            console.log("body param " + msg_body);

            if (sender_num == RESTAURANT_OWNER) {
                let generated_response = await generateGPTResponse();

                axios({
                    method: "POST",
                    url: "https://graph.facebook.com/v13.0/" + phon_no_id + "/messages?access_token=" + token,
                    data: {
                        messaging_product: "whatsapp",
                        to: VENDOR_1,
                        text: {
                            body: generated_response
                        }
                    },
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            } else if (sender_num == VENDOR_1) {
                axios({
                    method: "POST",
                    url: "https://graph.facebook.com/v13.0/" + phon_no_id + "/messages?access_token=" + token,
                    data: {
                        messaging_product: "whatsapp",
                        to: RESTAURANT_OWNER,
                        text: {
                            body: "Hi.. I'm VENDOR1, your forwarded message is " + msg_body
                        }
                    },
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    }
});

app.get("/", (req, res) => {
    res.status(200).send("hello this is webhook setup");
});

let generateGPTResponse = async () => {
    console.log("This ran");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { "role": "system", "content": "You are a helpful assistant." },
                { "role": "user", "content": "Who won the world series in 2020?" },
                { "role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020." },
                { "role": "user", "content": "Where was it played?" }
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error generating response:", error);
        return "Sorry, I couldn't generate a response.";
    }
};
