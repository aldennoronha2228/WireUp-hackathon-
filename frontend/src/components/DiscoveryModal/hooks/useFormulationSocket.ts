// hooks/useFormulationSocket.ts

import { useEffect, RefObject } from "react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { axiosInstance } from "../../../lib/axios";

interface UseFormulationSocketProps {
  phase: 1 | 2;
  sessionId: string | null;

  shouldAutoFormulate: boolean;
  setShouldAutoFormulate: (value: boolean) => void;

  setLogs: React.Dispatch<React.SetStateAction<any[]>>;
  setBom: (value: any[]) => void;
  setWiring: (value: any[]) => void;
  setMilestones: (value: any[]) => void;

  setFinalSketch: (value: string) => void;

  setIsCompleted: (value: boolean) => void;
  setIsFailed: (value: boolean) => void;

  setCompletedProjectId: (value: string | null) => void;

  setModel: (value: string) => void;

  socketRef: RefObject<Socket | null>;

  getSocketUrl: () => string;
}

export const useFormulationSocket = ({
  phase,
  sessionId,

  shouldAutoFormulate,
  setShouldAutoFormulate,

  setLogs,
  setBom,
  setWiring,
  setMilestones,

  setFinalSketch,

  setIsCompleted,
  setIsFailed,

  setCompletedProjectId,

  setModel,

  socketRef,

  getSocketUrl
}: UseFormulationSocketProps) => {
  useEffect(() => {
    if (phase !== 2 || !sessionId) return;

    const socketUrl = getSocketUrl();

    const socket = io(socketUrl, {
      withCredentials: true
    });

    socketRef.current = socket;

    socket.emit("join", sessionId);

    socket.on("agent2:log", (logItem: any) => {
      setLogs(prev => [...prev, logItem]);
    });

    socket.on("agent2:bom_update", (data: any) => {
      if (data.bom) {
        setBom(data.bom);
      }
    });

    socket.on("agent2:wiring_update", (data: any) => {
      if (data.wiring) {
        setWiring(data.wiring);
      }
    });

    socket.on("agent2:milestone_update", (data: any) => {
      if (data.milestones) {
        setMilestones(data.milestones);
      }
    });

    socket.on("agent2:final_sketch_update", (data: any) => {
      if (data.finalSketch) {
        setFinalSketch(data.finalSketch);
      }
    });

    socket.on("agent2:complete", (data: any) => {
      toast.success("Project formulation complete!");

      setIsCompleted(true);
      setIsFailed(false);

      if (data.projectId) {
        setCompletedProjectId(data.projectId);
      }

      if (data.finalSketch) {
        setFinalSketch(data.finalSketch);
      }
    });

    socket.on("agent2:error", (data: any) => {
      toast.error(
        data.message || "An error occurred during formulation."
      );

      setIsFailed(true);
    });

    socket.on("agent2:resumed", () => {
      toast.success("Formulation resumed!");
      setIsFailed(false);
    });

    socket.on("agent2:model_changed", (data: any) => {
      if (!data.model) return;

      setModel(data.model);

      toast(`Agent failed over to fallback: ${data.model}`);

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as any).webkitAudioContext;

        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();

          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(
            440,
            audioCtx.currentTime
          );

          gainNode.gain.setValueAtTime(
            0.1,
            audioCtx.currentTime
          );

          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.15);
        }
      } catch (err) {
        console.error(
          "[useFormulationSocket] Failed to play failover beep:",
          err
        );
      }
    });

    socket.on("disconnect", () => {
      console.warn(
        "[useFormulationSocket] Socket disconnected."
      );

      setIsFailed(true);
    });

    socket.on("connect_error", () => {
      console.error(
        "[useFormulationSocket] Socket connection error."
      );

      setIsFailed(true);
    });

    const triggerFormulation = async () => {
      if (!shouldAutoFormulate) return;

      setShouldAutoFormulate(false);

      try {
        await axiosInstance.post("/new-flow/formulate", {
          sessionId
        });
      } catch (err) {
        console.error(
          "[useFormulationSocket] Failed to trigger formulation:",
          err
        );

        toast.error(
          "Failed to start automated formulation."
        );
      }
    };

    triggerFormulation();

    return () => {
      socket.disconnect();
    };
  }, [
    phase,
    sessionId,
    shouldAutoFormulate,

    setShouldAutoFormulate,

    setLogs,
    setBom,
    setWiring,
    setMilestones,

    setFinalSketch,

    setIsCompleted,
    setIsFailed,

    setCompletedProjectId,

    setModel,

    socketRef,

    getSocketUrl
  ]);
};