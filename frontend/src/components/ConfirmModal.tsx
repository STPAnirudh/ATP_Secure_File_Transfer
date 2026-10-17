import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#141428] text-white p-6 shadow-2xl border border-white/[0.1] modal-box transition-all">
        {/* Close Icon */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDestructive
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
          }`}>
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold modal-heading leading-snug">
              {title}
            </h3>
            <p className="text-xs text-zinc-400 modal-subtext mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08] modal-divider">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-xs font-medium text-zinc-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] modal-cancel-btn transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full text-xs font-semibold text-white shadow-md transition-all hover:scale-[1.02] cursor-pointer ${
              isDestructive
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                : 'bg-agnos-vermilion hover:bg-agnos-vermilion-hover shadow-agnos-vermilion/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
