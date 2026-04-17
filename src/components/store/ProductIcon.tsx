"use client";

import type { ProductCategory } from "@/lib/store-products";

const accentColors: Record<ProductCategory, string> = {
  service: "#00fff5",
  digital: "#ff00ff",
  physical: "#00ff41",
};

function CloudAuditIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      {/* Dashed orbit ring */}
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Cloud shape */}
      <rect
        x="72"
        y="78"
        width="56"
        height="30"
        rx="15"
        fill={color}
        fillOpacity="0.1"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      {/* Nodes inside cloud */}
      <circle cx="88" cy="90" r="4" fill={color} fillOpacity="0.8" />
      <circle cx="100" cy="86" r="3" fill={color} fillOpacity="0.5" />
      <circle cx="112" cy="93" r="3.5" fill={color} fillOpacity="0.6" />
      <line
        x1="92"
        y1="90"
        x2="100"
        y2="86"
        stroke={color}
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <line
        x1="100"
        y1="86"
        x2="112"
        y2="93"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Magnifier */}
      <circle
        cx="135"
        cy="80"
        r="10"
        fill="none"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <line
        x1="142"
        y1="87"
        x2="150"
        y2="95"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      {/* Corner brackets */}
      <path
        d="M55 55 h12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M55 55 v12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 h-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 v-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Orbiting dots */}
      <circle cx="60" cy="80" r="3" fill={color} fillOpacity="0.2" />
      <circle cx="75" cy="55" r="2.5" fill={color} fillOpacity="0.3" />
      <circle cx="130" cy="55" r="2" fill={color} fillOpacity="0.25" />
      <circle cx="145" cy="110" r="3" fill={color} fillOpacity="0.15" />
      <circle cx="65" cy="120" r="2.5" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function LambdaIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Lambda */}
      <text
        x="88"
        y="110"
        fontFamily="serif"
        fontSize="52"
        fill={color}
        fillOpacity="0.85"
        fontWeight="bold"
      >
        λ
      </text>
      {/* Brackets */}
      <text
        x="62"
        y="105"
        fontFamily="monospace"
        fontSize="28"
        fill={color}
        fillOpacity="0.25"
      >
        {"{"}
      </text>
      <text
        x="128"
        y="105"
        fontFamily="monospace"
        fontSize="28"
        fill={color}
        fillOpacity="0.25"
      >
        {"}"}
      </text>
      {/* Deploy arrow */}
      <line
        x1="72"
        y1="135"
        x2="128"
        y2="135"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <polygon
        points="128,135 122,131 122,139"
        fill={color}
        fillOpacity="0.4"
      />
      {/* Corner brackets */}
      <path
        d="M55 55 h12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M55 55 v12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 h-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 v-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Orbiting dots */}
      <circle cx="55" cy="95" r="3" fill={color} fillOpacity="0.2" />
      <circle cx="100" cy="48" r="2.5" fill={color} fillOpacity="0.3" />
      <circle cx="148" cy="80" r="2" fill={color} fillOpacity="0.2" />
      <circle cx="140" cy="115" r="3" fill={color} fillOpacity="0.15" />
      <circle cx="60" cy="125" r="2.5" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function AnalyticsIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Bar chart */}
      {[30, 50, 35, 55, 42].map((h, i) => (
        <rect
          key={i}
          x={72 + i * 12}
          y={115 - h}
          width={9}
          height={h}
          rx="2"
          fill={color}
          fillOpacity={0.12 + i * 0.08}
          stroke={color}
          strokeOpacity="0.35"
          strokeWidth="0.75"
        />
      ))}
      {/* Trend line */}
      <polyline
        points="76,100 88,85 100,92 112,72 124,78"
        fill="none"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <circle cx="124" cy="78" r="4" fill={color} fillOpacity="0.7" />
      {/* Corner brackets */}
      <path
        d="M55 55 h12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M55 55 v12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 h-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 v-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="60" cy="78" r="3" fill={color} fillOpacity="0.2" />
      <circle cx="140" cy="65" r="2.5" fill={color} fillOpacity="0.25" />
      <circle cx="145" cy="110" r="2" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function AIGrowthIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Neural network nodes */}
      {[
        [80, 70],
        [120, 70],
        [65, 95],
        [100, 95],
        [135, 95],
        [80, 120],
        [120, 120],
      ].map(([x, y], i) => (
        <circle
          key={`n${i}`}
          cx={x}
          cy={y}
          r={i === 3 ? 6 : 4}
          fill={color}
          fillOpacity={i === 3 ? 0.7 : 0.3 + (i % 3) * 0.1}
        />
      ))}
      {/* Connections */}
      <line
        x1="80"
        y1="70"
        x2="100"
        y2="95"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="120"
        y1="70"
        x2="100"
        y2="95"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="65"
        y1="95"
        x2="100"
        y2="95"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="100"
        y1="95"
        x2="135"
        y2="95"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="100"
        y1="95"
        x2="80"
        y2="120"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="100"
        y1="95"
        x2="120"
        y2="120"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1="80"
        y1="70"
        x2="65"
        y2="95"
        stroke={color}
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <line
        x1="120"
        y1="70"
        x2="135"
        y2="95"
        stroke={color}
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <line
        x1="65"
        y1="95"
        x2="80"
        y2="120"
        stroke={color}
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <line
        x1="135"
        y1="95"
        x2="120"
        y2="120"
        stroke={color}
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      {/* Sparkle */}
      <text x="138" y="65" fontSize="14" fill={color} fillOpacity="0.5">
        &#x2726;
      </text>
      {/* Corner brackets */}
      <path
        d="M55 55 h12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M55 55 v12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 h-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M145 135 v-12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function PlaybookIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Book */}
      <rect
        x="78"
        y="68"
        width="44"
        height="56"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      {/* Spine */}
      <line
        x1="86"
        y1="68"
        x2="86"
        y2="124"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      {/* Text lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="92"
          y1={78 + i * 10}
          x2={108 + (i % 2) * 8}
          y2={78 + i * 10}
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="1.5"
        />
      ))}
      {/* Migration arrow */}
      <text
        x="128"
        y="98"
        fontSize="20"
        fill={color}
        fillOpacity="0.5"
        fontWeight="bold"
      >
        &rarr;
      </text>
      {/* Cloud target */}
      <circle
        cx="148"
        cy="105"
        r="8"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Binary decoration */}
      {["1", "0", "1", "1", "0", "1"].map((b, i) => (
        <text
          key={i}
          x="145"
          y={68 + i * 8}
          fontSize="7"
          fill={color}
          fillOpacity="0.2"
          fontFamily="monospace"
        >
          {b}
        </text>
      ))}
      {/* Corner brackets */}
      <path
        d="M55 55 h12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M55 55 v12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function DashboardTemplatesIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Dashboard grid cells */}
      <rect
        x="70"
        y="68"
        width="28"
        height="20"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="102"
        y="68"
        width="28"
        height="20"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="70"
        y="92"
        width="60"
        height="24"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="70"
        y="120"
        width="18"
        height="12"
        rx="2"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="92"
        y="120"
        width="18"
        height="12"
        rx="2"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="114"
        y="120"
        width="16"
        height="12"
        rx="2"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Mini chart in main cell */}
      <polyline
        points="75,110 85,104 95,108 108,98 120,102 125,100"
        fill="none"
        stroke={color}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* Binary */}
      {["1", "0", "1", "0", "1", "1"].map((b, i) => (
        <text
          key={i}
          x="140"
          y={72 + i * 8}
          fontSize="7"
          fill={color}
          fillOpacity="0.2"
          fontFamily="monospace"
        >
          {b}
        </text>
      ))}
    </svg>
  );
}

function MasterclassIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Video player frame */}
      <rect
        x="68"
        y="72"
        width="64"
        height="44"
        rx="4"
        fill={color}
        fillOpacity="0.06"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* Play triangle */}
      <polygon points="95,86 95,104 110,95" fill={color} fillOpacity="0.6" />
      {/* Progress bar */}
      <rect
        x="74"
        y="122"
        width="52"
        height="3"
        rx="1.5"
        fill={color}
        fillOpacity="0.15"
      />
      <rect
        x="74"
        y="122"
        width="28"
        height="3"
        rx="1.5"
        fill={color}
        fillOpacity="0.5"
      />
      {/* Code brackets */}
      <text
        x="72"
        y="140"
        fontSize="9"
        fill={color}
        fillOpacity="0.3"
        fontFamily="monospace"
      >
        &lt;/&gt; 40+ lessons
      </text>
      {/* Binary */}
      {["0", "1", "1", "0", "1", "0"].map((b, i) => (
        <text
          key={i}
          x="142"
          y={72 + i * 8}
          fontSize="7"
          fill={color}
          fillOpacity="0.2"
          fontFamily="monospace"
        >
          {b}
        </text>
      ))}
    </svg>
  );
}

function DevKitIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* Box */}
      <rect
        x="72"
        y="80"
        width="56"
        height="40"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* Lid line */}
      <line
        x1="72"
        y1="90"
        x2="128"
        y2="90"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Center tape */}
      <line
        x1="100"
        y1="80"
        x2="100"
        y2="120"
        stroke={color}
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      {/* Items peeking out */}
      <circle cx="88" cy="72" r="6" fill={color} fillOpacity="0.3" />
      <line
        x1="108"
        y1="70"
        x2="108"
        y2="82"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      {/* Star */}
      <text x="120" y="72" fontSize="10" fill={color} fillOpacity="0.4">
        &starf;
      </text>
      {/* Tag */}
      <rect
        x="132"
        y="78"
        width="14"
        height="18"
        rx="2"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <circle cx="139" cy="82" r="2" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

function TShirtIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle
        cx="100"
        cy="95"
        r="52"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="100" cy="95" r="32" fill={color} fillOpacity="0.06" />
      {/* T-shirt body */}
      <rect
        x="80"
        y="82"
        width="40"
        height="38"
        rx="3"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* Sleeves */}
      <rect
        x="62"
        y="82"
        width="18"
        height="18"
        rx="2"
        fill={color}
        fillOpacity="0.06"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <rect
        x="120"
        y="82"
        width="18"
        height="18"
        rx="2"
        fill={color}
        fillOpacity="0.06"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Collar */}
      <ellipse
        cx="100"
        cy="80"
        rx="8"
        ry="5"
        fill="#0a0a0f"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      {/* Logo on chest */}
      <text x="94" y="106" fontSize="14" fill={color} fillOpacity="0.6">
        &#x2601;
      </text>
      {/* Tag */}
      <rect
        x="135"
        y="72"
        width="14"
        height="18"
        rx="2"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <circle cx="142" cy="76" r="2" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ color: string }>> = {
  "srv-cloud": CloudAuditIcon,
  "srv-serverless": LambdaIcon,
  "srv-analytics": AnalyticsIcon,
  "srv-growth": AIGrowthIcon,
  "dig-cloud-playbook": PlaybookIcon,
  "dig-analytics-templates": DashboardTemplatesIcon,
  "dig-serverless-course": MasterclassIcon,
  "phy-dev-kit": DevKitIcon,
  "phy-tshirt": TShirtIcon,
};

export default function ProductIcon({
  productId,
  category,
}: {
  productId: string;
  category: ProductCategory;
}) {
  const color = accentColors[category];
  const IconComponent = iconMap[productId];

  if (!IconComponent) {
    return (
      <div className="flex h-full w-full items-center justify-center text-6xl opacity-40">
        {category === "service"
          ? "\u2699"
          : category === "digital"
            ? "\u25C8"
            : "\u25C9"}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: `radial-gradient(circle at 70% 40%, ${color}, transparent 70%)`,
        }}
      />
      {/* Cyber grid */}
      <div className="cyber-grid absolute inset-0 opacity-10" />
      <IconComponent color={color} />
    </div>
  );
}
