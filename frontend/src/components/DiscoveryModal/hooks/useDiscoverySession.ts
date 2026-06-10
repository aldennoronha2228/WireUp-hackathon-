// hooks/useDiscoverySession.ts

import { useEffect } from "react";
import { axiosInstance } from "../../../lib/axios";

interface UseDiscoverySessionProps {
  sessionId: string | null;
  phase: 1 | 2;
  isCompleted: boolean;

  setIsCompleted: (value: boolean) => void;
  setIsFailed: (value: boolean) => void;
  setCompletedProjectId: (value: string | null) => void;

  setBom: (value: any[]) => void;
  setWiring: (value: any[]) => void;
  setMilestones: (value: any[]) => void;
  setLogs: (value: any[]) => void;
  setFinalSketch: (value: string) => void;
}

export const useDiscoverySession = ({
  sessionId,
  phase,
  isCompleted,

  setIsCompleted,
  setIsFailed,
  setCompletedProjectId,

  setBom,
  setWiring,
  setMilestones,
  setLogs,
  setFinalSketch
}: UseDiscoverySessionProps) => {
  useEffect(() => {
    if (!sessionId || isCompleted || phase !== 2) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(
          `/new-flow/session/${sessionId}`
        );

        if (res.data.phase2Complete) {
          setIsCompleted(true);
          setIsFailed(false);

          if (res.data.projectId) {
            setCompletedProjectId(res.data.projectId);
          }

          if (res.data.bom) {
            setBom(res.data.bom);
          }

          if (res.data.wiring) {
            setWiring(res.data.wiring);
          }

          if (res.data.milestones) {
            setMilestones(res.data.milestones);
          }

          if (res.data.agentLog) {
            setLogs(res.data.agentLog);
          }

          if (res.data.finalSketch) {
            setFinalSketch(res.data.finalSketch);
          }

          clearInterval(interval);
        } else {
          if (res.data.finalSketch) {
            setFinalSketch(res.data.finalSketch);
          }

          if (res.data.bom) {
            setBom(res.data.bom);
          }

          if (res.data.wiring) {
            setWiring(res.data.wiring);
          }

          if (res.data.milestones) {
            setMilestones(res.data.milestones);
          }

          if (res.data.agentLog) {
            setLogs(res.data.agentLog);
          }
        }
      } catch (err) {
        console.error(
          "[useDiscoverySession] Polling failed:",
          err
        );
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    sessionId,
    phase,
    isCompleted,

    setIsCompleted,
    setIsFailed,
    setCompletedProjectId,

    setBom,
    setWiring,
    setMilestones,
    setLogs,
    setFinalSketch
  ]);
};