import dynamic from "next/dynamic";
export const ScoreCharts = dynamic(() => import("./ScoreCharts"), { ssr: false });
