/**
 * Shared Whisper STT mic recorder hook.
 * Used by both HomePage and AIReasoningPanel.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

export function useMicRecorder(onTranscript: (text: string) => void) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const streamRef    = useRef<MediaStream | null>(null);
  const contextRef   = useRef<AudioContext | null>(null);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);

  /* Send recorded blob to backend Whisper STT */
  const sendToWhisper = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const arrayBuf = await blob.arrayBuffer();
      const bytes    = new Uint8Array(arrayBuf);
      let   binary   = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64   = btoa(binary);
      const mimeType = blob.type || "audio/webm";
      const ext      = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";

      const { axiosInstance } = await import("../lib/axios");
      const { data } = await axiosInstance.post("/voice/stt/whisper", {
        audioBase64: base64,
        mimeType,
        filename: `recording.${ext}`,
      });

      if (data.transcript) {
        onTranscript(data.transcript);
      } else {
        toast.error("No speech detected. Try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Transcription failed";
      toast.error(msg);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize              = 1024;
      analyser.smoothingTimeConstant= 0;
      analyser.minDecibels          = -85;
      analyser.maxDecibels          = -10;
      ctx.createMediaStreamSource(stream).connect(analyser);
      contextRef.current = ctx;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        sendToWhisper(blob);
      };
      recorder.start();
      mediaRecRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied.");
    }
  }, [sendToWhisper]);

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    contextRef.current?.close();
    streamRef.current    = null;
    contextRef.current   = null;
    mediaRecRef.current  = null;
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    isRecording ? stopRecording() : startRecording();
  }, [isRecording, startRecording, stopRecording]);

  /* Cleanup on unmount */
  useEffect(() => () => { stopRecording(); }, [stopRecording]);

  return { isRecording, isTranscribing, toggleRecording };
}
