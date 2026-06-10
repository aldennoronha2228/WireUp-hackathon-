// hooks/useSessionRestore.ts

import { useEffect } from "react";
import toast from "react-hot-toast";
import { axiosInstance } from "../../../lib/axios";

interface UseSessionRestoreProps {
  projectId?: string;
  initialIdea?: string;
  initialPhase?: 1 | 2;

  onClose: () => void;

  setLoading: (v: boolean) => void;
  setSessionId: (v: string | null) => void;

  setQuestion: (v: string) => void;
  setOptions: (v: string[]) => void;
  setContext: (v: any) => void;

  setBom: (v: any[]) => void;
  setWiring: (v: any[]) => void;
  setMilestones: (v: any[]) => void;
  setLogs: (v: any[]) => void;

  setStarted: (v: boolean) => void;
  setPhase: (v: 1 | 2) => void;
  setShouldAutoFormulate: (v: boolean) => void;

  setIsCompleted: (v: boolean) => void;
  setCompletedProjectId: (v: string | null) => void;
  setFinalSketch: (v: string) => void;
}

export const useSessionRestore = ({
  projectId,
  initialIdea,
  initialPhase,

  onClose,

  setLoading,
  setSessionId,

  setQuestion,
  setOptions,
  setContext,

  setBom,
  setWiring,
  setMilestones,
  setLogs,

  setStarted,
  setPhase,
  setShouldAutoFormulate,

  setIsCompleted,
  setCompletedProjectId,
  setFinalSketch
}: UseSessionRestoreProps) => {
  useEffect(() => {
    const startSession = async () => {
      setLoading(true);

      try {
        if (projectId) {
          const res = await axiosInstance.get(
            `/new-flow/project-session/${projectId}`
          );

          setSessionId(res.data._id);
          setQuestion(res.data.question || "");
          setOptions(res.data.options || []);
          setContext(res.data.context || {});
          setBom(res.data.bom || []);
          setWiring(res.data.wiring || []);
          setMilestones(res.data.milestones || []);
          setLogs(res.data.agentLog || []);
          setStarted(true);

          if (res.data.phase2Complete) {
            setIsCompleted(true);
            setCompletedProjectId(projectId);
            setPhase(2);
            setShouldAutoFormulate(false);
            return;
          }

          if (initialPhase) {
            setPhase(initialPhase);

            setShouldAutoFormulate(
              initialPhase === 2 &&
              (!res.data.agentLog || res.data.agentLog.length === 0)
            );
          } else {
            const nextPhase: 1 | 2 =
              res.data.phase1Complete ? 2 : 1;

            setPhase(nextPhase);

            setShouldAutoFormulate(
              nextPhase === 2 &&
              (!res.data.agentLog || res.data.agentLog.length === 0)
            );
          }

          return;
        }

        const cachedSessionId = localStorage.getItem(
          "wireup_discovery_session_id"
        );

        if (cachedSessionId) {
          try {
            const res = await axiosInstance.get(
              `/new-flow/session/${cachedSessionId}`
            );

            const ideaMatch =
              res.data.idea?.trim().toLowerCase() ===
              initialIdea?.trim().toLowerCase();

            if (ideaMatch) {
              setSessionId(res.data._id);
              setQuestion(res.data.question || "");
              setOptions(res.data.options || []);
              setContext(res.data.context || {});
              setBom(res.data.bom || []);
              setWiring(res.data.wiring || []);
              setMilestones(res.data.milestones || []);
              setLogs(res.data.agentLog || []);

              if (res.data.finalSketch) {
                setFinalSketch(res.data.finalSketch);
              }

              setStarted(true);

              if (res.data.phase2Complete) {
                setIsCompleted(true);
                setPhase(2);
                setShouldAutoFormulate(false);

                if (res.data.projectId) {
                  setCompletedProjectId(res.data.projectId);
                }

                return;
              }

              const nextPhase: 1 | 2 =
                res.data.phase1Complete ? 2 : 1;

              setPhase(nextPhase);

              setShouldAutoFormulate(
                nextPhase === 2 &&
                (!res.data.agentLog || res.data.agentLog.length === 0)
              );

              return;
            }
          } catch (err) {
            console.error(
              "Failed to restore cached session:",
              err
            );

            localStorage.removeItem(
              "wireup_discovery_session_id"
            );
          }
        }

        setStarted(false);
      } catch (err) {
        toast.error("Failed to initiate agent session.");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    startSession();
  }, [projectId]);
};