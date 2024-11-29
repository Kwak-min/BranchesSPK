import { Request, Response } from 'express';
import Audio from '../models/Audio.js';
import user from '../models/User.js';
import User from '../models/User.js';

// 오디오 파일 업로드
export const uploadAudio = 
async (
  req: Request, 
  res: Response,
  
) => {
  try {
    const { conversationId, userId, message} = req.body;
    const audioBuffer = req.file?.buffer;

    const user = await User.findById(res.locals.jwtData.id)
    if (!User) {
      return res.status(401).json("사용자가 로그인을 하지 않았거나, 권한이 없습니다.")
    }
    if (!audioBuffer || !userId || !conversationId) {
      return res.status(400).json({ error: '올바른 데이터를 제공해 주세요.' });
    }

    const audioDoc = new Audio({
      userId,
      conversationId,
      audioData: audioBuffer,
    });
    await audioDoc.save();

    res.status(201).json({ message: '오디오가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '오디오 저장 중 오류가 발생했습니다.' });
  }
};

// 오디오 파일 가져오기
export const getAudio = async (req: Request, res: Response) => {
  try {
    const audio = await Audio.findById(req.params.id);
    if (!User) {
      return res.status(401).json("사용자가 로그인을 하지 않았거나, 권한이 없습니다.")
    }
    if (!audio) {
      return res.status(404).json({ error: '오디오를 찾을 수 없습니다.' });
    }

    res.set('Content-Type', 'audio/wav');
    res.send(audio.audioData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '오디오 가져오기 중 오류가 발생했습니다.' });
  }
};

// 음성 메시지 전송 엔드포인트 처리
export const handleVoiceMessage = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const audioBuffer = req.file?.buffer;

    if (!User) {
      return res.status(401).json("사용자가 로그인을 하지 않았거나, 권한이 없습니다.")
    }

    if (!audioBuffer || !conversationId) {
      return res.status(400).json({ error: '올바른 데이터를 제공해 주세요.' });
    }

    const audioDoc = new Audio({
      conversationId,
      audioData: audioBuffer,
    });
    await audioDoc.save();

    res.status(201).json({ message: '음성 메시지가 성공적으로 저장되었습니다.', chats: [] });
  } catch (error) {
    console.error('음성 메시지 처리 오류:', error);
    res.status(500).json({ error: '음성 메시지 처리 중 오류가 발생했습니다.' });
  }
};
