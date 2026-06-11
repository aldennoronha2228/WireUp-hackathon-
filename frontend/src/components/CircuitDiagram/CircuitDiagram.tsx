/**
 * WireUp Circuit Diagram — React Flow based
 * Matches the reference: dark dot-grid canvas, IC-style component cards,
 * colored wire connections, pin dots, zoom/pan/drag.
 */

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background, Controls, MiniMap,
  Handle, Position,
  type NodeTypes, type Node, type Edge,
  BackgroundVariant,
  useNodesState, useEdgesState,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

/* ── Colors ──────────────────────────────────────────────────────────────── */
const C = {
  bg:      "#0a0a0f",
  card:    "#1a1c26",
  cardBdr: "#2e3048",
  mcu:     "#f0f0f5",
  mcuBdr:  "#3c4060",
  text:    "#e2e8f0",
  textDim: "#8888a8",
  pin:     "#4fc1ff",
  vcc:     "#ef4444",   // red — 5V
  v33:     "#f97316",   // orange — 3.3V
  gnd:     "#6b7280",   // grey — GND
  data:    "#3b82f6",   // blue — data lines
  i2c:     "#8b5cf6",   // purple — I2C
  uart:    "#f59e0b",   // amber — UART
  spi:     "#10b981",   // green — SPI
  pwm:     "#ec4899",   // pink — PWM
};

/* ── Wire color by signal type ───────────────────────────────────────────── */
function wireColor(signal: string): string {
  const s = signal.toLowerCase();
  if (s.includes("vcc") || s.includes("5v") || s.includes("power")) return C.vcc;
  if (s.includes("3.3") || s.includes("3v3")) return C.v33;
  if (s.includes("gnd") || s.includes("ground")) return C.gnd;
  if (s.includes("sda") || s.includes("scl") || s.includes("i2c")) return C.i2c;
  if (s.includes("tx") || s.includes("rx") || s.includes("uart")) return C.uart;
  if (s.includes("mosi") || s.includes("miso") || s.includes("sck") || s.includes("spi")) return C.spi;
  if (s.includes("pwm")) return C.pwm;
  return C.data;
}

/* ── MCU Node (Arduino Uno / ESP32 style with pin list) ─────────────────── */
function MCUNode({ data }: { data: any }) {
  const leftPins: string[]  = data.leftPins  || [];
  const rightPins: string[] = data.rightPins || [];
  const allPins = [...leftPins, ...rightPins];
  const rows = Math.max(leftPins.length, rightPins.length);

  return (
    <div style={{
      background: C.card,
      border: `1.5px solid ${C.mcuBdr}`,
      borderRadius: 10,
      minWidth: 200,
      fontFamily: "var(--font-sans)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "8px 14px 6px", borderBottom: `1px solid ${C.mcuBdr}`,
        background: "rgba(255,255,255,0.04)" }}>
        <p style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
          BOARD
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 3,
            background: "linear-gradient(135deg,#00979d,#007acc)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-8h2v5h-2zm0-4h2v2h-2z"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data.label}</span>
        </div>
      </div>

      {/* Power banner */}
      <div style={{ padding: "6px 14px", background: "rgba(34,197,94,0.08)",
        borderBottom: `1px solid rgba(34,197,94,0.2)`, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }}/>
        <span style={{ fontSize: 10, color: "#22c55e" }}>Powered via USB</span>
      </div>

      {/* Power pins */}
      <div style={{ padding: "8px 0" }}>
        {[{label:"5V",color:C.vcc,id:"5v"},{label:"3V3",color:C.v33,id:"3v3"},{label:"GND",color:C.gnd,id:"gnd"}].map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "3px 14px",
            justifyContent: "space-between", position: "relative" }}>
            <Handle type="source" position={Position.Left} id={`left-${p.id}`}
              style={{ left: -4, background: p.color, width: 8, height: 8, border: "none" }}/>
            <span style={{ fontSize: 11, color: p.color, fontWeight: 500 }}>{p.label}</span>
            <Handle type="source" position={Position.Right} id={`right-${p.id}`}
              style={{ right: -4, background: p.color, width: 8, height: 8, border: "none" }}/>
          </div>
        ))}
      </div>

      {/* GPIO pins */}
      <div style={{ borderTop: `1px solid ${C.mcuBdr}`, padding: "6px 0 8px" }}>
        <p style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em",
          textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>GPIO Pins</p>
        {Array.from({ length: rows }).map((_, i) => {
          const lp = leftPins[i];
          const rp = rightPins[i];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center",
              padding: "2px 14px", justifyContent: "space-between", position: "relative" }}>
              {lp && (
                <>
                  <Handle type="source" position={Position.Left} id={`l-${lp}`}
                    style={{ left: -4, background: C.pin, width: 7, height: 7, border: "none" }}/>
                  <span style={{ fontSize: 10, color: C.textDim }}>{lp}</span>
                </>
              )}
              {!lp && <span/>}
              {rp && (
                <>
                  <span style={{ fontSize: 10, color: C.textDim }}>{rp}</span>
                  <Handle type="source" position={Position.Right} id={`r-${rp}`}
                    style={{ right: -4, background: C.pin, width: 7, height: 7, border: "none" }}/>
                </>
              )}
              {!rp && <span/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sensor/Component Node ───────────────────────────────────────────────── */
function ComponentNode({ data }: { data: any }) {
  const pins: Array<{ id: string; label: string; signal: string }> = data.pins || [];

  return (
    <div style={{
      background: data.color ? `${data.color}12` : "#1a1c26",
      border: `1.5px solid ${data.color || C.cardBdr}`,
      borderRadius: 8,
      minWidth: 160,
      fontFamily: "var(--font-sans)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 14px 8px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>
          {data.label}
        </p>
        <p style={{ fontSize: 10, color: C.textDim, lineHeight: 1.4 }}>
          {data.description}
        </p>
      </div>

      {/* Pins */}
      <div style={{ borderTop: `1px solid ${data.color || C.cardBdr}22`, padding: "6px 0 8px" }}>
        {pins.map(pin => {
          const col = wireColor(pin.signal);
          return (
            <div key={pin.id} style={{ display: "flex", alignItems: "center",
              justifyContent: "flex-end", padding: "3px 14px", position: "relative" }}>
              <span style={{ fontSize: 11, color: C.textDim, marginRight: 6 }}>{pin.label}</span>
              <Handle type="source" position={Position.Right} id={pin.id}
                style={{ right: -4, background: col, width: 8, height: 8, border: "none" }}/>
              <Handle type="target" position={Position.Right} id={`t-${pin.id}`}
                style={{ right: -4, background: col, width: 8, height: 8, border: "none", opacity: 0 }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { mcu: MCUNode, component: ComponentNode };

/* ── Build nodes & edges from project description ────────────────────────── */
function buildDiagram(desc: string): { nodes: Node[]; edges: Edge[] } {
  const lower = desc.toLowerCase();
  const isESP32 = lower.includes("esp32");
  const mcuName = isESP32 ? "ESP32 DevKit" : "Arduino Uno";

  // MCU node — center-right
  const mcuNode: Node = {
    id: "mcu",
    type: "mcu",
    position: { x: 380, y: 80 },
    data: {
      label: mcuName,
      leftPins:  isESP32
        ? ["D0","D2","D4","D5","D12","D13","A0","A2","A4"]
        : ["D0","D2","D4","D6","D8","D10","D12","A0","A2","A4"],
      rightPins: isESP32
        ? ["D1","D3","TX","RX","SDA","SCL","D14","A1","A3","A5"]
        : ["D1","D3","D5","D7","D9","D11","D13","A1","A3","A5"],
    },
  };

  const nodes: Node[] = [mcuNode];
  const edges: Edge[] = [];

  // ── DHT22 / temperature sensor ────────────────────────────────────────
  if (lower.match(/temp|humidity|dht|weather|climate/)) {
    nodes.push({
      id: "dht22", type: "component", position: { x: 60, y: 180 },
      data: {
        label: "DHT22",
        description: "Digital temperature and humidity sensor",
        color: "#3ecf8e",
        pins: [
          { id:"vcc",  label:"VCC",  signal:"VCC"  },
          { id:"gnd",  label:"GND",  signal:"GND"  },
          { id:"data", label:"DATA", signal:"data" },
        ],
      },
    });
    edges.push(
      { id:"e-dht-vcc",  source:"dht22", sourceHandle:"vcc",  target:"mcu", targetHandle:"right-5v",  animated:false, style:{ stroke:C.vcc,  strokeWidth:2 }, label:"5V"  },
      { id:"e-dht-gnd",  source:"dht22", sourceHandle:"gnd",  target:"mcu", targetHandle:"right-gnd", animated:false, style:{ stroke:C.gnd,  strokeWidth:2 }, label:"GND" },
      { id:"e-dht-data", source:"dht22", sourceHandle:"data", target:"mcu", targetHandle:"l-D4",      animated:false, style:{ stroke:C.data, strokeWidth:2 }, label:"D4"  },
    );
  }

  // ── OLED Display ─────────────────────────────────────────────────────
  if (lower.match(/oled|display|screen/)) {
    nodes.push({
      id: "oled", type: "component", position: { x: 60, y: 380 },
      data: {
        label: "OLED 128×64",
        description: "I²C monochrome display",
        color: "#4fc1ff",
        pins: [
          { id:"vcc", label:"VCC", signal:"VCC"  },
          { id:"gnd", label:"GND", signal:"GND"  },
          { id:"sda", label:"SDA", signal:"SDA"  },
          { id:"scl", label:"SCL", signal:"SCL"  },
        ],
      },
    });
    edges.push(
      { id:"e-ol-vcc", source:"oled", sourceHandle:"vcc", target:"mcu", targetHandle:"right-5v",   style:{ stroke:C.vcc, strokeWidth:2 } },
      { id:"e-ol-gnd", source:"oled", sourceHandle:"gnd", target:"mcu", targetHandle:"right-gnd",  style:{ stroke:C.gnd, strokeWidth:2 } },
      { id:"e-ol-sda", source:"oled", sourceHandle:"sda", target:"mcu", targetHandle:"r-SDA",       style:{ stroke:C.i2c, strokeWidth:2 }, label:"SDA" },
      { id:"e-ol-scl", source:"oled", sourceHandle:"scl", target:"mcu", targetHandle:"r-SCL",       style:{ stroke:C.i2c, strokeWidth:2 }, label:"SCL" },
    );
  }

  // ── Relay ─────────────────────────────────────────────────────────────
  if (lower.match(/relay/)) {
    nodes.push({
      id: "relay", type: "component", position: { x: 60, y: 560 },
      data: {
        label: "Relay Module",
        description: "5V single channel relay",
        color: "#ef4444",
        pins: [
          { id:"vcc", label:"VCC", signal:"VCC"  },
          { id:"gnd", label:"GND", signal:"GND"  },
          { id:"in",  label:"IN",  signal:"data" },
        ],
      },
    });
    edges.push(
      { id:"e-rl-vcc", source:"relay", sourceHandle:"vcc", target:"mcu", targetHandle:"right-5v",  style:{ stroke:C.vcc,  strokeWidth:2 } },
      { id:"e-rl-gnd", source:"relay", sourceHandle:"gnd", target:"mcu", targetHandle:"right-gnd", style:{ stroke:C.gnd,  strokeWidth:2 } },
      { id:"e-rl-in",  source:"relay", sourceHandle:"in",  target:"mcu", targetHandle:"l-D5",      style:{ stroke:C.data, strokeWidth:2 }, label:"D5" },
    );
  }

  // ── Servo ─────────────────────────────────────────────────────────────
  if (lower.match(/servo|arm|robot/)) {
    nodes.push({
      id: "servo", type: "component", position: { x: 60, y: 560 },
      data: {
        label: "Servo Motor",
        description: isESP32 ? "SG90 servo via ESP32 PWM" : "SG90 servo via PWM",
        color: "#f59e0b",
        pins: [
          { id:"vcc",    label:"VCC (Red)",    signal:"VCC"  },
          { id:"gnd",    label:"GND (Brown)",  signal:"GND"  },
          { id:"signal", label:"Signal (Yellow)", signal:"pwm" },
        ],
      },
    });
    edges.push(
      { id:"e-sv-vcc", source:"servo", sourceHandle:"vcc",    target:"mcu", targetHandle:"right-5v",  style:{ stroke:C.vcc,  strokeWidth:2 } },
      { id:"e-sv-gnd", source:"servo", sourceHandle:"gnd",    target:"mcu", targetHandle:"right-gnd", style:{ stroke:C.gnd,  strokeWidth:2 } },
      { id:"e-sv-sig", source:"servo", sourceHandle:"signal", target:"mcu", targetHandle:"l-D9",      style:{ stroke:C.pwm,  strokeWidth:2 }, label:"D9 PWM" },
    );
  }

  // ── BMP280 pressure sensor ────────────────────────────────────────────
  if (lower.match(/bmp|pressure|altitude/)) {
    nodes.push({
      id: "bmp280", type: "component", position: { x: 60, y: 560 },
      data: {
        label: "BMP280",
        description: "Pressure & altitude sensor",
        color: "#f97316",
        pins: [
          { id:"vcc", label:"VCC", signal:"VCC" },
          { id:"gnd", label:"GND", signal:"GND" },
          { id:"sda", label:"SDA", signal:"SDA" },
          { id:"scl", label:"SCL", signal:"SCL" },
        ],
      },
    });
    edges.push(
      { id:"e-bm-vcc", source:"bmp280", sourceHandle:"vcc", target:"mcu", targetHandle:"right-5v",  style:{ stroke:C.vcc, strokeWidth:2 } },
      { id:"e-bm-gnd", source:"bmp280", sourceHandle:"gnd", target:"mcu", targetHandle:"right-gnd", style:{ stroke:C.gnd, strokeWidth:2 } },
      { id:"e-bm-sda", source:"bmp280", sourceHandle:"sda", target:"mcu", targetHandle:"r-SDA",      style:{ stroke:C.i2c, strokeWidth:2 }, label:"SDA" },
      { id:"e-bm-scl", source:"bmp280", sourceHandle:"scl", target:"mcu", targetHandle:"r-SCL",      style:{ stroke:C.i2c, strokeWidth:2 }, label:"SCL" },
    );
  }

  // ── Ultrasonic HC-SR04 ────────────────────────────────────────────────
  if (lower.match(/ultrasonic|hcsr|distance|proximity/)) {
    nodes.push({
      id: "hcsr04", type: "component", position: { x: 60, y: 380 },
      data: {
        label: "HC-SR04",
        description: "Ultrasonic distance sensor",
        color: "#8b5cf6",
        pins: [
          { id:"vcc",   label:"VCC",     signal:"VCC"  },
          { id:"gnd",   label:"GND",     signal:"GND"  },
          { id:"trig",  label:"TRIG",    signal:"data" },
          { id:"echo",  label:"ECHO",    signal:"data" },
        ],
      },
    });
    edges.push(
      { id:"e-hc-vcc",  source:"hcsr04", sourceHandle:"vcc",  target:"mcu", targetHandle:"right-5v",  style:{ stroke:C.vcc,  strokeWidth:2 } },
      { id:"e-hc-gnd",  source:"hcsr04", sourceHandle:"gnd",  target:"mcu", targetHandle:"right-gnd", style:{ stroke:C.gnd,  strokeWidth:2 } },
      { id:"e-hc-trig", source:"hcsr04", sourceHandle:"trig", target:"mcu", targetHandle:"l-D6",      style:{ stroke:C.data, strokeWidth:2 }, label:"D6 TRIG" },
      { id:"e-hc-echo", source:"hcsr04", sourceHandle:"echo", target:"mcu", targetHandle:"l-D7",      style:{ stroke:C.data, strokeWidth:2 }, label:"D7 ECHO" },
    );
  }

  return { nodes, edges };
}

/* ── Main component ──────────────────────────────────────────────────────── */
function DiagramInner({ projectDescription }: { projectDescription: string }) {
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildDiagram(projectDescription),
    [projectDescription]
  );

  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header bar */}
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12, background: "#0d0d14",
        borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0",
          fontFamily: "var(--font-sans)" }}>
          Wiring diagram
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "4px 10px", background: "#1a1c26",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 3,
            background: "linear-gradient(135deg,#00979d,#007acc)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" fill="white" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16z"/>
            </svg>
          </div>
          <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "var(--font-sans)" }}>
            {projectDescription.toLowerCase().includes("esp32") ? "ESP32 DevKit" : "Arduino Uno"}
          </span>
          <svg width="10" height="10" fill="none" viewBox="0 0 16 16"
            stroke="rgba(255,255,255,0.4)" strokeWidth={2}>
            <path strokeLinecap="round" d="M4 6l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            labelStyle: { fill: "#9ea3b0", fontSize: 10, fontFamily: "var(--font-mono)" },
            labelBgStyle: { fill: "#0a0a0f", fillOpacity: 0.85 },
            labelBgPadding: [4, 3],
            labelBgBorderRadius: 3,
          }}
          style={{ background: C.bg }}
          proOptions={{ hideAttribution: false }}>
          <Background
            variant={BackgroundVariant.Dots}
            gap={20} size={1}
            color="rgba(255,255,255,0.06)"
          />
          <Controls
            style={{
              background: "#1a1c26",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              gap: 2,
            }}
          />
          <MiniMap
            style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.08)" }}
            nodeColor={() => "#3b82f6"}
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

/* ── Export (wrapped in provider) ────────────────────────────────────────── */
export function CircuitDiagram({ projectDescription, pipelineDone }: {
  projectDescription: string;
  pipelineDone: boolean;
}) {
  if (!pipelineDone) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
        background: C.bg }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#007acc",
          animation: "spin 0.8s linear infinite" }}/>
        <p style={{ fontSize: 12, color: "#6e7280", fontFamily: "var(--font-sans)" }}>
          Circuit diagram generating…
        </p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <DiagramInner projectDescription={projectDescription}/>
    </ReactFlowProvider>
  );
}
