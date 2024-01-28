import { Router } from "express";

import fs from "fs";
import { PostHog } from 'posthog-node'

import axios from "axios";

const male_voice = "onyx"
const female_voice = "nova"

type ChatCompletion = {
    id: string;
    object: string;
    created: number;
    model: string;
    system_fingerprint: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string;
        };
        logprobs: null;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

let convo: any[] = [
    { language: "en", "sender": "Man", "text": "Hi there! How's your day going?" },
    { language: "en", "sender": "Woman", "text": "Hey! It's going pretty well, thanks. How about yours?" },
    { language: "en", "sender": "Man", "text": "Not too bad, just getting through some work. What are you up to today?" },
    { language: "en", "sender": "Woman", "text": "I'm actually working on a painting right now. I've recently taken up art as a hobby." },
    { language: "en", "sender": "Man", "text": "That sounds really interesting. What kind of painting are you working on?" },
    { language: "en", "sender": "Woman", "text": "It's a landscape painting of a sunset over the mountains. I love nature scenes." },
    { language: "en", "sender": "Man", "text": "I'd love to see it when you're done. Do you paint often?" },
    { language: "en", "sender": "Woman", "text": "Sure, I'll show you! I try to paint a few times a week. It's very relaxing." },
    { language: "en", "sender": "Man", "text": "That's awesome. Do you have any other hobbies?" },
    { language: "en", "sender": "Woman", "text": "I also enjoy hiking and reading. How about you?" },
    { language: "en", "sender": "Man", "text": "I'm a big fan of hiking as well! And I play the guitar in my spare time." },
    { language: "en", "sender": "Woman", "text": "That's cool! How long have you been playing guitar?" },
    { language: "en", "sender": "Man", "text": "About 10 years now. It's a great way to unwind." },
    { language: "en", "sender": "Woman", "text": "I've always wanted to learn a musical instrument. Maybe you can teach me some guitar basics sometime." },
    { language: "en", "sender": "Man", "text": "I'd be happy to! It's always fun to share music with others." },
    { language: "en", "sender": "Woman", "text": "That sounds like a plan. Maybe we could go for a hike sometime too." },
    { language: "en", "sender": "Man", "text": "Definitely! There are some great trails nearby that I can show you." },
    { language: "en", "sender": "Woman", "text": "I'm looking forward to it. Let's set a time next week?" },
    { language: "en", "sender": "Man", "text": "Sounds good to me. I'll check my schedule and get back to you." },
    { language: "en", "sender": "Woman", "text": "Great! Talk to you soon then." }
];

let hp_convo = [
    { language: "en", "sender": "Man", "text": "Hermione, have you found anything about the Chamber of Secrets in these old books?"},
    { language: "en", "sender": "Woman", "text": "Not yet, Harry. There are so many books, but very few mention the Chamber."},
    { language: "en", "sender": "Man", "text": "It feels like we're looking for a needle in a haystack."},
    { language: "en", "sender": "Woman", "text": "We can't give up. The Chamber is a part of Hogwarts' history; there has to be something."},
    { language: "en", "sender": "Man", "text": "I just wish we had more clues. Do you think it's really real?"},
    { language: "en", "sender": "Woman", "text": "I believe it is. The attacks on the students must be related."},
    // { language: "en", "sender": "Man", "text": "But who could be behind them?"},
    // { language: "en", "sender": "Woman", "text": "That's what we need to figure out. Oh, look at this old scroll!"},
    // { language: "en", "sender": "Man", "text": "Does it say anything about the Chamber?"},
    // { language: "en", "sender": "Woman", "text": "It mentions a hidden room created by one of the founders. It could be a lead."},
    // { language: "en", "sender": "Man", "text": "That's our best lead yet. We should tell Ron."},
    // { language: "en", "sender": "Woman", "text": "Definitely. Let's find him after we're done here."},
    // { language: "en", "sender": "Man", "text": "Have you noticed anything strange about the attacks, Hermione?"},
    // { language: "en", "sender": "Woman", "text": "Yes, all the victims have been found near water. It's peculiar."},
    // { language: "en", "sender": "Man", "text": "Water... that might be important."},
    // { language: "en", "sender": "Woman", "text": "I'm also trying to understand more about that mysterious voice you heard."},
    // { language: "en", "sender": "Man", "text": "I still can't believe I'm the only one who heard it."},
    // { language: "en", "sender": "Woman", "text": "There must be a reason for that. We'll figure it out, Harry."},
    // { language: "en", "sender": "Man", "text": "Thanks, Hermione. I don't know what I'd do without you and Ron."},
    // { language: "en", "sender": "Woman", "text": "We're a team, Harry. We'll solve this together."}
]


const routes = Router();

routes.get('/', async (req, res) => {

    try {
        // Step 1: Convert each message in the conversation to audio
        const audioBuffers = [];

        // loop through the convo and translate all the message. 
        const conversation = await translateConversation(hp_convo);

        console.log(conversation);

        //loop through the convo 
        for (const message of conversation) {
            const audioBuffer = await convertTextToSpeech(message.text, message.sender === "Man" ? male_voice : female_voice);
            audioBuffers.push(audioBuffer);
        }

        // Step 2: Concatenate all audio buffers into one
        const combinedBuffer = Buffer.concat(audioBuffers);
        const outputFile = '/tmp/combined_conversation.mp3';
        fs.writeFileSync(outputFile, combinedBuffer);

        // Send the combined file to the client
        res.download(outputFile);
        // res.status(200).send('Success');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error processing conversation');
    }
});

async function convertTextToSpeech(text, voice) {
    try {
        const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: "tts-1",
            voice: voice,
            input: text
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        return response.data;
    } catch (error) {
        console.error('Error converting text to speech:', error);
        throw error;
    }
}

async function translateText(text) {
    try {
        // const translationPrompt = `Translate this to ${targetLanguage}: ${text}`;
        const prompt = `Translate this sentence to english from spanish exactly leaving nothing out and adding nothing. Use proper pronunciation.`

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(JSON.stringify(response.data));
        let completion: ChatCompletion = response.data;

        const firstResponse = completion.choices[0].message.content;
        return firstResponse;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}


async function translateConversation(conversation) {
    const translatedConversation = [];

    for (const message of conversation) {
        // Translate the message text to Spanish
        const translatedText = await translateText(message.text);

        // console.log(JSON.stringify(translatedText));
        // Add the original message
        translatedConversation.push(message);

        // Add the translated message
        translatedConversation.push({ sender: message.sender, text: translatedText });
    }

    return translatedConversation;
}

export default routes

