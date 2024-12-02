// server.ts
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { ConnectOptions } from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
const { Configuration, OpenAIApi } = require('openai');
import User from '../backend/src/models/User.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// MongoDB 연결 설정
const mongoUri = process.env.MONGO_URI || '';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
} as ConnectOptions)
    .then(() => console.log("MongoDB 서버와 연결되었습니다"))
    .catch(err => console.error("MongoDB 연결 에러:", err));

// 사용자 인증 미들웨어 추가
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(res.locals.jwtData.id);
        if (!user) {
            return res.status(401).json("사용자가 로그인을 하지 않았거나, 권한이 없습니다.");
        }
        next();
    } catch (error) {
        return res.status(401).json("인증 오류가 발생했습니다.");
    }
};

// Multer 설정
const upload = multer({ dest: 'uploads/' });

// Whisper API를 통해 오디오 파일을 텍스트로 변환하는 함수
async function transcribeAudio(filePath: string) {
    try {
        const fileData = fs.createReadStream(filePath);
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        const response = await openai.createTranscription(fileData, 'whisper-1');
        return response.data.text;
    } catch (error) {
        console.error("오디오 파일 변환 중 에러:", error);
        throw error;
    }
}

// Express 요청에 file 속성 추가
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

// 텍스트 파일 업로드 처리
app.post('/upload-text', upload.single('file'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, (req as MulterRequest).file?.path || '');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        res.json({ message: "텍스트 파일이 업로드되었습니다.", content: fileContent });
    } catch (error) {
        console.error("텍스트 파일 업로드 중 에러:", error);
        res.status(500).send("파일 업로드 실패");
    }
});

// 오디오 파일 업로드 처리
app.post('/upload-audio', upload.single('file'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, (req as MulterRequest).file?.path || '');
        const text = await transcribeAudio(filePath);
        res.json({ message: "오디오 파일이 업로드되었습니다.", content: text });
    } catch (error) {
        console.error("오디오 파일 업로드 중 에러:", error);
        res.status(500).send("파일 업로드 실패");
    }
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port}에서 실행 중`);
});
