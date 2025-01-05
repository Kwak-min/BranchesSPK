import { OpenAI } from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Node.js용 fetch
import FormData from "form-data"; // Node.js용 FormData
import { configureOpenAI, ModelName } from "../config/openai.js";
import ScenarioModel from "../models/Scenario.js";
dotenv.config();

const openaiConfig = configureOpenAI();
const openai = new OpenAI({
    apiKey: openaiConfig.apiKey,
    organization: openaiConfig.organization,
});

export async function transcribeAudioToText(audioBuffer: Buffer): Promise<string> {
    try {
        if (!audioBuffer) {
            throw new Error("No audio data provided");
        }
        // Buffer로 변환 (Node.js 환경)
        const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

        // FormData 생성
        const formData = new FormData();
        formData.append("file", buffer, { filename: "audio.wav", contentType: "audio/wav" });
        formData.append("model", "whisper-1");

        // Whisper API 호출
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openaiConfig.apiKey}`,
                ...formData.getHeaders(), // FormData 헤더 추가
            },
            body: formData, // FormData 전달
        });

        // 응답 확인
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Whisper API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result.text; // 변환된 텍스트 반환
    } catch (error) {
        console.error("[ERROR] Error in transcription:", error.message);
        throw new Error("Failed to process audio");
    }
}

export async function generateSpeechFromText(text: string): Promise<Buffer> {
    try {
        // TTS API 호출
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy", // 음성 선택
            input: text,
        });

        // MP3 데이터를 Buffer로 변환
        const buffer = Buffer.from(await mp3.arrayBuffer());
        return buffer; // Buffer 반환
    } catch (error) {
        console.error("Error generating speech:", error.message);
        throw new Error("Error converting text to speech");
    }
}

interface GenerateResponseOptions {
    scenarioName?: string | null;
    selectedRole?: string | null;
    difficulty?: number | null;
}

export async function generateFineTunedResponse(userText: string, options: GenerateResponseOptions = {}): Promise<{ text: string }> {
    const { scenarioName = null, selectedRole = null, difficulty = null } = options;
    try {
        if (!userText) {
            throw new Error("User text is missing");
        }

        let systemMessage: string;
        let fineTunedModel: string = ModelName; // 기본 모델 설정

        if (scenarioName) {
            const scenario = await ScenarioModel.findOne({ scenarioName });
            if (!scenario) {
                throw new Error(`Scenario with name '${scenarioName}' not found.`);
            }

            const { fineTunedModel: scenarioModel, roles } = scenario;

            if (selectedRole && !roles.includes(selectedRole)) {
                throw new Error(`Invalid role '${selectedRole}'. Available roles: ${roles.join(", ")}.`);
            }

            const difficultyMessage = difficulty
                ? `Please provide a response suitable for difficulty level ${difficulty} (1~3).`
                : "";

            systemMessage = `You are a ${selectedRole || "guide"} in the ${scenarioName} scenario. ${difficultyMessage}`;
            fineTunedModel = scenarioModel || ModelName;
        } else {
            systemMessage =
                "You are an English learning assistant. Your job is to help the user improve their English skills by providing explanations, correcting grammar, and answering questions about English language learning.";
        }

        // OpenAI GPT 모델 호출
        const completion = await openai.chat.completions.create({
            model: fineTunedModel,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userText },
            ],
        });

        if (!completion || !completion.choices || !completion.choices[0]) {
            throw new Error("GPT response is empty");
        }

        const responseText = completion.choices[0].message.content.trim();
        return { text: responseText };
    } catch (error) {
        console.error("Error in generateFineTunedResponse:", error.message);
        throw new Error("Error generating response");
    }
}