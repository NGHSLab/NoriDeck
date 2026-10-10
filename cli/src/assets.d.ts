/** esbuild 의 text 로더로 묶이는 마크다운 (nori init 이 AGENTS.md 로 넣는 AI 안내문) */
declare module '*.md' {
  const text: string;
  export default text;
}
