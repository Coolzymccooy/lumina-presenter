import React from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:bg-[#1E3A8A]/50',
  secondary: 'bg-[#1F2937] hover:bg-[#273548] text-zinc-200 disabled:opacity-50',
  accent: 'bg-[#F59E0B] hover:bg-[#D97706] text-zinc-950 font-semibold disabled:bg-[#78350F]/50',
  ghost: 'bg-transparent hover:bg-[#1F2937] text-zinc-300 disabled:opacity-50',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 h-8',
  md: 'text-sm px-4 py-2 h-10',
  lg: 'text-sm px-5 py-2.5 h-11 font-semibold',
};

export function PillButton({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  disabled,
  className = '',
  children,
  ...rest
}: PillButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60
        disabled:cursor-not-allowed
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim()}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : leftIcon}
      {children}
    </button>
  );
}
