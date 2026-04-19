import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  heightClass?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { heightClass = 'h-[120px]', className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`
        w-full ${heightClass} resize-none
        rounded-xl bg-[#0B0F17] border border-[#1F2937]
        px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500
        focus:outline-none focus:ring-2 focus:ring-[#2563EB]/60 focus:border-[#2563EB]/60
        transition-colors
        ${className}
      `.trim()}
    />
  );
});
