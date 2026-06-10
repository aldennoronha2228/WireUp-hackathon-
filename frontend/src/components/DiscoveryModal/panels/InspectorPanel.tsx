import React from "react";
import { Copy, Braces } from "lucide-react";
import toast from "react-hot-toast";

interface InspectorPanelProps {
  selectedLog: any;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({selectedLog,}) => {
    if (!selectedLog) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
          <Braces className="h-10 w-10 text-zinc-600 animate-pulse" />
          <h5 className="text-zinc-400 font-bold">Log Inspector</h5>
          <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
            Select any entry from the execution log feed on the left to inspect its input arguments, database updates, and response outputs.
          </p>
        </div>
      );
    }

    if (selectedLog.type === "code") {
      return (
        <div>
          <div className="flex justify-between items-center text-zinc-500 text-[10px] border-b border-zinc-800 pb-2 mb-3">
            <span>INTEGRATED ARDUINO SKETCH (.INO)</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedLog.text);
                toast.success("Sketch copied to clipboard!");
              }}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
            >
              <Copy className="h-3 w-3" /> Copy Sketch
            </button>
          </div>
          <pre className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-900/60 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed cursor-text select-text">
            <code>{selectedLog.text}</code>
          </pre>
        </div>
      );
    }

    if (selectedLog.type === "thinking") {
      return (
        <div>
          <div className="flex justify-between items-center text-zinc-500 text-[10px] border-b border-zinc-800 pb-2 mb-3">
            <span>AI CHAIN OF THOUGHT</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedLog.text);
                toast.success("Chain of thought copied!");
              }}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans text-xs">
            {selectedLog.text}
          </div>
        </div>
      );
    }

    if (selectedLog.type === "tool_call") {
      return (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2 font-mono flex justify-between items-center">
              <span>Input Parameters</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog.input, null, 2));
                  toast.success("Input arguments copied!");
                }}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors normal-case font-normal"
              >
                <Copy className="h-2.5 w-2.5" /> Copy JSON
              </button>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-blue-300 overflow-x-auto text-[11px]">
              {selectedLog.input ? JSON.stringify(selectedLog.input, null, 2) : "No inputs provided"}
            </pre>
          </div>
          <div>
            <div className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider mb-2 font-mono flex justify-between items-center">
              <span>Output Response</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog.output, null, 2));
                  toast.success("Output response copied!");
                }}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors normal-case font-normal"
              >
                <Copy className="h-2.5 w-2.5" /> Copy JSON
              </button>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-emerald-300 overflow-x-auto text-[11px]">
              {selectedLog.output ? JSON.stringify(selectedLog.output, null, 2) : "Execution in progress..."}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex justify-between items-center text-zinc-550 text-[10px] border-b border-zinc-800 pb-2 mb-3">
          <span>EVENT DETAILS</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(selectedLog.text || JSON.stringify(selectedLog.input || selectedLog.output || {}, null, 2));
              toast.success("Event details copied!");
            }}
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
        <p className="text-zinc-300 leading-relaxed font-sans text-xs">{selectedLog.text}</p>
        {(selectedLog.input || selectedLog.output) && (
          <pre className="bg-zinc-950 p-3 mt-3 rounded-lg border border-zinc-900 text-zinc-400 overflow-x-auto text-[11px]">
            {JSON.stringify(selectedLog.input || selectedLog.output, null, 2)}
          </pre>
        )}
      </div>
    );
  };