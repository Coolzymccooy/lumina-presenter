import React from 'react';

interface TestPatternsProps {
  pattern: ToolsTestPattern;
}

// SMPTE RP 219 EBU-style 75% color bars, simplified for alignment:
// top band = 7 main bars; middle band = reversed blue-channel bars; bottom
// band includes PLUGE (sub-black / near-black / above-black patches).
const SMPTE_TOP = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
const SMPTE_MID = ['#0000bf', '#131313', '#bf00bf', '#131313', '#00bfbf', '#131313', '#bfbfbf'];

// Full-frame broadcast test patterns. Replaces the program output while
// active so operators can confirm signal integrity, black level, and
// projector alignment without taking a service off the air during prep.
export const TestPatterns = React.memo(function TestPatterns({ pattern }: TestPatternsProps) {
  if (pattern === 'off') return null;
  return (
    <div
      data-testid="tools-testpattern"
      data-pattern={pattern}
      className="pointer-events-none absolute inset-0 z-[60]"
      aria-hidden="true"
    >
      {renderPattern(pattern)}
    </div>
  );
});

function renderPattern(pattern: Exclude<ToolsTestPattern, 'off'>): React.ReactNode {
  switch (pattern) {
    case 'black':
      return <div className="h-full w-full" style={{ background: '#000' }} />;
    case 'white':
      return <div className="h-full w-full" style={{ background: '#fff' }} />;
    case 'gradient':
      return (
        <div
          className="h-full w-full"
          style={{ background: 'linear-gradient(to right, #000 0%, #fff 100%)' }}
        />
      );
    case 'checkerboard':
      return <Checkerboard />;
    case 'pluge':
      return <Pluge />;
    case 'smpte':
      return <SmpteBars />;
  }
}

function SmpteBars() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex w-full" style={{ height: '66.67%' }}>
        {SMPTE_TOP.map((color, idx) => (
          <div key={`top-${idx}`} className="h-full flex-1" style={{ background: color }} />
        ))}
      </div>
      <div className="flex w-full" style={{ height: '8.33%' }}>
        {SMPTE_MID.map((color, idx) => (
          <div key={`mid-${idx}`} className="h-full flex-1" style={{ background: color }} />
        ))}
      </div>
      <div className="flex w-full" style={{ height: '25%' }}>
        <div className="h-full" style={{ flex: 5, background: '#10215c' }} />
        <div className="h-full" style={{ flex: 5, background: '#ebebeb' }} />
        <div className="h-full" style={{ flex: 5, background: '#401a5f' }} />
        <div className="h-full" style={{ flex: 5, background: '#131313' }} />
        <div className="h-full" style={{ flex: 1, background: '#090909' }} />
        <div className="h-full" style={{ flex: 1, background: '#131313' }} />
        <div className="h-full" style={{ flex: 1, background: '#1d1d1d' }} />
        <div className="h-full" style={{ flex: 5, background: '#131313' }} />
      </div>
    </div>
  );
}

function Pluge() {
  // Standard PLUGE: broad black flanked by sub-black (–4%) and super-black
  // (+4%) strips. Used to set the display's black level so that the super-
  // black strip is just visible and the sub-black strip is not.
  return (
    <div className="flex h-full w-full">
      <div className="h-full" style={{ flex: 1, background: '#000' }} />
      <div className="h-full" style={{ flex: 1, background: '#080808' }} />
      <div className="h-full" style={{ flex: 3, background: '#000' }} />
      <div className="h-full" style={{ flex: 1, background: '#131313' }} />
      <div className="h-full" style={{ flex: 1, background: '#000' }} />
    </div>
  );
}

function Checkerboard() {
  // 16 × 9 grid matches the 16:9 broadcast frame with square cells.
  const cols = 16;
  const rows = 9;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const dark = (r + c) % 2 === 0;
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{ background: dark ? '#000' : '#fff' }}
        />,
      );
    }
  }
  return (
    <div
      className="grid h-full w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {cells}
    </div>
  );
}
