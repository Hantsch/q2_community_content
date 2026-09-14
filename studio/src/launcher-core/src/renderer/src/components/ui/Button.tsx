import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'neutral' | 'ghost' | 'danger' | 'link'
type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-flame-500 text-flame-ink border-flame-300 hover:bg-flame-400 active:translate-y-px shadow-[0_1px_0_rgb(255_255_255/0.3)_inset]',
  neutral: 'bg-raised text-ink border-line-strong hover:bg-hover active:bg-active',
  ghost: 'bg-transparent text-ink-dim border-transparent hover:bg-hover hover:text-ink',
  danger: 'bg-transparent text-danger border-danger/40 hover:bg-danger/10',
  link: 'bg-transparent text-flame-300 border-transparent hover:text-flame-200 hover:underline px-0',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  trailingIcon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'neutral',
  size = 'md',
  icon,
  trailingIcon,
  fullWidth,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm border font-medium whitespace-nowrap',
        'transition-[background-color,color,border-color,transform] duration-[--dur-fast] ease-[--ease-out-quart]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: these buttons have no visible text. */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm border',
        'transition-colors duration-[--dur-fast] ease-[--ease-out-quart]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        size === 'sm' ? 'size-7' : 'size-9',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export type PlayButtonVariant = 'flame' | 'neutral' | 'danger'

export interface PlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: PlayButtonVariant
  icon?: ReactNode
}

/**
 * The single loudest control in the launcher. Shape and weight stay identical
 * across play / install / update / repair so the button never moves or resizes
 * as an installation's state changes - only its colour and label do.
 */
export function PlayButton({
  tone = 'flame',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: PlayButtonProps) {
  return (
    <button
      type={type}
      data-variant={tone === 'flame' ? undefined : tone}
      className={cn('btn-play no-drag', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
